import { economicsSchema, type Economics } from '@grid/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ModAction, Prisma } from '@prisma/client';

import { ChatService } from '../chat/chat.service';
import { EconomicsService } from '../economics/economics.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../wallet/ledger.service';

/**
 * Phase 8 admin operations. EVERY mutation writes audit_log (append-only, DB
 * trigger enforced) with before/after — brief §3.5.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly economics: EconomicsService,
    private readonly chat: ChatService,
  ) {}

  // ── payouts queue ──────────────────────────────────────────────────────────

  payoutQueue(status?: string) {
    return this.prisma.payout.findMany({
      where: status ? { status: status as never } : { status: 'REQUESTED' },
      include: { creator: { include: { user: { select: { handle: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  async rejectPayout(payoutId: string, staffId: string, reason: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('payout not found');
    if (payout.status !== 'REQUESTED') throw new BadRequestException(`payout is ${payout.status}`);

    // return the coins — rejection must never strand funds in clearing
    const [creatorAcct, clearing] = await Promise.all([
      this.ledger.getOrCreateAccount('CREATOR', payout.creatorId, 'COIN'),
      this.ledger.getOrCreateAccount('PLATFORM', 'payout_clearing', 'COIN'),
    ]);
    await this.ledger.post({
      kind: 'ADJUSTMENT',
      idempotencyKey: `payout_reject:${payoutId}`,
      metadata: { payoutId, reason },
      entries: [
        { accountId: clearing.id, direction: 'DEBIT', amount: payout.coinAmount },
        { accountId: creatorAcct.id, direction: 'CREDIT', amount: payout.coinAmount },
      ],
    });
    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'CANCELED', failureReason: reason, reviewedByStaffId: staffId },
    });
    await this.audit(staffId, 'payout.reject', 'payout', payoutId, { reason });
    return updated;
  }

  // ── reports & moderation ───────────────────────────────────────────────────

  reportQueue() {
    return this.prisma.report.findMany({
      where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      include: { reporter: { select: { handle: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  async actOnReport(reportId: string, staffId: string, action: ModAction, reason: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('report not found');
    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      throw new BadRequestException('report already handled');
    }

    // apply the effect
    if (action === 'REMOVE_CONTENT' && report.targetType === 'CHAT_MESSAGE') {
      const msg = await this.prisma.chatMessage.findUnique({ where: { id: report.targetId } });
      if (msg) await this.chat.removeMessage(msg.streamId, msg.id);
    }
    if ((action === 'BAN' || action === 'SUSPEND') && report.targetType === 'USER') {
      await this.prisma.user.update({
        where: { id: report.targetId },
        data: { status: action === 'BAN' ? 'BANNED' : 'SUSPENDED' },
      });
      // kill their sessions: every refresh token dies now
      await this.prisma.refreshToken.updateMany({
        where: { userId: report.targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.moderationAction.create({
      data: {
        actorStaffId: staffId,
        targetType: report.targetType,
        targetId: report.targetId,
        action,
        reason,
        reportId,
      },
    });
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'RESOLVED', assigneeStaffId: staffId, resolvedAt: new Date() },
    });
    await this.audit(
      staffId,
      `moderation.${action.toLowerCase()}`,
      report.targetType,
      report.targetId,
      {
        reportId,
        reason,
      },
    );
    return updated;
  }

  async dismissReport(reportId: string, staffId: string) {
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'DISMISSED', assigneeStaffId: staffId, resolvedAt: new Date() },
    });
    await this.audit(staffId, 'moderation.dismiss', 'report', reportId, {});
    return updated;
  }

  // ── user lookup (money data read-only, brief §6.3) ─────────────────────────

  async lookupUser(query: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ handle: query }, { email: query }] },
      include: { creatorProfile: true },
    });
    if (!user) throw new NotFoundException('user not found');
    const accounts = await this.prisma.account.findMany({
      where: { ownerId: user.id, ownerType: { in: ['USER', 'CREATOR'] } },
    });
    const balances: Record<string, number> = {};
    for (const account of accounts) {
      balances[account.currency] = Number(await this.ledger.balance(account.id));
    }
    const recentStreams = await this.prisma.stream.count({ where: { creatorId: user.id } });
    return {
      id: user.id,
      handle: user.handle,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      balances,
      streams: recentStreams,
      kycStatus: user.creatorProfile?.kycStatus ?? 'NONE',
    };
  }

  // ── economics (ADR 0005) ───────────────────────────────────────────────────

  getEconomics() {
    return this.economics.current();
  }

  async updateEconomics(value: Economics, staffId: string) {
    const parsed = economicsSchema.parse(value);
    const before = await this.economics.current();
    await this.economics.update(parsed, staffId);
    await this.audit(staffId, 'economics.update', 'app_config', 'economics', {
      before: before as unknown as Prisma.InputJsonValue,
      after: parsed as unknown as Prisma.InputJsonValue,
    });
    return parsed;
  }

  // ── audit log ──────────────────────────────────────────────────────────────

  auditLog() {
    return this.prisma.auditLog.findMany({
      include: { staff: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private audit(
    staffId: string,
    action: string,
    targetType: string,
    targetId: string,
    after: object,
  ) {
    return this.prisma.auditLog.create({
      data: { staffId, action, targetType, targetId, after: after as Prisma.InputJsonValue },
    });
  }
}
