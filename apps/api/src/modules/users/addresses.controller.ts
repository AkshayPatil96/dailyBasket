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
import { Address } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.addressesService.list(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.addressesService.create(user.id, dto);
  }

  @Post('update')
  @HttpCode(200)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.addressesService.update(user.id, id, dto);
  }

  @Post('set-default')
  @HttpCode(200)
  async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
  ): Promise<Address> {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.addressesService.setDefault(user.id, id);
  }

  @Post('delete')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Query('id') id: string | undefined,
  ): Promise<{ success: boolean }> {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    await this.addressesService.remove(user.id, id);
    return { success: true };
  }
}
