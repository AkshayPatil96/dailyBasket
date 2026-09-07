import { IsString, Length } from 'class-validator';

export class CompleteDeliveryDto {
  @IsString()
  @Length(6, 6, { message: 'otpCode must be a 6-digit code' })
  otpCode!: string;
}
