import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

const STREAM_KEY = 'chat:persist';
const GROUP = 'chat-persist';
const CONSUMER = `api-${process.pid}`;

/**
 * ADR 0002: async batch persistence. Messages flow through one Redis Stream
 * (single stream + consumer group rather than per-live-stream streams — noted
 * in docs/deferred.md as a revisit when fanout demands it); this worker flushes
 * them to Postgres in batches and honors moderation-removal markers.
 */
@Injectable()
export class ChatPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatPersistenceService.name);
  private running = false;
  private loop: Promise<void> | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    if (env.NODE_ENV === 'test') return;
    try {
      await this.redis.xgroup('CREATE', STREAM_KEY, GROUP, '0', 'MKSTREAM');
    } catch {
      // BUSYGROUP — group already exists
    }
    this.running = true;
    this.loop = this.run();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loop?.catch(() => undefined);
  }

  private async run(): Promise<void> {
    // dedicated blocking connection so the shared client stays responsive
    const reader = this.redis.duplicate();
    try {
      while (this.running) {
        try {
          const batch = (await reader.xreadgroup(
            'GROUP',
            GROUP,
            CONSUMER,
            'COUNT',
            500,
            'BLOCK',
            2000,
            'STREAMS',
            STREAM_KEY,
            '>',
          )) as [string, [string, string[]][]][] | null;
          if (!batch || batch[0][1].length === 0) continue;
          await this.flush(batch[0][1]);
        } catch (error) {
          if (!this.running) break;
          this.logger.error(`persist loop error: ${String(error)}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } finally {
      reader.disconnect();
    }
  }

  private async flush(entries: [string, string[]][]): Promise<void> {
    const rows = entries.map(([redisId, fields]) => {
      const record: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) record[fields[i]] = fields[i + 1];
      return { redisId, record };
    });

    const removedByStream = new Map<string, Set<string>>();
    for (const streamId of new Set(rows.map((r) => r.record.streamId))) {
      const members = await this.redis.smembers(`chat:removed:${streamId}`);
      removedByStream.set(streamId, new Set(members));
    }

    await this.prisma.chatMessage.createMany({
      skipDuplicates: true,
      data: rows.map(({ record }) => ({
        id: record.messageId,
        streamId: record.streamId,
        senderId: record.senderId,
        body: record.body,
        sentAt: new Date(record.sentAt),
        hiddenAt: removedByStream.get(record.streamId)?.has(record.messageId) ? new Date() : null,
        hiddenReason: removedByStream.get(record.streamId)?.has(record.messageId)
          ? 'creator_removed'
          : null,
      })),
    });
    await this.redis.xack(STREAM_KEY, GROUP, ...rows.map((r) => r.redisId));
  }
}
