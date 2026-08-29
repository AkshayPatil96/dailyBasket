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
}
