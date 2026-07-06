import 'dotenv/config';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutsService } from '../payouts/payouts.service';

/**
 * Temporary admin approval path (Phase 8 replaces this with the admin app's
 * queue): approves a REQUESTED payout as the seeded system staff user and
 * writes the audit_log row.
 *   pnpm --filter @grid/api approve-payout -- <payoutId>
 */
async function main() {
  const payoutId = process.argv[2];
  if (!payoutId) {
    console.error('usage: approve-payout <payoutId>');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const staff = await prisma.staffUser.findUnique({ where: { email: 'system@grid.local' } });
  if (!staff) {
    console.error('seed the system staff user first: pnpm --filter @grid/api db:seed');
    process.exit(1);
  }
  const result = await app.get(PayoutsService).approve(payoutId, staff.id);
  console.log(
    `payout ${result.id}: ${result.status}${result.failureReason ? ` (${result.failureReason})` : ''}`,
  );
  await app.close();
}

void main();
