import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { DeliveryPartnersService } from '../delivery-partners/delivery-partners.service';
import { DeliveryService, type AdminDeliveryAssignmentStatus } from './delivery.service';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { FailDeliveryDto } from './dto/fail-delivery.dto';
import { RejectDeliveryDto } from './dto/reject-delivery.dto';

const VALID_ASSIGNMENT_DISPLAY_STATUSES: AdminDeliveryAssignmentStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'REASSIGNED',
];

@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly deliveryPartnersService: DeliveryPartnersService,
  ) {}

  @Get('admin/list')
  @Roles('ADMIN')
  async adminList(@Query('status') status: string | undefined) {
    if (status && !VALID_ASSIGNMENT_DISPLAY_STATUSES.includes(status as AdminDeliveryAssignmentStatus)) {
      throw new BadRequestException('Invalid status filter');
    }
    return this.deliveryService.adminList(status as AdminDeliveryAssignmentStatus | undefined);
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

  @Get('my/active')
  @Roles('DELIVERY_PARTNER')
  async myActive(@CurrentUser() user: AuthenticatedUser) {
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myActive(partner.id);
  }

  @Get('my/history')
  @Roles('DELIVERY_PARTNER')
  async myHistory(@CurrentUser() user: AuthenticatedUser) {
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myHistory(partner.id);
  }

  @Post('my/accept')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async myAccept(@CurrentUser() user: AuthenticatedUser, @Query('id') deliveryId: string | undefined) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myAccept(partner.id, deliveryId);
  }

  @Post('my/reject')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async myReject(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') deliveryId: string | undefined,
    @Body() dto: RejectDeliveryDto,
  ) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myReject(partner.id, deliveryId, dto.reason, dto.note);
  }

  @Post('my/pickup')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async myPickup(@CurrentUser() user: AuthenticatedUser, @Query('id') deliveryId: string | undefined) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myPickup(partner.id, deliveryId);
  }

  @Post('my/start')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async myStart(@CurrentUser() user: AuthenticatedUser, @Query('id') deliveryId: string | undefined) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myStart(partner.id, deliveryId);
  }

  // Tighter than the app-wide default (100/min) — a 6-digit code is a small
  // enough space that the default limit isn't a real brute-force guard.
  @Post('my/complete')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async myComplete(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') deliveryId: string | undefined,
    @Body() dto: CompleteDeliveryDto,
  ) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myComplete(partner.id, deliveryId, dto.otpCode);
  }

  @Post('my/fail')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async myFail(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') deliveryId: string | undefined,
    @Body() dto: FailDeliveryDto,
  ) {
    if (!deliveryId) {
      throw new BadRequestException('id is required');
    }
    const partner = await this.deliveryPartnersService.getByUserId(user.id);
    return this.deliveryService.myFail(partner.id, deliveryId, dto.reason);
  }
}
