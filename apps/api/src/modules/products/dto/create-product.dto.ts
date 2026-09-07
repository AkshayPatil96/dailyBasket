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
import { DietaryTag } from '@prisma/client';

export class CreateProductDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

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
  @IsBoolean()
  isFeatured?: boolean;
}
