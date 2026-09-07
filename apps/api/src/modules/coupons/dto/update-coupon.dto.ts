import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { CouponDiscountType } from '@prisma/client';

// code is intentionally not editable — it may already be shared/printed
// anywhere the coupon was promoted; changing it would break those links.
export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @IsOptional()
  @IsPositive()
  discountValue?: number;

  @IsOptional()
  @IsPositive()
  maxDiscountAmount?: number;

  @IsOptional()
  @IsPositive()
  minOrderValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
