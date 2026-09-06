import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ProductViewsService } from './product-views.service';
import { RecordViewDto } from './dto/record-view.dto';

// Auth-only — a guest's browsing history isn't persisted (see ProductView
// model comment), so there's nothing for a guest to call here.
@Controller('product-views')
@UseGuards(JwtAuthGuard)
export class ProductViewsController {
  constructor(private readonly productViewsService: ProductViewsService) {}

  @Post()
  @HttpCode(200)
  async record(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordViewDto) {
    await this.productViewsService.record(user.id, dto.productId);
    return { success: true };
  }

  @Get('recent')
  async listRecent(@CurrentUser() user: AuthenticatedUser) {
    return this.productViewsService.listRecent(user.id);
  }
}
