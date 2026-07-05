import { describe, expect, it } from 'vitest';

import { computeGiftSplit } from './gifts';

describe('computeGiftSplit', () => {
  it('splits 70/30 exactly on round totals', () => {
    expect(computeGiftSplit(100)).toEqual({ creatorCoins: 70, feeCoins: 30 });
    expect(computeGiftSplit(10000)).toEqual({ creatorCoins: 7000, feeCoins: 3000 });
  });

  it('rounds in the creator’s favor and always sums to the total', () => {
    for (const total of [1, 3, 7, 99, 101, 2999, 123457]) {
      const { creatorCoins, feeCoins } = computeGiftSplit(total);
      expect(creatorCoins + feeCoins).toBe(total);
      expect(creatorCoins).toBeGreaterThanOrEqual(Math.ceil(total * 0.7));
      expect(feeCoins).toBeLessThanOrEqual(Math.floor(total * 0.3));
    }
  });
});
