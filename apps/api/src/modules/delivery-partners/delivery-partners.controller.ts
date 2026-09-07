import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { DeliveryPartnersService } from './delivery-partners.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('delivery-partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryPartnersController {
  constructor(private readonly deliveryPartnersService: DeliveryPartnersService) {}

  @Get('me')
  @Roles('DELIVERY_PARTNER')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryPartnersService.getMyProfile(user.id);
  }

  @Post('me/availability')
  @HttpCode(200)
  @Roles('DELIVERY_PARTNER')
  async setAvailability(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAvailabilityDto) {
    return this.deliveryPartnersService.setAvailability(user.id, dto.availability);
  }

  @Get('admin/list')
  @Roles('ADMIN')
  async adminList() {
    return this.deliveryPartnersService.adminList();
  }
}
