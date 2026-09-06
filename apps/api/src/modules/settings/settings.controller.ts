import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public — nothing here is sensitive (delivery fee, banner text, support
  // contact, whether maintenance mode is on), and the storefront needs to
  // read it without being logged in.
  @Get()
  async get() {
    return this.settingsService.get();
  }

  @Post('admin')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminUpdate(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.adminUpdate(dto);
  }
}
