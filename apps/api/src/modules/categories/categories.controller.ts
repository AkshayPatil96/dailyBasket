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
import { Category } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CategoriesService, type CategoryTreeNode } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('tree')
  async tree(): Promise<CategoryTreeNode[]> {
    return this.categoriesService.tree();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listAll(): Promise<Category[]> {
    return this.categoriesService.listAll();
  }

  @Get()
  async findOne(
    @Query('id') id?: string,
    @Query('slug') slug?: string,
  ): Promise<Category> {
    return this.categoriesService.findOne(id, slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    return this.categoriesService.create(dto, user.role);
  }

  @Post('update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Query('id') id: string | undefined,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.categoriesService.update(id, dto, user.role);
  }

  @Post('delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(
    @Query('id') id: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    await this.categoriesService.remove(id, user.role);
    return { success: true };
  }
}
