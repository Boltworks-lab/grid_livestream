import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

import { env } from '../config/env';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown() {
    // clients are closed by process exit; explicit quit happens in services that own loops
  }
}
