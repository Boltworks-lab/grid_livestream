import { computeSplit } from '@grid/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EconomicsService } from '../economics/economics.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * PPV unlock (PROJECT_BRIEF Phase 6): one ledger transaction + one
 * stream_access_grant, after which the §3.4 gate (chat joins AND media tokens)
 * opens for this viewer — permanently for the stream.
 *
 * Idempotency is SERVER-derived (`ppv:{streamId}:{userId}`): a viewer can hammer
 * unlock from two devices and pay exactly once, regardless of client keys.
 */
@Injectable()
export class GatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly economics: EconomicsService,
  ) {}

  async unlock(userId: string, streamId: string): Promise<{ unlocked: true; diamonds: number }> {
    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream || stream.status === 'ENDED') throw new NotFoundException('stream not available');
    if (stream.access !== 'PPV' || !stream.ppvPriceDiamonds) {
      throw new BadRequestException('stream is not pay-per-view');
    }
    if (stream.creatorId === userId) throw new BadRequestException('own stream');

    const viewerDiamonds = await this.ledger.getOrCreateAccount('USER', userId, 'DIAMOND');

    const existing = await this.prisma.streamAccessGrant.findUnique({
      where: { streamId_userId: { streamId, userId } },
    });
    if (existing) {
      return { unlocked: true, diamonds: Number(await this.ledger.balance(viewerDiamonds.id)) };
    }

    const total = stream.ppvPriceDiamonds;
    const { fees } = await this.economics.current();
    const { creatorCoins, feeCoins } = computeSplit(total, fees.ppv);
    const [diamondSink, coinIssuance, creatorAcct, revenue] = await Promise.all([
      this.ledger.platformAccount('DIAMOND'),
      this.ledger.platformAccount('COIN'),
      this.ledger.getOrCreateAccount('CREATOR', stream.creatorId, 'COIN'),
      this.ledger.getOrCreateAccount('PLATFORM', 'platform_revenue', 'COIN'),
    ]);

    const tx = await this.ledger.post({
      kind: 'PPV_UNLOCK',
      idempotencyKey: `ppv:${streamId}:${userId}`,
      metadata: { streamId, priceDiamonds: total, feeCoins },
      entries: [
        { accountId: viewerDiamonds.id, direction: 'DEBIT', amount: BigInt(total) },
        { accountId: diamondSink.id, direction: 'CREDIT', amount: BigInt(total) },
        { accountId: coinIssuance.id, direction: 'DEBIT', amount: BigInt(total) },
        { accountId: creatorAcct.id, direction: 'CREDIT', amount: BigInt(creatorCoins) },
        { accountId: revenue.id, direction: 'CREDIT', amount: BigInt(feeCoins) },
      ],
    });

    try {
      await this.prisma.streamAccessGrant.create({
        data: { streamId, userId, source: 'PPV', ledgerTransactionId: tx.id },
      });
    } catch (error) {
      // concurrent unlock already wrote the grant — money moved once either way
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }

    return { unlocked: true, diamonds: Number(await this.ledger.balance(viewerDiamonds.id)) };
  }

  /** Creator invites a viewer into a private stream (INVITE grant, no charge). */
  async invite(creatorId: string, streamId: string, handle: string): Promise<void> {
    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('stream not found');
    if (stream.creatorId !== creatorId) throw new BadRequestException('not your stream');
    const invitee = await this.prisma.user.findUnique({ where: { handle } });
    if (!invitee || invitee.status !== 'ACTIVE') throw new NotFoundException('user not found');

    await this.prisma.streamAccessGrant.upsert({
      where: { streamId_userId: { streamId, userId: invitee.id } },
      create: { streamId, userId: invitee.id, source: 'INVITE' },
      update: {},
    });
  }
}
