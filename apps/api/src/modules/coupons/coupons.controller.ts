import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CouponsService } from './coupons.service';
import { AdminListCouponsDto } from './dto/admin-list-coupons.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

// Admin-only management. There's no public "browse available coupons"
// endpoint — customers apply a known code via /cart/coupon, they don't
// discover coupons here.
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get('admin')
  async adminFindOne(@Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.couponsService.adminFindOne(id);
  }

  @Post('admin/list')
  @HttpCode(200)
  async adminList(@Body() dto: AdminListCouponsDto) {
    return this.couponsService.adminList(dto);
  }

  @Post('admin')
  async adminCreate(@Body() dto: CreateCouponDto) {
    return this.couponsService.adminCreate(dto);
  }

  @Post('admin/update')
  @HttpCode(200)
  async adminUpdate(@Query('id') id: string | undefined, @Body() dto: UpdateCouponDto) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.couponsService.adminUpdate(id, dto);
  }
}
