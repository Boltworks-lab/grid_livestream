import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors({ origin: env.CORS_ORIGINS.split(',') });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
