import { Injectable } from '@nestjs/common';
import { SystemSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// Singleton row, always addressed by this fixed id — never queried any
// other way (see the SystemSettings model comment).
const SETTINGS_ID = 'default';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Read-heavy — Cart/Checkout pricing calls this on every summary build.
  // Bootstraps the row with schema defaults on first-ever call rather than
  // requiring a seed script.
  async get(): Promise<SystemSettings> {
    const existing = await this.prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) {
      return existing;
    }
    return this.prisma.systemSettings.create({ data: { id: SETTINGS_ID } });
  }

  async adminUpdate(dto: UpdateSettingsDto): Promise<SystemSettings> {
    await this.get(); // ensure the row exists before a partial update
    return this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        ...dto,
        handlingChargeWaivedUntil:
          dto.handlingChargeWaivedUntil === undefined
            ? undefined
            : dto.handlingChargeWaivedUntil
              ? new Date(dto.handlingChargeWaivedUntil)
              : null,
      },
    });
  }

  // Shared by Cart and Checkout so they can never disagree on the charged
  // amount. FIXED is a flat ₹ value; PERCENTAGE is capped at
  // handlingChargeMaxAmount (same min(percent, cap) pattern as a
  // PERCENTAGE coupon's maxDiscountAmount). A waiver zeroes the charge but
  // still reports what it would have been, so the UI can show the original
  // amount struck through next to the promotional reason.
  computeHandlingCharge(
    settings: SystemSettings,
    subtotal: number,
  ): { amount: number; originalAmount: number; waived: boolean; waiverReason: string | null } {
    const originalAmount =
      settings.handlingChargeType === 'PERCENTAGE'
        ? Math.min(
            (subtotal * Number(settings.handlingChargeValue)) / 100,
            settings.handlingChargeMaxAmount ? Number(settings.handlingChargeMaxAmount) : Infinity,
          )
        : Number(settings.handlingChargeValue);

    const waived = Boolean(settings.handlingChargeWaivedUntil && settings.handlingChargeWaivedUntil > new Date());

    return {
      amount: waived ? 0 : originalAmount,
      originalAmount,
      waived,
      waiverReason: waived ? settings.handlingChargeWaiverReason : null,
    };
  }
}
