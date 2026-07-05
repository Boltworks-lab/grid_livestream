import { sendGiftSchema, type SendGiftInput } from '@grid/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GiftsService } from './gifts.service';

@Controller()
export class GiftsController {
  constructor(private readonly gifts: GiftsService) {}

  @Public()
  @Get('gifts/catalog')
  catalog() {
    return this.gifts.catalog();
  }

  /** Gifting is rate-limited (§3.7) on top of the ledger's idempotency. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('streams/:id/gifts')
  send(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) streamId: string,
    @Body(new ZodValidationPipe(sendGiftSchema)) body: SendGiftInput,
  ) {
    return this.gifts.send(user.sub, user.handle, streamId, body);
  }

  @Public()
  @Get('streams/:id/top-gifters')
  topGifters(@Param('id', ParseUUIDPipe) streamId: string) {
    return this.gifts.topGifters(streamId);
  }
}
