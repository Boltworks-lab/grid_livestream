import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GatesService } from './gates.service';

const inviteSchema = z.object({ handle: z.string().trim().toLowerCase().min(3).max(24) });

@Controller()
export class GatesController {
  constructor(private readonly gates: GatesService) {}

  /** Money moves here — throttled on top of the deterministic idempotency key. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('gates/:streamId/unlock')
  @HttpCode(201)
  unlock(
    @CurrentUser() user: AccessTokenPayload,
    @Param('streamId', ParseUUIDPipe) streamId: string,
  ) {
    return this.gates.unlock(user.sub, streamId);
  }

  @Post('streams/:id/invites')
  @HttpCode(204)
  async invite(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) streamId: string,
    @Body(new ZodValidationPipe(inviteSchema)) body: { handle: string },
  ) {
    await this.gates.invite(user.sub, streamId, body.handle);
  }
}
