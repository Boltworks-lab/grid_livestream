/* eslint-disable @typescript-eslint/no-explicit-any -- test wiring casts */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import fc from 'fast-check';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PaymentsService } from '../payments/payments.service';
import { LedgerService } from './ledger.service';

/**
 * Ledger invariants on a REAL Postgres (PROJECT_BRIEF §10: Testcontainers,
 * property-based double-entry tests; §3.1 hard rules). Slow by design — one
 * throwaway database per run, the same triggers/CHECKs as production.
 */

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let ledger: LedgerService;

async function globalNet(currency: 'DIAMOND' | 'COIN'): Promise<bigint> {
  const rows = await prisma.$queryRaw<{ net: bigint | null }[]>`
    SELECT SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END)::bigint AS net
    FROM ledger_entries e JOIN accounts a ON a.id = e."accountId"
    WHERE a.currency = ${currency}::"Currency"`;
  return rows[0]?.net ?? 0n;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  const url = container.getConnectionUri();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  prisma = new PrismaClient({ datasources: { db: { url } } });
  ledger = new LedgerService(prisma as any);
}, 240_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

describe('LedgerService invariants (real Postgres)', () => {
  it('property: balanced transfers always preserve the global zero-sum', async () => {
    const a = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const b = await ledger.platformAccount('DIAMOND');
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 5 }),
        async (amounts) => {
          for (const n of amounts) {
            await ledger.post({
              kind: 'ADJUSTMENT',
              idempotencyKey: `prop:${randomUUID()}`,
              entries: [
                { accountId: a.id, direction: 'CREDIT', amount: BigInt(n) },
                { accountId: b.id, direction: 'DEBIT', amount: BigInt(n) },
              ],
            });
          }
          expect(await globalNet('DIAMOND')).toBe(0n);
        },
      ),
      { numRuns: 10 },
    );
  }, 120_000);

  it('rejects unbalanced transactions', async () => {
    const a = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const b = await ledger.platformAccount('DIAMOND');
    await expect(
      ledger.post({
        kind: 'ADJUSTMENT',
        idempotencyKey: `bad:${randomUUID()}`,
        entries: [
          { accountId: a.id, direction: 'CREDIT', amount: 5n },
          { accountId: b.id, direction: 'DEBIT', amount: 3n },
        ],
      }),
    ).rejects.toThrow(/unbalanced/);
  });

  it('replays of the same idempotency key return the original transaction', async () => {
    const a = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const b = await ledger.platformAccount('DIAMOND');
    const key = `replay:${randomUUID()}`;
    const input = {
      kind: 'TOPUP' as const,
      idempotencyKey: key,
      entries: [
        { accountId: a.id, direction: 'CREDIT' as const, amount: 100n },
        { accountId: b.id, direction: 'DEBIT' as const, amount: 100n },
      ],
    };
    const first = await ledger.post(input);
    const second = await ledger.post(input);
    expect(second.id).toBe(first.id);
    expect(await prisma.ledgerEntry.count({ where: { transactionId: first.id } })).toBe(2);
    expect(await ledger.balance(a.id)).toBe(100n);
  });

  it('collapses CONCURRENT replays of one key into a single transaction', async () => {
    const a = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const b = await ledger.platformAccount('DIAMOND');
    const key = `concurrent:${randomUUID()}`;
    const post = () =>
      ledger.post({
        kind: 'TOPUP',
        idempotencyKey: key,
        entries: [
          { accountId: a.id, direction: 'CREDIT', amount: 500n },
          { accountId: b.id, direction: 'DEBIT', amount: 500n },
        ],
      });
    const results = await Promise.allSettled([post(), post(), post(), post(), post()]);
    const ids = new Set(
      results.filter((r) => r.status === 'fulfilled').map((r: any) => r.value.id as string),
    );
    expect(ids.size).toBe(1);
    expect(await ledger.balance(a.id)).toBe(500n);
  });

  it('replays return the original transaction even after the balance dropped', async () => {
    const user = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const platform = await ledger.platformAccount('DIAMOND');
    await ledger.post({
      kind: 'TOPUP',
      idempotencyKey: `seed2:${randomUUID()}`,
      entries: [
        { accountId: user.id, direction: 'CREDIT', amount: 100n },
        { accountId: platform.id, direction: 'DEBIT', amount: 100n },
      ],
    });
    const spendInput = {
      kind: 'ADJUSTMENT' as const,
      idempotencyKey: `spent:${randomUUID()}`,
      entries: [
        { accountId: user.id, direction: 'DEBIT' as const, amount: 80n },
        { accountId: platform.id, direction: 'CREDIT' as const, amount: 80n },
      ],
    };
    const original = await ledger.post(spendInput);
    // balance is now 20 — a NAIVE implementation would 422 the replay because
    // the balance check runs before the conflict is discovered
    const replayed = await ledger.post(spendInput);
    expect(replayed.id).toBe(original.id);
    expect(await ledger.balance(user.id)).toBe(20n);
  });

  it('row locks prevent concurrent overdraw of a user account', async () => {
    const user = await ledger.getOrCreateAccount('USER', randomUUID(), 'DIAMOND');
    const platform = await ledger.platformAccount('DIAMOND');
    await ledger.post({
      kind: 'TOPUP',
      idempotencyKey: `seed:${randomUUID()}`,
      entries: [
        { accountId: user.id, direction: 'CREDIT', amount: 100n },
        { accountId: platform.id, direction: 'DEBIT', amount: 100n },
      ],
    });
    const spend = () =>
      ledger.post({
        kind: 'ADJUSTMENT',
        idempotencyKey: `spend:${randomUUID()}`,
        entries: [
          { accountId: user.id, direction: 'DEBIT', amount: 80n },
          { accountId: platform.id, direction: 'CREDIT', amount: 80n },
        ],
      });
    const results = await Promise.allSettled([spend(), spend()]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect(await ledger.balance(user.id)).toBe(20n);
  });

  it('credits a stripe checkout session exactly once across webhook retries', async () => {
    // top-up path doesn't touch subscriptions; stub it
    const payments = new PaymentsService(ledger, {} as never);
    const userId = randomUUID();
    const sessionId = `cs_test_${randomUUID().replaceAll('-', '')}`;
    const event = {
      id: `evt_${randomUUID().replaceAll('-', '')}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          payment_status: 'paid',
          metadata: { userId, packageId: 'd1000' },
        },
      },
    } as unknown as Stripe.Event;

    await payments.handleStripeEvent(event);
    await payments.handleStripeEvent(event); // retry
    await payments.handleStripeEvent({
      ...event,
      id: `evt_${randomUUID().replaceAll('-', '')}`,
    } as any); // duplicate under a new event id

    const account = await ledger.getOrCreateAccount('USER', userId, 'DIAMOND');
    expect(await ledger.balance(account.id)).toBe(1000n);
  });
});

describe('stripe webhook signatures (offline)', () => {
  const stripe = new Stripe('sk_test_dummy');
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

  it('accepts a correctly signed payload and rejects a wrong secret', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => stripe.webhooks.constructEvent(payload, header, secret)).not.toThrow();
    expect(() => stripe.webhooks.constructEvent(payload, header, 'whsec_wrong')).toThrow();
  });
});
