import { computeSplit } from '@grid/shared';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import StripeClient from 'stripe';

import { env } from '../config/env';
import { EconomicsService } from '../economics/economics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * Subscriptions via Stripe Billing (ADR 0005). Creators set their own monthly
 * price; viewers pay real fiat through Stripe; each paid invoice credits the
 * creator COINS = floor(amountPaid / coinPeg) split by the subscription fee
 * (rounding favors the creator). Only the coin credit is ledgered — the fiat
 * lives in Stripe, exactly like top-ups (§3.1/§3.3). Crediting happens ONLY
 * from the signed webhook, exactly once per invoice.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly stripe: StripeClient | null = env.STRIPE_SECRET_KEY
    ? new StripeClient(env.STRIPE_SECRET_KEY)
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly economics: EconomicsService,
    private readonly notifications: NotificationsService,
  ) {}

  private requireStripe(): StripeClient {
    if (!this.stripe) throw new ServiceUnavailableException('payments are not configured');
    return this.stripe;
  }

  /** Creator sets/updates/clears their monthly subscription price. */
  async setPrice(creatorId: string, priceCents: number | null) {
    await this.prisma.creatorProfile.upsert({
      where: { userId: creatorId },
      create: { userId: creatorId, subPriceCents: priceCents },
      update: { subPriceCents: priceCents },
    });
    return { priceCents };
  }

  async statusFor(viewerId: string, creatorId: string) {
    const [sub, profile] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { viewerId_creatorId: { viewerId, creatorId } },
      }),
      this.prisma.creatorProfile.findUnique({ where: { userId: creatorId } }),
    ]);
    return {
      creatorId,
      active: sub?.status === 'ACTIVE',
      renewsAt: sub?.renewsAt?.toISOString() ?? null,
      priceCents: profile?.subPriceCents ?? null,
    };
  }

  /** Viewer subscribes → Stripe Checkout (mode: subscription). */
  async createCheckout(viewerId: string, viewerEmail: string | null, creatorId: string) {
    const stripe = this.requireStripe();
    if (viewerId === creatorId) throw new BadRequestException('cannot subscribe to yourself');
    const [creator, creatorProfile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: creatorId } }),
      this.prisma.creatorProfile.findUnique({ where: { userId: creatorId } }),
    ]);
    if (!creator) throw new NotFoundException('creator not found');
    if (!creatorProfile?.subPriceCents) {
      throw new BadRequestException('this creator has not enabled subscriptions');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: creatorProfile.subPriceCents, // creator-set (§3.2)
            recurring: { interval: 'month' },
            product_data: { name: `Subscription to @${creator.handle}` },
          },
        },
      ],
      client_reference_id: viewerId,
      ...(viewerEmail ? { customer_email: viewerEmail } : {}),
      // metadata on BOTH session and the subscription so every invoice carries it
      metadata: { viewerId, creatorId },
      subscription_data: { metadata: { viewerId, creatorId } },
      success_url: `${env.TOPUP_RETURN_ORIGIN}/?sub=success`,
      cancel_url: `${env.TOPUP_RETURN_ORIGIN}/?sub=cancelled`,
    });
    if (!session.url) throw new ServiceUnavailableException('stripe returned no checkout url');
    return { checkoutUrl: session.url };
  }

  async cancel(viewerId: string, creatorId: string) {
    const stripe = this.requireStripe();
    const sub = await this.prisma.subscription.findUnique({
      where: { viewerId_creatorId: { viewerId, creatorId } },
    });
    if (!sub?.providerRef) throw new NotFoundException('no active subscription');
    // cancel at period end — they keep access until the current period lapses
    await stripe.subscriptions.update(sub.providerRef, { cancel_at_period_end: true });
    return { canceled: true };
  }

  // ── webhook-driven crediting (the only path money moves, §3.3) ──────────────

  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Stripe SDK v18 relocated the subscription ref/metadata under `parent`;
    // read defensively so we work across pinned API versions.
    const inv = invoice as Stripe.Invoice & {
      subscription?: string | { id: string };
      subscription_details?: { metadata?: Record<string, string> };
      parent?: {
        subscription_details?: { subscription?: string; metadata?: Record<string, string> };
      };
    };
    const subId =
      typeof inv.subscription === 'string'
        ? inv.subscription
        : (inv.subscription?.id ?? inv.parent?.subscription_details?.subscription);
    const meta =
      inv.subscription_details?.metadata ?? inv.parent?.subscription_details?.metadata ?? {};
    const viewerId = meta.viewerId;
    const creatorId = meta.creatorId;
    if (!subId || !viewerId || !creatorId) {
      this.logger.warn(`invoice ${invoice.id} missing subscription metadata`);
      return;
    }

    const { coinValueCents, fees } = await this.economics.current();
    const grossCoins = Math.floor(invoice.amount_paid / coinValueCents);
    const { creatorCoins, feeCoins } = computeSplit(grossCoins, fees.subscription);

    const [issuance, creatorAcct, revenue] = await Promise.all([
      this.ledger.platformAccount('COIN'),
      this.ledger.getOrCreateAccount('CREATOR', creatorId, 'COIN'),
      this.ledger.getOrCreateAccount('PLATFORM', 'platform_revenue', 'COIN'),
    ]);
    // one credit per invoice — replaying the webhook is a no-op (§3.3)
    await this.ledger.post({
      kind: 'SUB',
      idempotencyKey: `sub_invoice:${invoice.id}`,
      metadata: { viewerId, creatorId, amountPaidCents: invoice.amount_paid, feeCoins },
      entries: [
        { accountId: issuance.id, direction: 'DEBIT', amount: BigInt(grossCoins) },
        { accountId: creatorAcct.id, direction: 'CREDIT', amount: BigInt(creatorCoins) },
        { accountId: revenue.id, direction: 'CREDIT', amount: BigInt(feeCoins) },
      ],
    });

    const periodEnd = invoice.lines.data[0]?.period?.end;
    await this.prisma.subscription.upsert({
      where: { viewerId_creatorId: { viewerId, creatorId } },
      create: {
        viewerId,
        creatorId,
        status: 'ACTIVE',
        provider: 'STRIPE',
        providerRef: subId,
        renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
      update: {
        status: 'ACTIVE',
        providerRef: subId,
        renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
        canceledAt: null,
      },
    });
    await this.notifications.notify(
      creatorId,
      'new_subscriber',
      `You earned ${creatorCoins} coins from a subscription`,
      { viewerId },
    );
  }

  async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const { viewerId, creatorId } = subscription.metadata ?? {};
    if (!viewerId || !creatorId) return;
    await this.prisma.subscription.updateMany({
      where: { viewerId, creatorId },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
  }
}
