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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { AdminListProductsDto } from './dto/admin-list-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findOne(@Query('id') id?: string, @Query('slug') slug?: string) {
    return this.productsService.findOne(id, slug);
  }

  @Post('list')
  @HttpCode(200)
  async list(@Body() dto: ListProductsDto) {
    return this.productsService.list(dto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminFindOne(@Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.productsService.adminFindOne(id);
  }

  @Post('admin/list')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminList(@Body() dto: AdminListProductsDto) {
    return this.productsService.adminList(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.create(dto, user.role);
  }

  @Post('update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Query('id') id: string | undefined,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.productsService.update(id, dto, user.role);
  }

  @Post('delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(
    @Query('id') id: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    await this.productsService.remove(id, user.role);
    return { success: true };
  }

  @Post('variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createVariant(
    @Body() dto: CreateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.createVariant(dto, user.role);
  }

  @Post('variants/update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateVariant(
    @Query('id') id: string | undefined,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.productsService.updateVariant(id, dto, user.role);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addImage(
    @Body() dto: CreateProductImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.addImage(dto, user.role);
  }

  @Post('images/delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async removeImage(
    @Query('id') id: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    await this.productsService.removeImage(id, user.role);
    return { success: true };
  }
}
