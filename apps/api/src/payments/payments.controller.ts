import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import Stripe from 'stripe';

import { Public } from '../auth/public.decorator';
import { env } from '../config/env';
import { PaymentsService } from './payments.service';

// Signature-verified webhooks: never rate-limit Stripe's retry bursts, or a
// spike of legitimate events would be dropped and payments lost.
@SkipThrottle()
@Public()
@Controller('payments')
export class PaymentsController {
  private readonly stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

  constructor(private readonly payments: PaymentsService) {}

  @Post('webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!this.stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException('stripe webhook is not configured');
    }
    if (!signature || !req.rawBody) {
      throw new BadRequestException('missing signature or raw body');
    }

    let event: Stripe.Event;
    try {
      // signature-checked, always (§3.3) — reject anything unverifiable
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new BadRequestException('invalid stripe signature');
    }

    await this.payments.handleStripeEvent(event);
    return { received: true };
  }
}
