import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { ListOrdersDto } from './list-orders.dto';

export class AdminListOrdersDto extends ListOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  // Matches against orderNumber or recipientName.
  @IsOptional()
  @IsString()
  search?: string;
}
