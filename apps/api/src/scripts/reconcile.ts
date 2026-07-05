import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

/**
 * Monthly ledger reconciliation (PROJECT_BRIEF §7): the books must balance to
 * zero. Non-zero exit on any violation so it can gate cron/CI. Run with
 * `pnpm --filter @grid/api reconcile` (after build).
 */
async function main() {
  const prisma = new PrismaClient();
  let violations = 0;

  const global = await prisma.$queryRaw<{ currency: string; net: bigint }[]>`
    SELECT a.currency::text AS currency,
           COALESCE(SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END), 0)::bigint AS net
    FROM ledger_entries e JOIN accounts a ON a.id = e."accountId"
    GROUP BY a.currency`;
  for (const row of global) {
    const ok = row.net === 0n;
    if (!ok) violations++;
    console.log(`[global] ${row.currency}: net=${row.net} ${ok ? 'OK' : 'VIOLATION'}`);
  }

  const unbalanced = await prisma.$queryRaw<{ transactionId: string }[]>`
    SELECT e."transactionId"
    FROM ledger_entries e JOIN accounts a ON a.id = e."accountId"
    GROUP BY e."transactionId", a.currency
    HAVING SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END) <> 0`;
  if (unbalanced.length > 0) {
    violations += unbalanced.length;
    console.log(`[per-tx] ${unbalanced.length} unbalanced transaction(s):`);
    unbalanced.forEach((t) => console.log(`  - ${t.transactionId}`));
  } else {
    console.log('[per-tx] every transaction balances OK');
  }

  const negative = await prisma.$queryRaw<{ id: string; ownerType: string; net: bigint }[]>`
    SELECT a.id, a."ownerType"::text AS "ownerType",
           SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END)::bigint AS net
    FROM accounts a JOIN ledger_entries e ON e."accountId" = a.id
    WHERE a."ownerType" <> 'PLATFORM'
    GROUP BY a.id
    HAVING SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END) < 0`;
  if (negative.length > 0) {
    violations += negative.length;
    console.log(`[balances] ${negative.length} negative user/creator balance(s):`);
    negative.forEach((a) => console.log(`  - ${a.id} (${a.ownerType}): ${a.net}`));
  } else {
    console.log('[balances] no negative user/creator balances OK');
  }

  await prisma.$disconnect();
  if (violations > 0) {
    console.error(`RECONCILIATION FAILED: ${violations} violation(s)`);
    process.exit(1);
  }
  console.log('RECONCILIATION OK — books balance to zero');
}

void main();
