import { DIAMOND_PACKAGES } from '@grid/shared';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * Webhooks are the ONLY path that credits money (PROJECT_BRIEF §3.3): verified
 * signature upstream, exactly-once crediting here via ledger idempotency keys
 * derived from the Stripe object id — Stripe retries and duplicate events
 * collapse into a single ledger transaction.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(event.data.object);
      case 'invoice.paid':
        return this.subscriptions.handleInvoicePaid(event.data.object);
      case 'customer.subscription.deleted':
        return this.subscriptions.handleSubscriptionCanceled(event.data.object);
      default:
        this.logger.debug(`ignoring stripe event ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // subscription checkouts are credited per-invoice (invoice.paid), not here
    if (session.mode === 'subscription') return;
    if (session.payment_status !== 'paid') {
      this.logger.warn(`checkout ${session.id} payment_status=${session.payment_status}`);
      return;
    }

    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    const pack = DIAMOND_PACKAGES.find((p) => p.id === packageId);
    if (!userId || !pack) {
      throw new BadRequestException(`checkout ${session.id} missing/unknown metadata`);
    }

    const amount = BigInt(pack.diamonds + pack.bonus);
    const [userAccount, issuance] = await Promise.all([
      this.ledger.getOrCreateAccount('USER', userId, 'DIAMOND'),
      this.ledger.platformAccount('DIAMOND'),
    ]);

    await this.ledger.post({
      kind: 'TOPUP',
      idempotencyKey: `stripe_session:${session.id}`,
      metadata: {
        provider: 'stripe',
        sessionId: session.id,
        packageId: pack.id,
        usdCents: pack.usdCents,
      },
      entries: [
        { accountId: userAccount.id, direction: 'CREDIT', amount },
        { accountId: issuance.id, direction: 'DEBIT', amount },
      ],
    });
    this.logger.log(`credited ${amount} diamonds to user ${userId} (session ${session.id})`);
  }
}
