import 'dotenv/config';

import { economicsSchema } from '@grid/shared';
import { PrismaClient } from '@prisma/client';

/**
 * Adjust the live economics (ADR 0005) until the admin app ships:
 *   pnpm --filter @grid/api set-economics -- '{"fees":{"gift":0.3,"ppv":0.25,"subscription":0.3},"coinValueCents":1,"minPayoutCoins":5000,"payoutHoldDays":7}'
 */
async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('usage: set-economics <json>');
    process.exit(1);
  }
  const value = economicsSchema.parse(JSON.parse(raw));
  const prisma = new PrismaClient();
  await prisma.appConfig.upsert({
    where: { key: 'economics' },
    create: { key: 'economics', value },
    update: { value },
  });
  console.log('economics updated:', JSON.stringify(value));
  await prisma.$disconnect();
}

void main();
