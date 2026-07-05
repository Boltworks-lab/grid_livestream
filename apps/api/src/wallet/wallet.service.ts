import {
  DIAMOND_PACKAGES,
  type DiamondPackageId,
  type WalletBalances,
  type WalletTransaction,
} from '@grid/shared';
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';

@Injectable()
export class WalletService {
  private readonly stripe: Stripe | null = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY)
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async balances(userId: string): Promise<WalletBalances> {
    const [diamondAccount, coinAccount] = await Promise.all([
      this.prisma.account.findUnique({
        where: {
          ownerType_ownerId_currency: { ownerType: 'USER', ownerId: userId, currency: 'DIAMOND' },
        },
      }),
      this.prisma.account.findUnique({
        where: {
          ownerType_ownerId_currency: { ownerType: 'CREATOR', ownerId: userId, currency: 'COIN' },
        },
      }),
    ]);
    const [diamonds, coins] = await Promise.all([
      diamondAccount ? this.ledger.balance(diamondAccount.id) : Promise.resolve(0n),
      coinAccount ? this.ledger.balance(coinAccount.id) : Promise.resolve(0n),
    ]);
    return { diamonds: Number(diamonds), coins: Number(coins) };
  }

  async transactions(
    userId: string,
    cursor?: string,
  ): Promise<{ items: WalletTransaction[]; nextCursor: string | null }> {
    const accounts = await this.prisma.account.findMany({
      where: { ownerId: userId, ownerType: { in: ['USER', 'CREATOR'] } },
      select: { id: true, currency: true },
    });
    if (accounts.length === 0) return { items: [], nextCursor: null };
    const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency]));

    const take = 20;
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId: { in: accounts.map((a) => a.id) } },
      include: { transaction: true },
      orderBy: { id: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = entries.slice(0, take);
    return {
      items: page.map((e) => ({
        id: e.transaction.id,
        kind: e.transaction.kind,
        amount: Number(e.direction === 'CREDIT' ? e.amount : -e.amount),
        currency: currencyByAccount.get(e.accountId)!,
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor: entries.length > take ? page[page.length - 1].id : null,
    };
  }

  async createTopupCheckout(userId: string, packageId: DiamondPackageId): Promise<string> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('payments are not configured (STRIPE_SECRET_KEY)');
    }
    const pack = DIAMOND_PACKAGES.find((p) => p.id === packageId);
    if (!pack) throw new NotFoundException('unknown package');

    const total = pack.diamonds + pack.bonus;
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.usdCents, // server-authoritative price (§3.2)
            product_data: {
              name: `${total.toLocaleString('en-US')} diamonds`,
              description: pack.bonus > 0 ? `${pack.diamonds} + ${pack.bonus} bonus` : undefined,
            },
          },
        },
      ],
      client_reference_id: userId,
      metadata: { userId, packageId: pack.id },
      success_url: `${env.TOPUP_RETURN_ORIGIN}/?topup=success`,
      cancel_url: `${env.TOPUP_RETURN_ORIGIN}/?topup=cancelled`,
    });
    if (!session.url) throw new ServiceUnavailableException('stripe returned no checkout url');
    return session.url;
  }
}
