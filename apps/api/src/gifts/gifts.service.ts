import { computeSplit, type GiftCatalogItem, type SendGiftInput } from '@grid/shared';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

import { ChatService } from '../chat/chat.service';
import { EconomicsService } from '../economics/economics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { LedgerService } from '../wallet/ledger.service';

const COMBO_WINDOW_SECONDS = 8;

/**
 * Gifting (PROJECT_BRIEF Phase 5). One gift = one 5-entry ledger transaction,
 * zero-sum in BOTH currencies:
 *   DIAMOND: viewer −total → platform sink +total  (diamonds retired)
 *   COIN:    platform issuance −total → creator +70% / platform revenue +fee
 * Money moves over HTTP only; the socket carries the resulting broadcast.
 */
@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly chat: ChatService,
    private readonly economics: EconomicsService,
    private readonly notifications: NotificationsService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async catalog(): Promise<GiftCatalogItem[]> {
    const items = await this.prisma.giftCatalogItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      priceDiamonds: g.priceDiamonds,
      animationTier: g.animationTier,
    }));
  }

  async send(userId: string, handle: string, streamId: string, input: SendGiftInput) {
    const [stream, gift] = await Promise.all([
      this.prisma.stream.findUnique({ where: { id: streamId } }),
      this.prisma.giftCatalogItem.findUnique({ where: { id: input.giftId } }),
    ]);
    if (!stream || stream.status !== 'LIVE') throw new NotFoundException('stream is not live');
    if (!gift?.active) throw new NotFoundException('unknown gift');
    if (stream.creatorId === userId) throw new BadRequestException('cannot gift yourself');

    const total = gift.priceDiamonds * input.qty;
    const { fees } = await this.economics.current();
    const { creatorCoins, feeCoins } = computeSplit(total, fees.gift);

    const [viewerDiamonds, diamondSink, coinIssuance, creatorCoinsAcct, revenue] =
      await Promise.all([
        this.ledger.getOrCreateAccount('USER', userId, 'DIAMOND'),
        this.ledger.platformAccount('DIAMOND'),
        this.ledger.platformAccount('COIN'),
        this.ledger.getOrCreateAccount('CREATOR', stream.creatorId, 'COIN'),
        this.ledger.getOrCreateAccount('PLATFORM', 'platform_revenue', 'COIN'),
      ]);

    const tx = await this.ledger.post({
      kind: 'GIFT',
      idempotencyKey: `gift:${input.idempotencyKey}`,
      metadata: { streamId, giftId: gift.id, qty: input.qty, totalDiamonds: total, feeCoins },
      entries: [
        { accountId: viewerDiamonds.id, direction: 'DEBIT', amount: BigInt(total) },
        { accountId: diamondSink.id, direction: 'CREDIT', amount: BigInt(total) },
        { accountId: coinIssuance.id, direction: 'DEBIT', amount: BigInt(total) },
        { accountId: creatorCoinsAcct.id, direction: 'CREDIT', amount: BigInt(creatorCoins) },
        { accountId: revenue.id, direction: 'CREDIT', amount: BigInt(feeCoins) },
      ],
    });

    // replay (same idempotency key) → the event exists; don't double-broadcast
    const existing = await this.prisma.giftEvent.findUnique({
      where: { ledgerTransactionId: tx.id },
    });
    let combo = 1;
    if (!existing) {
      await this.prisma.giftEvent.create({
        data: {
          streamId,
          senderId: userId,
          giftId: gift.id,
          qty: input.qty,
          ledgerTransactionId: tx.id,
        },
      });
      combo = await this.bumpCombo(streamId, userId, gift.id);
      await this.redis.zincrby(`topgifters:${streamId}`, total, userId);
      await this.notifications.notify(
        stream.creatorId,
        'gift_received',
        `@${handle} sent ${gift.name} ${gift.emoji ?? ''} (+${creatorCoins} coins)`,
        { streamId, giftId: gift.id, qty: input.qty },
      );
      this.chat.broadcastGift({
        streamId,
        giftId: gift.id,
        giftName: gift.name,
        emoji: gift.emoji ?? undefined,
        animationTier: gift.animationTier,
        qty: input.qty,
        senderId: userId,
        senderHandle: handle,
        combo,
        sentAt: new Date().toISOString(),
      });
    }

    const balance = await this.ledger.balance(viewerDiamonds.id);
    return { diamonds: Number(balance), combo };
  }

  async topGifters(streamId: string): Promise<{ userId: string; handle: string; total: number }[]> {
    const raw = await this.redis.zrevrange(`topgifters:${streamId}`, 0, 2, 'WITHSCORES');
    const entries: { userId: string; total: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ userId: raw[i], total: Number(raw[i + 1]) });
    }
    if (entries.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: entries.map((e) => e.userId) } },
      select: { id: true, handle: true },
    });
    const handles = new Map(users.map((u) => [u.id, u.handle]));
    return entries.map((e) => ({ ...e, handle: handles.get(e.userId) ?? 'unknown' }));
  }

  private async bumpCombo(streamId: string, userId: string, giftId: string): Promise<number> {
    const key = `gift:combo:${streamId}:${userId}:${giftId}`;
    const combo = await this.redis.incr(key);
    await this.redis.expire(key, COMBO_WINDOW_SECONDS);
    return combo;
  }
}
