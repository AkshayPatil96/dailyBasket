import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Unit, VariantStatus } from '@prisma/client';

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'label cannot be empty' })
  label?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;

  // Sets the linked Inventory row's quantity to this exact value (a correction,
  // not a delta) — see AGENTS.md/cart doc: stock is validated at cart/checkout
  // time from this Inventory row, not from a field on the variant itself.
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}
