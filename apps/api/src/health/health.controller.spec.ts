import { healthResponseSchema } from '@grid/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a payload matching the shared health schema', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const body = healthResponseSchema.parse(controller.getHealth());

    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });
});
