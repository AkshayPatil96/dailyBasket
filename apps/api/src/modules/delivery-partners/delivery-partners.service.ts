import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryPartner } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Statuses where the partner is actively on the hook for a delivery — can't
// go OFFLINE while in one of these (doc: "Do not allow an active delivery to
// be abandoned simply by switching offline").
const ACTIVE_DELIVERY_STATUSES = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] as const;

@Injectable()
export class DeliveryPartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string): Promise<DeliveryPartner> {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { userId } });
    if (!partner) {
      throw new NotFoundException('Delivery partner profile not found');
    }
    return partner;
  }

  async getMyProfile(userId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });
    if (!partner) {
      throw new NotFoundException('Delivery partner profile not found');
    }
    return partner;
  }

  async setAvailability(userId: string, availability: 'OFFLINE' | 'AVAILABLE'): Promise<DeliveryPartner> {
    const partner = await this.getByUserId(userId);
    if (partner.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active — contact an admin');
    }

    if (availability === 'OFFLINE') {
      const activeDelivery = await this.prisma.delivery.findFirst({
        where: { deliveryPartnerId: partner.id, status: { in: [...ACTIVE_DELIVERY_STATUSES] } },
        select: { id: true },
      });
      if (activeDelivery) {
        throw new ConflictException('Finish or report your active delivery before going offline');
      }
    }

    const now = new Date();
    return this.prisma.deliveryPartner.update({
      where: { id: partner.id },
      data: {
        availabilityStatus: availability,
        availableSince: availability === 'AVAILABLE' ? now : null,
        lastSeenAt: now,
      },
    });
  }

  // Every partner, active or not — the admin management table (status,
  // availability, and last-seen for anyone currently offline).
  async adminList() {
    return this.prisma.deliveryPartner.findMany({
      orderBy: { lastSeenAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
    });
  }
}
