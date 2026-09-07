import { IsEmail, IsOptional } from 'class-validator';

export class StartCheckoutDto {
  // Only meaningful for guest checkout — authenticated orders use the user's account email.
  @IsOptional()
  @IsEmail({}, { message: 'guestEmail must be a valid email' })
  guestEmail?: string;
}
