import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/redis-io.adapter';
import { env } from './config/env';

async function bootstrap() {
  // rawBody: Stripe webhook signatures verify against the exact bytes received
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  // security headers (HSTS, nosniff, frame-deny, referrer policy). This is a JSON
  // API — no first-party HTML — so the restrictive CSP default is fine.
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGINS.split(','), credentials: true });
  app.enableShutdownHooks();
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);
  await app.listen(env.PORT);
}

void bootstrap();
