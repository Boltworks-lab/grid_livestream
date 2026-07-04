import { describe, expect, it } from 'vitest';

import { healthResponseSchema, PLATFORM_FEES } from './index';

describe('PLATFORM_FEES', () => {
  it('every fee is a fraction strictly between 0 and 1', () => {
    for (const fee of Object.values(PLATFORM_FEES)) {
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(1);
    }
  });
});

describe('healthResponseSchema', () => {
  it('accepts a valid payload', () => {
    const payload = { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
    expect(healthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a non-ok status', () => {
    expect(() =>
      healthResponseSchema.parse({ status: 'down', service: 'api', timestamp: '' }),
    ).toThrow();
  });
});
