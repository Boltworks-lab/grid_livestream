import { createStreamSchema, type CreateStreamInput } from '@grid/shared';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatService } from '../chat/chat.service';
import { StreamsService } from './streams.service';

@Controller('streams')
export class StreamsController {
  constructor(
    private readonly streams: StreamsService,
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
  ) {}

  /** Public feed; entitlement flags are computed for the caller when a token is present. */
  @Public()
  @Get()
  async feed(
    @Req() req: Request,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.streams.feed(await this.optionalUserId(req), category, cursor);
  }

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createStreamSchema)) body: CreateStreamInput,
  ) {
    return this.streams.create(user.sub, body);
  }

  @Public()
  @Get(':id')
  async detail(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.streams.detail(id, await this.optionalUserId(req));
  }

  @Post(':id/go-live')
  async goLive(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    const stream = await this.streams.goLive(id, user.sub);
    this.chat.broadcastStreamStatus(stream.id, 'live');
    return stream;
  }

  @Post(':id/end')
  @HttpCode(204)
  async end(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    const stream = await this.streams.end(id, user.sub);
    this.chat.broadcastStreamStatus(stream.id, 'ended');
  }

  @Post(':id/token')
  token(@CurrentUser() user: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.streams.token(id, user.sub, user.handle);
  }

  /** Creator moderation: hide a chat message in your own stream (brief Phase 4). */
  @Delete(':id/chat/:messageId')
  @HttpCode(204)
  async removeChatMessage(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId') messageId: string,
  ) {
    const stream = await this.streams.byId(id);
    // full staff moderation arrives in Phase 8; creators moderate their own room
    if (stream.creatorId !== user.sub) throw new ForbiddenException('not your stream');
    await this.chat.removeMessage(id, messageId);
  }

  private async optionalUserId(req: Request): Promise<string | null> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7));
      return payload.sub;
    } catch {
      return null;
    }
  }
}
