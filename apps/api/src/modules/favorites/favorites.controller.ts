import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { FavoritesService } from './favorites.service';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';

// Auth-only — no guest favorites, see the Favorite model comment.
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.list(user.id);
  }

  @Get('ids')
  async listIds(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.listIds(user.id);
  }

  @Post()
  async add(@CurrentUser() user: AuthenticatedUser, @Body() dto: ToggleFavoriteDto) {
    await this.favoritesService.add(user.id, dto.productId);
    return { success: true };
  }

  @Post('remove')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthenticatedUser, @Body() dto: ToggleFavoriteDto) {
    await this.favoritesService.remove(user.id, dto.productId);
    return { success: true };
  }
}
