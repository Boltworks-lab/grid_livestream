import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * In-app notifications (Phase 9 basic). Push (FCM/APNs) and email delivery
 * layer on top of the same rows once providers are configured (deferred.md).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, kind: string, body: string, data?: Prisma.InputJsonValue) {
    await this.prisma.notification.create({ data: { userId, kind, body, data } });
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        body: n.body,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
