import { Injectable } from '@nestjs/common';
import type { Stream } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * The gate (PROJECT_BRIEF §3.4, ADR 0004): media tokens AND chat joins are only
 * granted after this says yes. Server-side only — clients render lock screens,
 * they never decide.
 */
@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async check(stream: Stream, userId: string | null): Promise<boolean> {
    if (!userId) return false; // MVP: viewers must be signed in
    if (stream.creatorId === userId) return true;

    if (stream.visibility === 'FOLLOWERS') {
      const follows = await this.prisma.follow.findUnique({
        where: { followerId_creatorId: { followerId: userId, creatorId: stream.creatorId } },
      });
      if (!follows) return false;
    }
    if (stream.visibility === 'PRIVATE') {
      const invite = await this.prisma.streamAccessGrant.findUnique({
        where: { streamId_userId: { streamId: stream.id, userId } },
      });
      if (invite?.source !== 'INVITE') return false;
    }

    switch (stream.access) {
      case 'FREE':
        return true;
      case 'PPV': {
        const grant = await this.prisma.streamAccessGrant.findUnique({
          where: { streamId_userId: { streamId: stream.id, userId } },
        });
        return grant !== null;
      }
      case 'SUBS': {
        const sub = await this.prisma.subscription.findUnique({
          where: { viewerId_creatorId: { viewerId: userId, creatorId: stream.creatorId } },
        });
        if (sub?.status === 'ACTIVE') return true;
        const grant = await this.prisma.streamAccessGrant.findUnique({
          where: { streamId_userId: { streamId: stream.id, userId } },
        });
        return grant !== null;
      }
    }
  }
}
