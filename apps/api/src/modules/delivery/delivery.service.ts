import { randomInt, timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type {
  Delivery,
  DeliveryAssignmentOutcome,
  DeliveryFailureReason,
  DeliveryRejectionReason,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

// A delivery can be (re)assigned/retried from any of these — PENDING_ASSIGNMENT
// is the normal case, ASSIGNED covers reassigning before the partner
// responds, REJECTED/FAILED cover retrying after something went wrong.
const ASSIGNABLE_STATUSES: DeliveryStatus[] = ['PENDING_ASSIGNMENT', 'ASSIGNED', 'REJECTED', 'FAILED'];

// How long a partner has to accept/reject before the assignment auto-expires
// and the delivery goes back to the unassigned queue for admin to reassign
// (to the same partner as a deliberate retry, or to someone else) — "basic"
// per the current ask; no penalty/warning to the partner yet, that's future
// scope once EXPIRED outcomes are being counted for something.
const ACCEPT_WINDOW_MS = 5 * 60 * 1000;
// Caps how much one cron tick touches, same reasoning as AdminService's
// checkout-reservation sweep — a slow run just catches the rest next minute.
const MAX_EXPIRY_SWEEP_PER_RUN = 200;

// Generous on purpose — a delivery can sit OUT_FOR_DELIVERY for a while
// before the partner actually reaches the door, and re-issuing an OTP mid-
// route is more friction than a long expiry is worth at this scale.
const OTP_TTL_MS = 60 * 60 * 1000;

const DELIVERY_LIST_ORDER_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      recipientName: true,
      phone: true,
      city: true,
      state: true,
      total: true,
      createdAt: true,
    },
  },
  deliveryPartner: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
} as const;

// admin/deliveries is one row per DeliveryAssignment attempt, not per
// Delivery — a reassigned-then-retried order shows its rejected/failed
// attempt AND its eventual success as separate rows, matching how the
// partner's own /delivery/history works (see myHistory() below). Fully
// derived from the assignment's own fields, same as PartnerHistoryDelivery's
// frontend rendering — no dependency on Delivery's shared/current-only status.
export type AdminDeliveryAssignmentStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'REASSIGNED';

function computeAssignmentDisplayStatus(assignment: {
  outcome: DeliveryAssignmentOutcome;
  pickedUpAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
}): AdminDeliveryAssignmentStatus {
  if (assignment.outcome !== 'ACCEPTED') {
    // PENDING (still awaiting response) displays the same as a fresh
    // assignment — REJECTED/EXPIRED/REASSIGNED are already terminal labels.
    return assignment.outcome === 'PENDING' ? 'ASSIGNED' : assignment.outcome;
  }
  if (assignment.deliveredAt) return 'DELIVERED';
  if (assignment.failedAt) return 'FAILED';
  if (assignment.outForDeliveryAt) return 'OUT_FOR_DELIVERY';
  if (assignment.pickedUpAt) return 'PICKED_UP';
  return 'ACCEPTED';
}

