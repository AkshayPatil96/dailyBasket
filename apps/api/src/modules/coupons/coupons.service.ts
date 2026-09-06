import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListCouponsDto } from './dto/admin-list-coupons.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  // userId/guestEmail are both optional — cart-time validation only knows
  // userId (guests have no email until the checkout address step), so the
  // per-user usage check is skipped there and re-enforced authoritatively
  // at checkout, where both identities are always resolvable.
  async validateByCode(
    code: string,
    subtotal: number,
    userId?: string,
    guestEmail?: string,
  ): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    return this.runChecks(coupon, subtotal, userId, guestEmail);
  }

  async revalidateById(
    couponId: string,
    subtotal: number,
    userId?: string,
    guestEmail?: string,
  ): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    return this.runChecks(coupon, subtotal, userId, guestEmail);
  }

  calculateDiscount(coupon: Coupon, subtotal: number): number {
    const raw =
      coupon.discountType === 'FLAT'
        ? Number(coupon.discountValue)
        : (subtotal * Number(coupon.discountValue)) / 100;
    const capped = coupon.maxDiscountAmount ? Math.min(raw, Number(coupon.maxDiscountAmount)) : raw;
    // Never discount more than the order is actually worth.
    return Math.max(Math.min(capped, subtotal), 0);
  }

  // Atomic — the WHERE guard means a redemption can never push usedCount
  // past usageLimit even under concurrent checkouts, same affected-row-count
  // pattern as inventory reservation. Must run inside the same transaction
  // as order creation: either both commit or neither does.
  async redeem(
    tx: Prisma.TransactionClient,
    couponId: string,
    orderId: string,
    userId: string | null | undefined,
    guestEmail: string | null | undefined,
  ): Promise<void> {
    const affected = await tx.$executeRaw`
      UPDATE coupons SET used_count = used_count + 1
      WHERE id = ${couponId} AND (usage_limit IS NULL OR used_count < usage_limit)
    `;
    if (affected === 0) {
      throw new BadRequestException('This coupon just reached its usage limit');
    }
    await tx.couponRedemption.create({
      data: { couponId, orderId, userId: userId ?? null, guestEmail: guestEmail ?? null },
    });
  }

  async adminList(dto: AdminListCouponsDto) {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;
    const where: Prisma.CouponWhereInput = {
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.search ? { code: { contains: dto.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, total, offset, limit, hasMore: offset + items.length < total };
  }

  async adminFindOne(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async adminCreate(dto: CreateCouponDto): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) {
      throw new BadRequestException('A coupon with this code already exists');
    }
    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount,
        minOrderValue: dto.minOrderValue,
        usageLimit: dto.usageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
      },
    });
  }

  async adminUpdate(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    await this.adminFindOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount,
        minOrderValue: dto.minOrderValue,
        usageLimit: dto.usageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        expiresAt: dto.expiresAt === undefined ? undefined : dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
      },
    });
  }

  // Cart-aware: eligibility depends on the live subtotal, so this can't be a
  // truly static "browse coupons" list — a coupon whose minOrderValue isn't
  // met yet still shows, with the reason why it can't be applied right now
  // (the doc's own "Coupons & Promotions" example: "see why a coupon cannot
  // be applied"). Global usage-limit exhaustion excludes a coupon outright;
  // per-customer limit is checked only when an identity is available
  // (same guest limitation as apply).
  async listAvailableForCart(
    subtotal: number,
    userId?: string,
  ): Promise<{ coupon: Coupon; eligible: boolean; reason?: string }[]> {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    const results: { coupon: Coupon; eligible: boolean; reason?: string }[] = [];
    for (const coupon of coupons) {
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        continue;
      }
      if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
        results.push({
          coupon,
          eligible: false,
          reason: `Add ₹${(Number(coupon.minOrderValue) - subtotal).toFixed(0)} more to unlock`,
        });
        continue;
      }
      if (userId && coupon.usageLimitPerUser !== null) {
        const usedByCustomer = await this.prisma.couponRedemption.count({
          where: { couponId: coupon.id, userId },
        });
        if (usedByCustomer >= coupon.usageLimitPerUser) {
          results.push({ coupon, eligible: false, reason: 'Already used' });
          continue;
        }
      }
      results.push({ coupon, eligible: true });
    }
    return results;
  }

  private async runChecks(
    coupon: Coupon | null,
    subtotal: number,
    userId?: string,
    guestEmail?: string,
  ): Promise<Coupon> {
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Invalid coupon code');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
      throw new BadRequestException(`Minimum order value for this coupon is ₹${coupon.minOrderValue}`);
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.usageLimitPerUser !== null && (userId || guestEmail)) {
      const usedByCustomer = await this.prisma.couponRedemption.count({
        where: {
          couponId: coupon.id,
          ...(userId ? { userId } : { guestEmail }),
        },
      });
      if (usedByCustomer >= coupon.usageLimitPerUser) {
        throw new BadRequestException('You have already used this coupon');
      }
    }
    return coupon;
  }
}
