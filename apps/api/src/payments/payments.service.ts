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

    await this.creditDiamonds(userId, pack.id, `stripe_session:${session.id}`, {
      provider: 'stripe',
      sessionId: session.id,
      usdCents: pack.usdCents,
    });
  }

  /**
   * RevenueCat webhook (mobile IAP, §3.3). Same contract as Stripe: verified
   * (Authorization header) upstream, credited exactly once here. The store
   * product id maps to a diamond package by id (set the RevenueCat product id
   * to the package id, e.g. "d1000"); idempotent on the RevenueCat event id.
   */
  async handleRevenueCatEvent(event: {
    id?: string;
    type?: string;
    app_user_id?: string;
    product_id?: string;
  }): Promise<void> {
    const CREDIT_TYPES = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL']);
    if (!event.type || !CREDIT_TYPES.has(event.type)) {
      this.logger.debug(`ignoring revenuecat event ${event.type}`);
      return;
    }
    const userId = event.app_user_id;
    const pack = DIAMOND_PACKAGES.find((p) => p.id === event.product_id);
    if (!userId || !pack || !event.id) {
      throw new BadRequestException(`revenuecat event ${event.id} missing/unknown fields`);
    }
    await this.creditDiamonds(userId, pack.id, `revenuecat_event:${event.id}`, {
      provider: 'revenuecat',
      eventId: event.id,
      productId: pack.id,
    });
  }

  /** Shared crediting path — the only place diamonds are minted (§3.1/§3.3). */
  private async creditDiamonds(
    userId: string,
    packageId: string,
    idempotencyKey: string,
    metadata: Record<string, string | number>,
  ): Promise<void> {
    const pack = DIAMOND_PACKAGES.find((p) => p.id === packageId);
    if (!pack) throw new BadRequestException(`unknown package ${packageId}`);
    const amount = BigInt(pack.diamonds + pack.bonus);
    const [userAccount, issuance] = await Promise.all([
      this.ledger.getOrCreateAccount('USER', userId, 'DIAMOND'),
      this.ledger.platformAccount('DIAMOND'),
    ]);
    await this.ledger.post({
      kind: 'TOPUP',
      idempotencyKey,
      metadata: { ...metadata, packageId: pack.id },
      entries: [
        { accountId: userAccount.id, direction: 'CREDIT', amount },
        { accountId: issuance.id, direction: 'DEBIT', amount },
      ],
    });
    this.logger.log(`credited ${amount} diamonds to user ${userId} (${idempotencyKey})`);
  }
}
