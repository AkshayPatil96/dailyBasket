import { IsEmail } from 'class-validator';

export class EmailOnlyDto {
  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;
}
