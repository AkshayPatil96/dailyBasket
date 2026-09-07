import { BadRequestException, Body, Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

const DEFAULT_LIMIT = 20;

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('list')
  @HttpCode(200)
  async list(@CurrentUser() user: AuthenticatedUser, @Body() dto: ListNotificationsDto) {
    return this.notificationsService.listForUser(user.id, dto.offset ?? 0, dto.limit ?? DEFAULT_LIMIT);
  }

  @Post('mark-read')
  @HttpCode(200)
  async markRead(@CurrentUser() user: AuthenticatedUser, @Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    await this.notificationsService.markRead(user.id, id);
    return { success: true };
  }

  @Post('mark-all-read')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.notificationsService.markAllRead(user.id);
    return { success: true };
  }
}
