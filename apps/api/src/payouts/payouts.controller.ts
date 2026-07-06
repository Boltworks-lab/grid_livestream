import { requestPayoutSchema, type RequestPayoutInput } from '@grid/shared';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PayoutsService } from './payouts.service';

/** Payout endpoints are rate-limited hard (§3.7). */
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post('connect/onboard')
  onboard(@CurrentUser() user: AccessTokenPayload) {
    return this.payouts.onboard(user.sub);
  }

  @Get('connect/status')
  status(@CurrentUser() user: AccessTokenPayload) {
    return this.payouts.status(user.sub);
  }

  @Post()
  async request(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(requestPayoutSchema)) body: RequestPayoutInput,
  ) {
    const payout = await this.payouts.request(user.sub, body);
    return serialize(payout);
  }

  @Get()
  async list(@CurrentUser() user: AccessTokenPayload) {
    return (await this.payouts.listMine(user.sub)).map(serialize);
  }
}

function serialize(p: {
  id: string;
  coinAmount: bigint;
  fiatAmountCents: number;
  fiatCurrency: string;
  status: string;
  failureReason: string | null;
  createdAt: Date;
}) {
  return {
    id: p.id,
    coinAmount: Number(p.coinAmount),
    fiatAmountCents: p.fiatAmountCents,
    fiatCurrency: p.fiatCurrency,
    status: p.status,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
  };
}
