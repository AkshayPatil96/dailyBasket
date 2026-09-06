import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Unit } from '@prisma/client';

export class CreateVariantDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(1, { message: 'skuCode is required' })
  skuCode!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @MinLength(1, { message: 'label is required' })
  label!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsEnum(Unit)
  unit!: Unit;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  // Seeds the linked Inventory row — without this every new variant starts
  // at 0 stock and shows as out of stock everywhere until manually adjusted.
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  // Low-stock threshold for the admin "low stock" badge — omit to use the
  // schema default (10).
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}
