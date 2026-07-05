import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/redis-io.adapter';
import { env } from './config/env';

async function bootstrap() {
  // rawBody: Stripe webhook signatures verify against the exact bytes received
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.enableCors({ origin: env.CORS_ORIGINS.split(',') });
  app.enableShutdownHooks();
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);
  await app.listen(env.PORT);
}

void bootstrap();
