import { IsEmail, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

// Either savedAddressId (authenticated, picking a saved address) or the
// manual fields (guest, or "new address") — cross-checked in the service,
// not here, since which combination is valid depends on the caller's auth state.
export class SetCheckoutAddressDto {
  @IsOptional()
  @IsUUID()
  savedAddressId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'recipientName is required' })
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'phone is required' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'line1 is required' })
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'city is required' })
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'state is required' })
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'postalCode is required' })
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @IsOptional()
  @IsEmail({}, { message: 'guestEmail must be a valid email' })
  guestEmail?: string;
}
