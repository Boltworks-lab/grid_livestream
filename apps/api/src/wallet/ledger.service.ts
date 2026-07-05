import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountOwnerType,
  Currency,
  EntryDirection,
  LedgerTxKind,
  Prisma,
  type Account,
  type LedgerTransaction,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface EntryInput {
  accountId: string;
  direction: EntryDirection;
  amount: bigint;
}

export interface PostTransactionInput {
  kind: LedgerTxKind;
  /** replay-safe: posting the same key twice returns the original transaction */
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  entries: EntryInput[];
}

/**
 * The wallet's double-entry core (PROJECT_BRIEF §3.1 — never weaken):
 *  - entries are immutable rows (DB triggers forbid UPDATE/DELETE);
 *  - every transaction balances per currency (debits == credits);
 *  - balances are DERIVED (credits − debits), never stored-and-mutated;
 *  - money mutations are idempotent and wrapped in one DB transaction;
 *  - debited user/creator accounts are row-locked so concurrent spends
 *    cannot overdraw.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  getOrCreateAccount(
    ownerType: AccountOwnerType,
    ownerId: string,
    currency: Currency,
  ): Promise<Account> {
    return this.prisma.account.upsert({
      where: { ownerType_ownerId_currency: { ownerType, ownerId, currency } },
      create: { ownerType, ownerId, currency },
      update: {},
    });
  }

  platformAccount(currency: Currency): Promise<Account> {
    return this.getOrCreateAccount('PLATFORM', 'platform', currency);
  }

  /** Derived balance: credits − debits. */
  async balance(accountId: string, tx: Prisma.TransactionClient = this.prisma): Promise<bigint> {
    const groups = await tx.ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountId },
      _sum: { amount: true },
    });
    let credit = 0n;
    let debit = 0n;
    for (const g of groups) {
      if (g.direction === 'CREDIT') credit = g._sum.amount ?? 0n;
      else debit = g._sum.amount ?? 0n;
    }
    return credit - debit;
  }

  async post(input: PostTransactionInput): Promise<LedgerTransaction> {
    if (input.entries.length < 2) {
      throw new BadRequestException('a transaction needs at least two entries');
    }
    if (input.entries.some((e) => e.amount <= 0n)) {
      throw new BadRequestException('entry amounts must be positive');
    }

    const accountIds = [...new Set(input.entries.map((e) => e.accountId))];
    const accounts = await this.prisma.account.findMany({ where: { id: { in: accountIds } } });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('unknown account in entries');
    }
    const byId = new Map(accounts.map((a) => [a.id, a]));

    // debits must equal credits per currency
    const perCurrency = new Map<Currency, bigint>();
    for (const entry of input.entries) {
      const account = byId.get(entry.accountId)!;
      const sign = entry.direction === 'CREDIT' ? entry.amount : -entry.amount;
      perCurrency.set(account.currency, (perCurrency.get(account.currency) ?? 0n) + sign);
    }
    for (const [currency, sum] of perCurrency) {
      if (sum !== 0n) {
        throw new BadRequestException(`unbalanced transaction for ${currency}: ${sum}`);
      }
    }

    // accounts whose owners could overdraw get locked and checked
    const guarded = [...accountIds]
      .filter((id) => byId.get(id)!.ownerType !== 'PLATFORM')
      .filter((id) => input.entries.some((e) => e.accountId === id && e.direction === 'DEBIT'))
      .sort(); // stable lock order avoids deadlocks

    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const id of guarded) {
          await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id}::uuid FOR UPDATE`;
        }
        for (const id of guarded) {
          const current = await this.balance(id, tx);
          const debited = input.entries
            .filter((e) => e.accountId === id)
            .reduce((sum, e) => sum + (e.direction === 'DEBIT' ? e.amount : -e.amount), 0n);
          if (current < debited) {
            throw new UnprocessableEntityException('insufficient balance');
          }
        }
        return tx.ledgerTransaction.create({
          data: {
            kind: input.kind,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata,
            entries: {
              create: input.entries.map((e) => ({
                accountId: e.accountId,
                direction: e.direction,
                amount: e.amount,
              })),
            },
          },
        });
      });
    } catch (error) {
      // replay of an already-processed idempotency key → return the original
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('idempotencyKey')
      ) {
        const existing = await this.prisma.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
        throw new ConflictException('idempotency key conflict');
      }
      throw error;
    }
  }
}
