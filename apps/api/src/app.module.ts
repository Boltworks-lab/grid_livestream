import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { env } from './config/env';
import { EconomicsModule } from './economics/economics.module';
import { GatesModule } from './gates/gates.module';
import { PayoutsModule } from './payouts/payouts.module';
import { GiftsModule } from './gifts/gifts.module';
import { HealthController } from './health/health.controller';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReportsController } from './reports/reports.controller';
import { StreamsModule } from './streams/streams.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),
    // Baseline limiter for every route; auth routes tighten it per-controller (§3.7).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    ModerationModule,
    NotificationsModule,
    EconomicsModule,
    AuthModule,
    UsersModule,
    WalletModule,
    PaymentsModule,
    StreamsModule,
    ChatModule,
    GiftsModule,
    GatesModule,
    SubscriptionsModule,
    PayoutsModule,
    AdminModule,
  ],
  controllers: [HealthController, ReportsController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
