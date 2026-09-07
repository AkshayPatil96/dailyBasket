import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Delivery, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

// A delivery can be (re)assigned/retried from any of these — PENDING_ASSIGNMENT
// is the normal case, ASSIGNED covers reassigning before the partner
// responds, REJECTED/FAILED cover retrying after something went wrong.
const ASSIGNABLE_STATUSES: DeliveryStatus[] = ['PENDING_ASSIGNMENT', 'ASSIGNED', 'REJECTED', 'FAILED'];

// Terminal, for-this-partner-only purposes: once a delivery lands here it
// drops out of "my active delivery" and into "my history".
const PARTNER_TERMINAL_STATUSES: DeliveryStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED'];

// How long a partner has to accept/reject before the assignment auto-expires
// and the delivery goes back to the unassigned queue for admin to reassign
// (to the same partner as a deliberate retry, or to someone else) — "basic"
// per the current ask; no penalty/warning to the partner yet, that's future
// scope once EXPIRED outcomes are being counted for something.
const ACCEPT_WINDOW_MS = 5 * 60 * 1000;
// Caps how much one cron tick touches, same reasoning as AdminService's
// checkout-reservation sweep — a slow run just catches the rest next minute.
const MAX_EXPIRY_SWEEP_PER_RUN = 200;

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

  // Full operational view — every delivery, optionally filtered to one
  // status, most recently active first. Distinct from adminListUnassigned()
  // which is specifically the assignment queue (PACKED + PENDING_ASSIGNMENT).
  async adminList(status?: DeliveryStatus) {
    return this.prisma.delivery.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: DELIVERY_LIST_ORDER_INCLUDE,
    });
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
    return delivery;
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
        data: { deliveryPartnerId, status: 'ASSIGNED', assignedAt: new Date() },
        include: {
          order: { select: { orderNumber: true } },
          deliveryPartner: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });
    });
  }

  // The partner's current, non-terminal delivery — at most one at a time
  // (see AGENTS.md/doc: no multi-delivery batching in v1).
  async myActive(deliveryPartnerId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: {
        deliveryPartnerId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
      },
      include: PARTNER_FULFILLMENT_INCLUDE,
    });
    if (!delivery) {
      return null;
    }
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
  // one only counts once the delivery itself reached a terminal status
  // (still-in-progress ones belong in myActive(), not history).
  async myHistory(deliveryPartnerId: string) {
    const assignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        deliveryPartnerId,
        OR: [
          { outcome: 'REJECTED' },
          { outcome: 'EXPIRED' },
          { outcome: 'ACCEPTED', delivery: { status: { in: PARTNER_TERMINAL_STATUSES } } },
        ],
      },
      orderBy: { assignedAt: 'desc' },
      take: 50,
      include: { delivery: { include: DELIVERY_LIST_ORDER_INCLUDE } },
    });
    return assignments.map((assignment) => ({ ...assignment.delivery, assignmentOutcome: assignment.outcome }));
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
  async myReject(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'ASSIGNED');
      await tx.deliveryAssignment.updateMany({
        where: { deliveryId, deliveryPartnerId, outcome: 'PENDING' },
        data: { outcome: 'REJECTED', respondedAt: new Date() },
      });
      await tx.deliveryPartner.update({
        where: { id: deliveryPartnerId },
        data: { availabilityStatus: 'AVAILABLE', availableSince: new Date() },
      });
      return tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'REJECTED', deliveryPartnerId: null },
      });
    });
  }

  async myPickup(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'ACCEPTED');
      return tx.delivery.update({ where: { id: deliveryId }, data: { status: 'PICKED_UP', pickedUpAt: new Date() } });
    });
  }

  // The only partner action that also moves the Order forward — see
  // OrdersService.syncOrderStatusFromDelivery's comment on why OUT_FOR_DELIVERY
  // is a side effect of this, not a direct admin/customer action.
  async myStart(deliveryPartnerId: string, deliveryId: string): Promise<Delivery> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const delivery = await this.assertOwnedDelivery(deliveryPartnerId, deliveryId, 'PICKED_UP');
      const result = await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'OUT_FOR_DELIVERY', outForDeliveryAt: new Date() },
      });
      await this.ordersService.syncOrderStatusFromDelivery(tx, delivery.orderId, 'OUT_FOR_DELIVERY');
      return result;
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: updated.orderId } });
    await this.ordersService.notifyDeliveryStatusChange(order, 'OUT_FOR_DELIVERY');
    return updated;
  }
}
