import { z } from 'zod';

/**
 * Subscriptions (PROJECT_BRIEF Phase 6, ADR 0005 economics). Creators set their
 * own monthly price; the platform takes the runtime subscription fee; the
 * creator earns COINS at the coin peg. Real fiat flows through Stripe Billing —
 * only the resulting coin credit is ledgered (like top-ups).
 */
export const setSubPriceSchema = z.object({
  /** monthly price in USD cents; null/absent turns subscriptions off */
  priceCents: z.number().int().min(100).max(100_000).nullable(),
});
export type SetSubPriceInput = z.infer<typeof setSubPriceSchema>;

export const subscriptionStatusSchema = z.object({
  creatorId: z.string().uuid(),
  active: z.boolean(),
  renewsAt: z.string().nullable(),
  priceCents: z.number().int().nullable(),
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
