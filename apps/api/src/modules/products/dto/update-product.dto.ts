import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { DietaryTag, ProductStatus } from '@prisma/client';

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'name cannot be empty' })
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsObject()
  nutritionalInfo?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsEnum(DietaryTag, { each: true })
  dietaryInfo?: DietaryTag[];

  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
