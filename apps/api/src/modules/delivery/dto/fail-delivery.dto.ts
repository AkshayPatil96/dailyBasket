import { IsEnum } from 'class-validator';
import { DeliveryFailureReason } from '@prisma/client';

export class FailDeliveryDto {
  @IsEnum(DeliveryFailureReason)
  reason!: DeliveryFailureReason;
}
