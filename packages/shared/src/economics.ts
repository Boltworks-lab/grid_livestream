import { z } from 'zod';

/**
 * The platform economics model (ADR 0005). Creators set their own prices (PPV
 * unlock price, subscription price later); the platform takes a percentage per
 * revenue type. Every number here is RUNTIME-ADJUSTABLE: the API reads the
 * `economics` key from app_config (admin-managed from Phase 8) and falls back
 * to these defaults. Rounding always favors the creator (computeSplit).
 */
export const economicsSchema = z.object({
  /** platform revshare per revenue type, 0..1 */
  fees: z.object({
    gift: z.number().min(0).max(0.9),
    ppv: z.number().min(0).max(0.9),
    subscription: z.number().min(0).max(0.9),
  }),
  /** coin→fiat peg: 1 coin pays out this many USD cents */
  coinValueCents: z.number().positive(),
  /** smallest payout a creator can request, in coins */
  minPayoutCoins: z.number().int().positive(),
  /** new-creator payout hold (brief §7 financial safety), in days */
  payoutHoldDays: z.number().int().nonnegative(),
});
export type Economics = z.infer<typeof economicsSchema>;

export const DEFAULT_ECONOMICS: Economics = {
  fees: { gift: 0.3, ppv: 0.25, subscription: 0.3 },
  coinValueCents: 1,
  minPayoutCoins: 5000, // = $50 at the default peg
  payoutHoldDays: 7,
};

export const requestPayoutSchema = z.object({
  coinAmount: z.number().int().positive(),
  /** client-minted; retries never double-debit (§3.1) */
  idempotencyKey: z.string().uuid(),
});
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
