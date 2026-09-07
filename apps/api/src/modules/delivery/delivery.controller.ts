import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import type { DeliveryStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeliveryService } from './delivery.service';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';

const VALID_DELIVERY_STATUSES: DeliveryStatus[] = [
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
  'FAILED',
];

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('admin/list')
  @Roles('ADMIN')
  async adminList(@Query('status') status: string | undefined) {
    if (status && !VALID_DELIVERY_STATUSES.includes(status as DeliveryStatus)) {
      throw new BadRequestException('Invalid status filter');
    }
    return this.deliveryService.adminList(status as DeliveryStatus | undefined);
  }

  @Get('admin')
  @Roles('ADMIN')
  async adminGetOne(@Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.deliveryService.adminGetOne(id);
  }

  @Get('admin/unassigned')
  @Roles('ADMIN')
  async adminListUnassigned() {
    return this.deliveryService.adminListUnassigned();
  }

  @Get('admin/available-partners')
  @Roles('ADMIN')
  async adminListAvailablePartners() {
    return this.deliveryService.adminListAvailablePartners();
  }

  @Post('admin/assign')
  @HttpCode(200)
  @Roles('ADMIN')
  async adminAssign(@Query('id') deliveryId: string | undefined, @Body() dto: AssignDeliveryDto) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    return this.deliveryService.adminAssign(deliveryId, dto.deliveryPartnerId);
  }
}
