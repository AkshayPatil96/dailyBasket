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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { OrdersService } from './orders.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

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

  @Post('cancel')
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
    @Body() dto: CancelOrderDto,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.ordersService.cancelForUser(user.id, id, dto.reason);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async adminFindOne(@Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.ordersService.adminFindOne(id);
  }

  @Post('admin/list')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async adminList(@Body() dto: AdminListOrdersDto) {
    return this.ordersService.adminList(dto);
  }

  @Post('admin/status')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.ordersService.adminUpdateStatus(user.id, id, dto.status, dto.reason);
  }
}
