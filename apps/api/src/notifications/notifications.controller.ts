import { Controller, Get, HttpCode, Post } from '@nestjs/common';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.list(user.sub);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AccessTokenPayload) {
    await this.notifications.markAllRead(user.sub);
  }
}
