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
 * The 70/30 split (PROJECT_BRIEF §1). Fee rounds DOWN so the creator never
 * receives less than (1 - fee) of the total; the platform absorbs rounding.
 */
export function computeGiftSplit(totalDiamonds: number): {
  creatorCoins: number;
  feeCoins: number;
} {
  const feeCoins = Math.floor(totalDiamonds * PLATFORM_FEES.gift);
  return { creatorCoins: totalDiamonds - feeCoins, feeCoins };
}
