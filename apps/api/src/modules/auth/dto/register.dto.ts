import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1, { message: 'firstName is required' })
  firstName!: string;

  @IsString()
  @MinLength(1, { message: 'lastName is required' })
  lastName!: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;
}
