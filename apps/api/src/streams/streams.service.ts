import type { CreateStreamInput, StreamSummary } from '@grid/shared';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Stream, User } from '@prisma/client';
import Redis from 'ioredis';

import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { EntitlementService } from './entitlement.service';
import { LivekitService } from './livekit.service';

type StreamWithCreator = Stream & { creator: Pick<User, 'handle'> };

@Injectable()
export class StreamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: EntitlementService,
    private readonly livekit: LivekitService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async create(creatorId: string, input: CreateStreamInput): Promise<Stream> {
    return this.prisma.stream.create({
      data: {
        creatorId,
        title: input.title,
        category: input.category ?? null,
        visibility: input.visibility,
        access: input.access,
        ppvPriceDiamonds: input.access === 'PPV' ? input.ppvPriceDiamonds : null,
      },
    });
  }

  async goLive(streamId: string, userId: string): Promise<Stream> {
    const stream = await this.byId(streamId);
    if (stream.creatorId !== userId) throw new ForbiddenException('not your stream');
    if (stream.status === 'ENDED') throw new ForbiddenException('stream already ended');
    if (stream.status === 'LIVE') return stream;

    await this.livekit.createRoom(stream.id); // no-op until keys are configured
    return this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'LIVE', startedAt: new Date(), livekitRoom: stream.id },
    });
  }

  async end(streamId: string, userId: string): Promise<Stream> {
    const stream = await this.byId(streamId);
    if (stream.creatorId !== userId) throw new ForbiddenException('not your stream');
    if (stream.status !== 'LIVE') return stream;

    await this.livekit.deleteRoom(stream.id);
    const peak = Number((await this.redis.get(`peak:${stream.id}`)) ?? 0);
    await this.redis.del(`viewers:${stream.id}`, `peak:${stream.id}`);
    return this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt: new Date(), peakViewers: peak },
    });
  }

  async feed(
    userId: string | null,
    category?: string,
    cursor?: string,
  ): Promise<{ items: StreamSummary[]; nextCursor: string | null }> {
    const take = 24;
    const streams = await this.prisma.stream.findMany({
      where: { status: 'LIVE', ...(category ? { category } : {}) },
      include: { creator: { select: { handle: true } } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = streams.slice(0, take);
    const counts = await this.viewerCounts(page.map((s) => s.id));
    const items = await Promise.all(
      page.map(async (s, i) =>
        this.toSummary(s, counts[i], await this.entitlement.check(s, userId)),
      ),
    );
    return { items, nextCursor: streams.length > take ? page[page.length - 1].id : null };
  }

  async detail(streamId: string, userId: string | null): Promise<StreamSummary> {
    const stream = await this.byId(streamId);
    const [count] = await this.viewerCounts([stream.id]);
    return this.toSummary(stream, count, await this.entitlement.check(stream, userId));
  }

  /** LiveKit join token — THE gate (§3.4): entitlement is re-checked every call. */
  async token(streamId: string, userId: string, handle: string) {
    const stream = await this.byId(streamId);
    if (stream.status !== 'LIVE') throw new NotFoundException('stream is not live');
    if (!(await this.entitlement.check(stream, userId))) {
      throw stream.access === 'FREE'
        ? new ForbiddenException('you cannot join this stream')
        : new HttpException('unlock or subscribe to join this stream', HttpStatus.PAYMENT_REQUIRED);
    }
    return this.livekit.mintToken(stream.id, userId, handle, stream.creatorId === userId);
  }

  async byId(streamId: string): Promise<StreamWithCreator> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      include: { creator: { select: { handle: true } } },
    });
    if (!stream) throw new NotFoundException('stream not found');
    return stream;
  }

  private async viewerCounts(ids: string[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const values = await this.redis.mget(ids.map((id) => `viewers:${id}`));
    return values.map((v) => Number(v ?? 0));
  }

  private toSummary(s: StreamWithCreator, viewerCount: number, entitled: boolean): StreamSummary {
    return {
      id: s.id,
      creatorId: s.creatorId,
      creatorHandle: s.creator.handle,
      title: s.title,
      category: s.category,
      visibility: s.visibility,
      access: s.access,
      ppvPriceDiamonds: s.ppvPriceDiamonds,
      status: s.status,
      viewerCount,
      startedAt: s.startedAt?.toISOString() ?? null,
      entitled,
    };
  }
}
