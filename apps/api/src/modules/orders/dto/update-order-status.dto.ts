import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  // Required in practice for CANCELLED — enforced in the service, since
  // whether it's required depends on the target status, not the field itself.
  @IsOptional()
  @IsString()
  reason?: string;
}
