import { IsString, MinLength } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @MinLength(1, { message: 'razorpayOrderId is required' })
  razorpayOrderId!: string;

  @IsString()
  @MinLength(1, { message: 'razorpayPaymentId is required' })
  razorpayPaymentId!: string;

  @IsString()
  @MinLength(1, { message: 'razorpaySignature is required' })
  razorpaySignature!: string;
}
