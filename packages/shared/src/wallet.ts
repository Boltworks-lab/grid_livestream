import { z } from 'zod';

/**
 * Diamond top-up packages — extracted verbatim from the prototype
 * (prototypes/js/data.js). Server-authoritative (PROJECT_BRIEF §3.2): the API
 * builds Stripe line items from THIS table; clients only render it. Mobile IAP
 * pricing will differ per channel (app-store cut, brief §7) — modeled later.
 */
export const DIAMOND_PACKAGES = [
  { id: 'd100', diamonds: 100, bonus: 0, usdCents: 99 },
  { id: 'd500', diamonds: 500, bonus: 0, usdCents: 499 },
  { id: 'd1000', diamonds: 1000, bonus: 0, usdCents: 999 },
  { id: 'd2000', diamonds: 2000, bonus: 0, usdCents: 1999 },
  { id: 'd5000', diamonds: 5000, bonus: 250, usdCents: 4999 },
  { id: 'd10000', diamonds: 10000, bonus: 1000, usdCents: 9999 },
] as const;

export type DiamondPackage = (typeof DIAMOND_PACKAGES)[number];
export type DiamondPackageId = DiamondPackage['id'];

const packageIds = DIAMOND_PACKAGES.map((p) => p.id) as [DiamondPackageId, ...DiamondPackageId[]];

export const topupCheckoutSchema = z.object({
  packageId: z.enum(packageIds),
});
export type TopupCheckoutInput = z.infer<typeof topupCheckoutSchema>;

export const walletBalancesSchema = z.object({
  diamonds: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
});
export type WalletBalances = z.infer<typeof walletBalancesSchema>;

export const walletTransactionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['TOPUP', 'GIFT', 'PPV_UNLOCK', 'SUB', 'PAYOUT', 'REFUND', 'ADJUSTMENT']),
  /** signed from the caller's perspective: credits positive, debits negative */
  amount: z.number().int(),
  currency: z.enum(['DIAMOND', 'COIN']),
  createdAt: z.string(),
});
export type WalletTransaction = z.infer<typeof walletTransactionSchema>;
