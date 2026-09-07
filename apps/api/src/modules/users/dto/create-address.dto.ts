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

export class CreateAddressDto {
  @IsOptional()
  @IsEnum(AddressLabel)
  label?: AddressLabel;

  @IsString()
  @MinLength(1, { message: 'recipientName is required' })
  recipientName!: string;

  @IsString()
  @MinLength(1, { message: 'phone is required' })
  phone!: string;

  @IsString()
  @MinLength(1, { message: 'line1 is required' })
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @MinLength(1, { message: 'city is required' })
  city!: string;

  @IsString()
  @MinLength(1, { message: 'state is required' })
  state!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @MinLength(1, { message: 'postalCode is required' })
  postalCode!: string;

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
