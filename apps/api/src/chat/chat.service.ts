import { randomUUID } from 'node:crypto';

import type { ChatMessage } from '@grid/shared';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { Server } from 'socket.io';

import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

const VIEWER_COUNT_THROTTLE_MS = 2000;

/**
 * Chat hot path (ADR 0002): broadcast over Socket.IO (Redis adapter for
 * horizontal scale), persistence via a Redis Stream consumed in batches by
 * ChatPersistenceService. Viewer counts and peaks live in Redis.
 */
@Injectable()
export class ChatService {
  private server: Server | null = null;
  private lastCountBroadcast = new Map<string, number>();
  private pendingCountFlush = new Set<string>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  bindServer(server: Server) {
    this.server = server;
  }

  /** time-sortable message id (ULID-style: ms timestamp + random) */
  mintMessageId(): string {
    return `${Date.now().toString(36).padStart(9, '0')}-${randomUUID().slice(0, 12)}`;
  }

  async publishMessage(message: ChatMessage): Promise<void> {
    this.server?.to(`stream:${message.streamId}`).emit('chat:message', message);
    await this.redis.xadd(
      'chat:persist',
      '*',
      'streamId',
      message.streamId,
      'messageId',
      message.messageId,
      'senderId',
      message.senderId,
      'body',
      message.body,
      'sentAt',
      message.sentAt,
    );
  }

  async removeMessage(streamId: string, messageId: string): Promise<void> {
    this.server?.to(`stream:${streamId}`).emit('chat:message:removed', { streamId, messageId });
    // marker covers rows not yet flushed; updateMany covers rows already in
    // Postgres — soft-hide either way, the row stays as moderation evidence
    await this.redis.sadd(`chat:removed:${streamId}`, messageId);
    await this.redis.expire(`chat:removed:${streamId}`, 60 * 60 * 24);
    await this.prisma.chatMessage.updateMany({
      where: { id: messageId, streamId, hiddenAt: null },
      data: { hiddenAt: new Date(), hiddenReason: 'creator_removed' },
    });
  }

  broadcastStreamStatus(streamId: string, status: 'scheduled' | 'live' | 'ended'): void {
    this.server?.to(`stream:${streamId}`).emit('stream:status', { streamId, status });
  }

  broadcastPresence(streamId: string, userId: string, handle: string, kind: 'join' | 'follow') {
    this.server
      ?.to(`stream:${streamId}`)
      .emit('presence:event', { streamId, userId, handle, kind });
  }

  async viewerJoined(streamId: string): Promise<void> {
    const count = await this.redis.incr(`viewers:${streamId}`);
    const peak = Number((await this.redis.get(`peak:${streamId}`)) ?? 0);
    if (count > peak) await this.redis.set(`peak:${streamId}`, count);
    this.maybeBroadcastCount(streamId, count);
  }

  async viewerLeft(streamId: string): Promise<void> {
    const count = await this.redis.decr(`viewers:${streamId}`);
    if (count < 0) await this.redis.set(`viewers:${streamId}`, 0);
    this.maybeBroadcastCount(streamId, Math.max(count, 0));
  }

  /** per-user chat rate limit (§3.7): max 5 messages per 5 s window */
  async allowMessage(userId: string): Promise<boolean> {
    const key = `chat:rate:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 5);
    return count <= 5;
  }

  private maybeBroadcastCount(streamId: string, count: number): void {
    const now = Date.now();
    const last = this.lastCountBroadcast.get(streamId) ?? 0;
    const wait = VIEWER_COUNT_THROTTLE_MS - (now - last);
    if (wait > 0 && count > 0) {
      // throttled: schedule ONE trailing broadcast with the then-current count
      if (this.pendingCountFlush.has(streamId)) return;
      this.pendingCountFlush.add(streamId);
      setTimeout(() => {
        this.pendingCountFlush.delete(streamId);
        void this.redis.get(`viewers:${streamId}`).then((v) => {
          this.lastCountBroadcast.set(streamId, Date.now());
          this.server
            ?.to(`stream:${streamId}`)
            .emit('viewer:count', { streamId, count: Number(v ?? 0) });
        });
      }, wait).unref?.();
      return;
    }
    this.lastCountBroadcast.set(streamId, now);
    this.server?.to(`stream:${streamId}`).emit('viewer:count', { streamId, count });
  }
}
