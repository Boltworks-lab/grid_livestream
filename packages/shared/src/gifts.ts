import { z } from 'zod';

import { PLATFORM_FEES } from './index';

export const sendGiftSchema = z.object({
  giftId: z.string().min(1).max(40),
  qty: z.number().int().min(1).max(99),
  /** client-minted; makes retries replay-safe (§3.1) */
  idempotencyKey: z.string().uuid(),
});
export type SendGiftInput = z.infer<typeof sendGiftSchema>;

export const giftCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().nullable(),
  priceDiamonds: z.number().int().positive(),
  animationTier: z.number().int().nonnegative(),
});
export type GiftCatalogItem = z.infer<typeof giftCatalogItemSchema>;

/**
 * Revenue splits (PROJECT_BRIEF §1). Fee rounds DOWN so the creator never
 * receives less than (1 - fee) of the total; the platform absorbs rounding.
 */
export function computeSplit(
  total: number,
  feeFraction: number,
): { creatorCoins: number; feeCoins: number } {
  const feeCoins = Math.floor(total * feeFraction);
  return { creatorCoins: total - feeCoins, feeCoins };
}

/** The 70/30 gift split. */
export function computeGiftSplit(totalDiamonds: number): {
  creatorCoins: number;
  feeCoins: number;
} {
  return computeSplit(totalDiamonds, PLATFORM_FEES.gift);
}