// Everything a partner needs to actually fulfil the delivery — doc's
// "Active Delivery" section: customer name/phone, address, items, quantity,
// payment status. Landmark/postal/formatted address come from the full
// Order fields, not the trimmed admin summary above.
const PARTNER_FULFILLMENT_INCLUDE = {
  order: {
    include: {
      items: true,
      payment: { select: { status: true } },
    },
  },
} as const;

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  // Sweeps ASSIGNED deliveries whose partner never responded within the
  // accept window — expires the pending DeliveryAssignment, frees the
  // partner back to AVAILABLE, and drops the delivery back to
  // PENDING_ASSIGNMENT for admin to reassign. Same pattern as
  // AdminService.expireCheckoutReservationsAndSessions.
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleAssignments(): Promise<void> {
    const cutoff = new Date(Date.now() - ACCEPT_WINDOW_MS);
    const stale = await this.prisma.delivery.findMany({
      where: { status: 'ASSIGNED', assignedAt: { lt: cutoff } },
      select: { id: true, deliveryPartnerId: true },
      take: MAX_EXPIRY_SWEEP_PER_RUN,
    });

    for (const delivery of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.deliveryAssignment.updateMany({
            where: { deliveryId: delivery.id, outcome: 'PENDING' },
            data: { outcome: 'EXPIRED', respondedAt: new Date() },
          });
          if (delivery.deliveryPartnerId) {
            await tx.deliveryPartner.update({
              where: { id: delivery.deliveryPartnerId },
              data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
            });
          }
          await tx.delivery.update({
            where: { id: delivery.id },
            data: { status: 'PENDING_ASSIGNMENT', deliveryPartnerId: null },
          });
        });
      } catch (error) {
        this.logger.warn(`Failed expiring stale assignment for delivery ${delivery.id}: ${error}`);
      }
    }
  }

  // Orders that are PACKED but have no partner working on them yet, oldest
  // first — Delivery.status alone isn't enough here since a Delivery row
  // exists (at PENDING_ASSIGNMENT) from the moment the order is placed, well
  // before it's actually ready to hand off.
  async adminListUnassigned() {
    return this.prisma.delivery.findMany({
      where: { status: 'PENDING_ASSIGNMENT', order: { status: 'PACKED' } },
      orderBy: { order: { createdAt: 'asc' } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            recipientName: true,
            phone: true,
            city: true,
            state: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });
  }

  // FIFO by idle time — see dailybasket-delivery-partner-operations.md
  // "Assignment" and DeliveryPartner.availableSince's comment. Still fully
  // manual: this just orders the list, admin picks whoever they want.
  async adminListAvailablePartners() {
    return this.prisma.deliveryPartner.findMany({
      where: { status: 'ACTIVE', availabilityStatus: 'AVAILABLE' },
      orderBy: { availableSince: 'asc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
  }

  // The audit trail, not the assignment queue — one row per assignment
  // attempt (see AdminDeliveryAssignmentStatus's comment above), so a
  // rejected-then-retried-and-delivered order shows up as two separate rows,
  // not one row silently overwritten by whatever the latest attempt did.
  // The unassigned queue itself is adminListUnassigned() (PACKED +
  // PENDING_ASSIGNMENT, which has no assignment yet at all); assign/retry
  // actions live on the order page, not here.
  async adminList(status?: AdminDeliveryAssignmentStatus) {
    const assignments = await this.prisma.deliveryAssignment.findMany({
      orderBy: { assignedAt: 'desc' },
      include: {
        delivery: { include: { order: { select: DELIVERY_LIST_ORDER_INCLUDE.order.select } } },
        deliveryPartner: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      },
    });
    const mapped = assignments.map((assignment) => ({
      id: assignment.id,
      deliveryId: assignment.deliveryId,
      order: assignment.delivery.order,
      deliveryPartner: assignment.deliveryPartner,
      outcome: assignment.outcome,
      displayStatus: computeAssignmentDisplayStatus(assignment),
      assignedAt: assignment.assignedAt,
      respondedAt: assignment.respondedAt,
      pickedUpAt: assignment.pickedUpAt,
      outForDeliveryAt: assignment.outForDeliveryAt,
      deliveredAt: assignment.deliveredAt,
      failedAt: assignment.failedAt,
      failureReason: assignment.failureReason,
      rejectionReason: assignment.rejectionReason,
      rejectionNote: assignment.rejectionNote,
    }));
    return status ? mapped.filter((item) => item.displayStatus === status) : mapped;
  }

  async adminGetOne(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        ...DELIVERY_LIST_ORDER_INCLUDE,
        assignments: {
          orderBy: { assignedAt: 'asc' },
          include: { deliveryPartner: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    // Same derivation as adminList() — each assignment's own displayStatus,
    // so a rejected/failed attempt can be viewed on its own (via
    // ?assignment=<id>) without the Delivery's shared/current-only status
    // (which by then belongs to whichever attempt is latest) bleeding in.
    return {
      ...delivery,
      assignments: delivery.assignments.map((assignment) => ({
        ...assignment,
        displayStatus: computeAssignmentDisplayStatus(assignment),
      })),
    };
  }

  async adminAssign(deliveryId: string, deliveryPartnerId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
      if (!delivery) {
        throw new NotFoundException('Delivery not found');
      }
      if (!ASSIGNABLE_STATUSES.includes(delivery.status)) {
        throw new ConflictException(`Cannot assign a delivery in ${delivery.status} status`);
      }

      const partner = await tx.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } });
      if (!partner) {
        throw new NotFoundException('Delivery partner not found');
      }
      if (partner.status !== 'ACTIVE' || partner.availabilityStatus !== 'AVAILABLE') {
        throw new ConflictException('This partner is not currently available');
      }

      // Reassigning: supersede the still-pending assignment (never overwrite
      // it) and free up whoever was previously on the hook for this delivery.
      if (delivery.deliveryPartnerId) {
        await tx.deliveryAssignment.updateMany({
          where: { deliveryId, outcome: 'PENDING' },
          data: { outcome: 'REASSIGNED', respondedAt: new Date() },
        });
        await tx.deliveryPartner.update({
          where: { id: delivery.deliveryPartnerId },
          data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
        });
      }

      await tx.deliveryAssignment.create({ data: { deliveryId, deliveryPartnerId } });

      // BUSY the moment they're assigned, not on accept — otherwise two
      // admins could assign the same partner to two orders at once.
      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: { availabilityStatus: 'BUSY', availableSince: null },
      });

      return tx.delivery.update({
        where: { id: deliveryId },
        // Clears every field from a previous attempt (matters most for a
        // retry after REJECTED/FAILED — otherwise the new partner's timeline
        // would start showing a stale pickedUpAt/otpCode left over from
        // whoever had it before them).
        data: {
          deliveryPartnerId,
          status: 'ASSIGNED',
          assignedAt: new Date(),
          acceptedAt: null,
          pickedUpAt: null,
          outForDeliveryAt: null,
          failedAt: null,
          failureReason: null,
          rejectionReason: null,
          rejectionNote: null,
          otpCode: null,
          otpExpiresAt: null,
        },
        include: {
          order: { select: { orderNumber: true } },
          deliveryPartner: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });
    });
  }

  // crypto.randomInt, not Math.random() — this gets read aloud to authorize
  // a real-world handoff, not just displayed for show.
  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  // Constant-time compare — a 6-digit code is guessable regardless, but
  // there's no reason to leak a timing signal on top of that. The length
  // check must come first: timingSafeEqual throws on mismatched buffer sizes.
  private otpMatches(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  }

  // The partner's current, non-terminal delivery — at most one at a time
  // (see AGENTS.md/doc: no multi-delivery batching in v1).
  async myActive(deliveryPartnerId: string) {
    const found = await this.prisma.delivery.findFirst({
      where: {
        deliveryPartnerId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
      },
      include: PARTNER_FULFILLMENT_INCLUDE,
    });
    if (!found) {
      return null;
    }
    // The partner must never see the OTP on their own screen — it's read
    // out to them by the customer at handoff, not looked up.
    const { otpCode: _otpCode, ...delivery } = found;
    // Derived, not stored — ACCEPT_WINDOW_MS is the single source of truth
    // for the window's length, this just tells the client when it ends so
    // the dashboard can render a countdown without hardcoding the duration
    // on the frontend too.
    return {
      ...delivery,
      acceptDeadlineAt:
        delivery.status === 'ASSIGNED' && delivery.assignedAt
          ? new Date(delivery.assignedAt.getTime() + ACCEPT_WINDOW_MS)
          : null,
    };
  }

  // Attributed via DeliveryAssignment, not Delivery.deliveryPartnerId — the
  // latter only ever holds the *current* partner, so a delivery this partner
  // was later reassigned away from would otherwise vanish from their own
  // history. REJECTED/EXPIRED are terminal for them immediately; an ACCEPTED
  // one only counts once *this attempt* reached a terminal outcome (its own
  // deliveredAt/failedAt, not Delivery's shared one — see the field comment
  // on DeliveryAssignment) — still-in-progress ones belong in myActive().
  async myHistory(deliveryPartnerId: string) {
    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        deliveryPartnerId,
        OR: [
          { outcome: 'REJECTED' },
          { outcome: 'EXPIRED' },
          { outcome: 'ACCEPTED', OR: [{ deliveredAt: { not: null } }, { failedAt: { not: null } }] },
        ],
      },
      orderBy: { assignedAt: 'desc' },
      take: 50,
      include: { delivery: { include: DELIVERY_LIST_ORDER_INCLUDE } },
    });
    // The same Delivery row can appear once per assignment attempt (a
    // reassigned-then-retried delivery has multiple DeliveryAssignment rows
    // pointing at one Delivery) — only order/partner-independent fields
    // (order, recipient, etc.) come from `delivery`; every timestamp/outcome
    // field is the assignment's own, never Delivery's shared copy.
    return assignments.map((assignment) => {
      const {
        otpCode: _otpCode,
        status: _status,
        pickedUpAt: _pickedUpAt,
        outForDeliveryAt: _outForDeliveryAt,
        deliveredAt: _deliveredAt,
        failedAt: _failedAt,
        failureReason: _failureReason,
        rejectionReason: _rejectionReason,
        rejectionNote: _rejectionNote,
        ...delivery
      } = assignment.delivery;
      return {
        ...delivery,
        assignmentId: assignment.id,
        assignmentOutcome: assignment.outcome,
        assignmentAssignedAt: assignment.assignedAt,
        assignmentRespondedAt: assignment.respondedAt,
        assignmentPickedUpAt: assignment.pickedUpAt,
        assignmentOutForDeliveryAt: assignment.outForDeliveryAt,
        assignmentDeliveredAt: assignment.deliveredAt,
        assignmentFailedAt: assignment.failedAt,
        assignmentFailureReason: assignment.failureReason,
        assignmentRejectionReason: assignment.rejectionReason,
        assignmentRejectionNote: assignment.rejectionNote,
      };
    });
  }

  // The assignment row for whoever currently holds the delivery — reassigning
  // (even back to the same partner) always creates a new row, so "most
  // recent by assignedAt" is always the live one. Used to mirror lifecycle
  // timestamps onto the assignment (see DeliveryAssignment's field comment)
  // so a later reassignment's outcome never bleeds into this attempt's record.
  private async currentAssignmentId(
    tx: Prisma.TransactionClient,
    deliveryId: string,
    deliveryPartnerId: string,
  ): Promise<string> {
    const assignment = await tx.deliveryAssignment.findFirstOrThrow({
      where: { deliveryId, deliveryPartnerId },
      orderBy: { assignedAt: 'desc' },
      select: { id: true },
    });
    return assignment.id;
  }

  private async assertOwnedDelivery(
    deliveryPartnerId: string,
    deliveryId: string,
    expectedStatus: DeliveryStatus,
  ): Promise<Delivery> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    if (delivery.deliveryPartnerId !== deliveryPartnerId) {
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    if (delivery.status !== expectedStatus) {
      throw new ConflictException(`Cannot do that while the delivery is ${delivery.status}`);
    }
    return delivery;
  }

  async myAccept(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'ASSIGNED');
      await tx.deliveryAssignment.updateMany({
        where: { deliveryId, deliveryPartnerId, outcome: 'PENDING' },
        data: { outcome: 'ACCEPTED', respondedAt: new Date() },
      });
      return tx.delivery.update({ where: { id: deliveryId }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    });
  }

  // Frees the partner immediately — see doc's Availability section, a
  // rejection isn't "busy" anymore, they're back in the pool.
  async myReject(
    deliveryPartnerId: string,
    deliveryId: string,
    reason: DeliveryRejectionReason,
    note?: string,
  ): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'ASSIGNED');
      await tx.deliveryAssignment.updateMany({
        where: { deliveryId, deliveryPartnerId, outcome: 'PENDING' },
        data: { outcome: 'REJECTED', respondedAt: new Date(), rejectionReason: reason, rejectionNote: note },
      });
      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
      });
      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'REJECTED', deliveryPartnerId: null, rejectionReason: reason, rejectionNote: note },
      });
    });
  }

  async myPickup(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'ACCEPTED');
      const pickedUpAt = new Date();
      const assignmentId = await this.currentAssignmentId(tx, deliveryId, deliveryPartnerId);
      await tx.deliveryAssignment.update({ where: { id: assignmentId }, data: { pickedUpAt } });
      return tx.delivery.update({ where: { id: deliveryId }, data: { status: 'PICKED_UP', pickedUpAt } });
    });
  }

  // The only partner action that also moves the Order forward — see
  // OrdersService.syncOrderStatusFromDelivery's comment on why OUT_FOR_DELIVERY
  // is a side effect of this, not a direct admin/customer action. Also mints
  // the handoff OTP here — this is the first moment the customer needs it.
  async myStart(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    const otp = this.generateOtp();

    const updated = await this.prisma.$transaction(async (tx) => {
      const delivery = await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'PICKED_UP');
      const outForDeliveryAt = new Date();
      const assignmentId = await this.currentAssignmentId(tx, deliveryId, deliveryPartnerId);
      await tx.deliveryAssignment.update({ where: { id: assignmentId }, data: { outForDeliveryAt } });
      const result = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'OUT_FOR_DELIVERY',
          outForDeliveryAt,
          otpCode: otp,
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      await this.ordersService.syncOrderStatusFromDelivery(tx, delivery.orderId, 'OUT_FOR_DELIVERY');
      return result;
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: updated.orderId } });
    await this.ordersService.notifyDeliveryStatusChange(order, 'OUT_FOR_DELIVERY');
    await this.ordersService.notifyDeliveryOtp(updated.orderId, otp);
    return updated;
  }

  // Verifies the code the customer read out to the partner, then completes
  // the delivery — the only partner action besides "start" that also moves
  // the Order forward (doc: "Backend verifies" -> DELIVERED).
  async myComplete(deliveryPartnerId: string, deliveryId: string, otpCode: string): Promise<Delivery> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const delivery = await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'OUT_FOR_DELIVERY');
      if (!delivery.otpCode || !delivery.otpExpiresAt || delivery.otpExpiresAt < new Date()) {
        throw new ConflictException('This delivery code has expired — ask the customer for a fresh one');
      }
      if (!this.otpMatches(delivery.otpCode, otpCode.trim())) {
        throw new ConflictException('Incorrect delivery code');
      }

      const deliveredAt = new Date();
      const assignmentId = await this.currentAssignmentId(tx, deliveryId, deliveryPartnerId);
      await tx.deliveryAssignment.update({ where: { id: assignmentId }, data: { deliveredAt } });
      const result = await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'DELIVERED', deliveredAt, otpCode: null, otpExpiresAt: null },
      });
      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
      });
      await this.ordersService.syncOrderStatusFromDelivery(tx, delivery.orderId, 'DELIVERED');
      return result;
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: updated.orderId } });
    await this.ordersService.notifyDeliveryStatusChange(order, 'DELIVERED');
    return updated;
  }

  // Doc's Failed Delivery flow: only reachable from OUT_FOR_DELIVERY (every
  // listed reason — customer unavailable, wrong address, refused, unable to
  // contact — only makes sense once the partner has actually reached the
  // customer). Does NOT touch Order.status or trigger a refund — that's
  // deliberately left to admin review (adminAssign already accepts FAILED
  // for a retry; a plain order cancel handles the "give up" path, both
  // reusing existing endpoints rather than new ones for this).
  async myFail(deliveryPartnerId: string, deliveryId: string, reason: DeliveryFailureReason): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'OUT_FOR_DELIVERY');
      const failedAt = new Date();
      const assignmentId = await this.currentAssignmentId(tx, deliveryId, deliveryPartnerId);
      await tx.deliveryAssignment.update({ where: { id: assignmentId }, data: { failedAt, failureReason: reason } });
      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
      });
      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'FAILED', failedAt, failureReason: reason, otpCode: null, otpExpiresAt: null },
      });
    });
  }
}
