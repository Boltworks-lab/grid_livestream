import { updateProfileSchema, type UpdateProfileInput } from '@grid/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.users.me(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.users.updateMe(user.sub, body);
  }

  @Public()
  @Get(':handle')
  byHandle(@Param('handle') handle: string) {
    return this.users.byHandle(handle.toLowerCase());
  }

  @Post(':id/follow')
  @HttpCode(204)
  async follow(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) creatorId: string,
  ) {
    await this.users.follow(user.sub, creatorId);
  }

  @Delete(':id/follow')
  @HttpCode(204)
  async unfollow(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) creatorId: string,
  ) {
    await this.users.unfollow(user.sub, creatorId);
  }
}
