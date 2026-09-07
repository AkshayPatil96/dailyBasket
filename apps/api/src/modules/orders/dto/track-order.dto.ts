import { IsEmail, IsString, MinLength } from 'class-validator';

export class TrackOrderDto {
  @IsString()
  @MinLength(1, { message: 'orderNumber is required' })
  orderNumber!: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;
}
