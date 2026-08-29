import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AddressLabel } from '@prisma/client';

export class UpdateAddressDto {
  @IsOptional()
  @IsEnum(AddressLabel)
  label?: AddressLabel;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'recipientName cannot be empty' })
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'phone cannot be empty' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'line1 cannot be empty' })
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'city cannot be empty' })
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'state cannot be empty' })
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'postalCode cannot be empty' })
  postalCode?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
