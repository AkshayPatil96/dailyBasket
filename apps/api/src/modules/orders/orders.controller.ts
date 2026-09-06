import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { OrdersService } from './orders.service';
import { ListOrdersDto } from './dto/list-orders.dto';

const DEFAULT_LIMIT = 20;

// Customer order history — always scoped to the caller's own orders, never
// list-by-arbitrary-id. Guest orders aren't listed here since there's no
// durable guest identity to query by; a guest's confirmation comes straight
// back from the checkout verify/webhook response instead.
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('list')
  @HttpCode(200)
  async list(@CurrentUser() user: AuthenticatedUser, @Body() dto: ListOrdersDto) {
    return this.ordersService.listForUser(user.id, dto.offset ?? 0, dto.limit ?? DEFAULT_LIMIT);
  }

  @Get()
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.ordersService.findOneForUser(user.id, id);
  }
}
