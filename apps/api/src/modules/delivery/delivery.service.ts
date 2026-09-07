import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Delivery, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// A delivery can be (re)assigned/retried from any of these — PENDING_ASSIGNMENT
// is the normal case, ASSIGNED covers reassigning before the partner
// responds, REJECTED/FAILED cover retrying after something went wrong.
const ASSIGNABLE_STATUSES: DeliveryStatus[] = ['PENDING_ASSIGNMENT', 'ASSIGNED', 'REJECTED', 'FAILED'];

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

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

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
}
