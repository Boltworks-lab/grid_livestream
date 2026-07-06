import type { RequestPayoutInput } from '@grid/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Payout } from '@prisma/client';
import Stripe from 'stripe';

import { env } from '../config/env';
import { EconomicsService } from '../economics/economics.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * Phase 7 — coins → fiat via Stripe Connect Express (never hand-rolled, ADR 0001).
 * Requesting a payout debits coins into a platform clearing account immediately
 * (one ledger tx, client idempotency key); approval (admin queue — script until
 * Phase 8) triggers the Stripe transfer. A failed transfer refunds the coins with
 * a reversing ADJUSTMENT so the ledger always tells the truth.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly economics: EconomicsService,
  ) {}

  private requireStripe(): Stripe {
    if (!this.stripe) throw new ServiceUnavailableException('payments are not configured');
    return this.stripe;
  }

  private async getOrCreateProfile(userId: string) {
    const { payoutHoldDays } = await this.economics.current();
    return this.prisma.creatorProfile.upsert({
      where: { userId },
      create: {
        userId,
        payoutHoldUntil: new Date(Date.now() + payoutHoldDays * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  }

  /** Create (or resume) Stripe Connect Express onboarding; returns the hosted URL. */
  async onboard(userId: string): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const profile = await this.getOrCreateProfile(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    let accountId = profile.stripeConnectId;
    try {
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: user.country ?? 'US',
          metadata: { userId },
        });
        accountId = account.id;
        await this.prisma.creatorProfile.update({
          where: { userId },
          data: { stripeConnectId: accountId, kycStatus: 'PENDING' },
        });
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: `${env.TOPUP_RETURN_ORIGIN}/me?connect=refresh`,
        return_url: `${env.TOPUP_RETURN_ORIGIN}/me?connect=done`,
      });
      return { url: link.url };
    } catch (error) {
      this.logger.warn(`connect onboarding failed: ${String(error)}`);
      throw new ServiceUnavailableException(
        'Stripe Connect is not enabled on this account yet — enable it in the Stripe dashboard (docs/deferred.md)',
      );
    }
  }

  async status(userId: string) {
    const [profile, economics] = await Promise.all([
      this.prisma.creatorProfile.findUnique({ where: { userId } }),
      this.economics.current(),
    ]);
    let payoutsEnabled = false;
    if (profile?.stripeConnectId && this.stripe) {
      try {
        const account = await this.stripe.accounts.retrieve(profile.stripeConnectId);
        payoutsEnabled = account.payouts_enabled === true;
        const kycStatus = payoutsEnabled ? 'VERIFIED' : 'PENDING';
        if (profile.kycStatus !== kycStatus) {
          await this.prisma.creatorProfile.update({ where: { userId }, data: { kycStatus } });
        }
      } catch (error) {
        this.logger.warn(`connect status check failed: ${String(error)}`);
      }
    }
    return {
      connected: Boolean(profile?.stripeConnectId),
      payoutsEnabled,
      kycStatus: profile?.kycStatus ?? 'NONE',
      holdUntil: profile?.payoutHoldUntil?.toISOString() ?? null,
      minPayoutCoins: economics.minPayoutCoins,
      coinValueCents: economics.coinValueCents,
    };
  }

  async request(userId: string, input: RequestPayoutInput): Promise<Payout> {
    const economics = await this.economics.current();
    if (input.coinAmount < economics.minPayoutCoins) {
      throw new BadRequestException(`minimum payout is ${economics.minPayoutCoins} coins`);
    }
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile?.stripeConnectId) {
      throw new BadRequestException('set up payouts first (Stripe Connect onboarding)');
    }
    if (profile.payoutHoldUntil && profile.payoutHoldUntil > new Date()) {
      throw new ForbiddenException(
        `new-creator payout hold until ${profile.payoutHoldUntil.toISOString()}`,
      );
    }

    const [creatorAcct, clearing] = await Promise.all([
      this.ledger.getOrCreateAccount('CREATOR', userId, 'COIN'),
      this.ledger.getOrCreateAccount('PLATFORM', 'payout_clearing', 'COIN'),
    ]);
    // insufficient balance surfaces as 422 from the ledger's row-locked check
    const tx = await this.ledger.post({
      kind: 'PAYOUT',
      idempotencyKey: `payout:${input.idempotencyKey}`,
      metadata: { userId, coinAmount: input.coinAmount, coinValueCents: economics.coinValueCents },
      entries: [
        { accountId: creatorAcct.id, direction: 'DEBIT', amount: BigInt(input.coinAmount) },
        { accountId: clearing.id, direction: 'CREDIT', amount: BigInt(input.coinAmount) },
      ],
    });

    const existing = await this.prisma.payout.findUnique({ where: { ledgerTransactionId: tx.id } });
    if (existing) return existing; // idempotent replay

    return this.prisma.payout.create({
      data: {
        creatorId: userId,
        coinAmount: BigInt(input.coinAmount),
        fiatAmountCents: input.coinAmount * economics.coinValueCents,
        ledgerTransactionId: tx.id,
      },
    });
  }

  listMine(userId: string) {
    return this.prisma.payout.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /** Admin approval (Phase 8 UI; scripts/approve-payout until then). */
  async approve(payoutId: string, staffId: string): Promise<Payout> {
    const stripe = this.requireStripe();
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { creator: true },
    });
    if (!payout) throw new NotFoundException('payout not found');
    if (payout.status !== 'REQUESTED') {
      throw new BadRequestException(`payout is ${payout.status}`);
    }
    if (!payout.creator.stripeConnectId) throw new BadRequestException('creator not onboarded');

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'PROCESSING', reviewedByStaffId: staffId },
    });

    try {
      const transfer = await stripe.transfers.create({
        amount: payout.fiatAmountCents,
        currency: payout.fiatCurrency,
        destination: payout.creator.stripeConnectId,
        metadata: { payoutId },
      });
      const done = await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'PAID', providerRef: transfer.id, processedAt: new Date() },
      });
      await this.audit(staffId, 'payout.approve', payoutId, { transfer: transfer.id });
      return done;
    } catch (error) {
      // refund the coins with a reversing tx — the ledger must reflect reality
      const [creatorAcct, clearing] = await Promise.all([
        this.ledger.getOrCreateAccount('CREATOR', payout.creatorId, 'COIN'),
        this.ledger.getOrCreateAccount('PLATFORM', 'payout_clearing', 'COIN'),
      ]);
      await this.ledger.post({
        kind: 'ADJUSTMENT',
        idempotencyKey: `payout_refund:${payoutId}`,
        metadata: { payoutId, reason: 'transfer_failed' },
        entries: [
          { accountId: clearing.id, direction: 'DEBIT', amount: payout.coinAmount },
          { accountId: creatorAcct.id, direction: 'CREDIT', amount: payout.coinAmount },
        ],
      });
      const failed = await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'FAILED', failureReason: String(error).slice(0, 500) },
      });
      await this.audit(staffId, 'payout.transfer_failed', payoutId, { error: String(error) });
      return failed;
    }
  }

  private audit(staffId: string, action: string, targetId: string, after: object) {
    return this.prisma.auditLog.create({
      data: { staffId, action, targetType: 'payout', targetId, after },
    });
  }
}
