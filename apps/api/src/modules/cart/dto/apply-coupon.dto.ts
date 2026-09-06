import { IsString, MinLength } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @MinLength(1, { message: 'code is required' })
  code!: string;
}
