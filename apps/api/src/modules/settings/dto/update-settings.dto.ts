import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { HandlingChargeType } from '@prisma/client';

export class UpdateSettingsDto {
  @IsOptional()
  @Min(0)
  deliveryFee?: number;

  // Explicit null clears it (delivery is never free regardless of order
  // size); omitted leaves the current value untouched.
  @IsOptional()
  freeDeliveryThreshold?: number | null;

  @IsOptional()
  @IsEnum(HandlingChargeType)
  handlingChargeType?: HandlingChargeType;

  // Flat ₹ amount when type is FIXED, a percentage when type is PERCENTAGE.
  @IsOptional()
  @Min(0)
  handlingChargeValue?: number;

  // Only meaningful for PERCENTAGE — caps the computed charge. Null clears it.
  @IsOptional()
  handlingChargeMaxAmount?: number | null;

  // Null clears the waiver (charge resumes immediately).
  @IsOptional()
  @IsDateString()
  handlingChargeWaivedUntil?: string | null;

  @IsOptional()
  @IsString()
  handlingChargeWaiverReason?: string | null;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  bannerText?: string | null;

  @IsOptional()
  @IsEmail()
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  supportPhone?: string | null;
}
