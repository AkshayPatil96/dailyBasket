import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CouponDiscountType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @MinLength(1, { message: 'code is required' })
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @IsPositive()
  discountValue!: number;

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
