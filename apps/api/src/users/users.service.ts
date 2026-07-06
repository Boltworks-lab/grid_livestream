import type { AuthUser, UpdateProfileInput } from '@grid/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { toAuthUser } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  isLive: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    return toAuthUser(user);
  }

  async updateMe(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    return toAuthUser(user);
  }

  async byHandle(handle: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      include: {
        creatorProfile: { select: { followerCount: true } },
        streams: { where: { status: 'LIVE' }, select: { id: true }, take: 1 },
      },
    });
    if (!user || user.status === 'DELETED' || user.status === 'BANNED') {
      throw new NotFoundException('user not found');
    }
    return {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount: user.creatorProfile?.followerCount ?? 0,
      isLive: user.streams.length > 0,
    };
  }

  async follow(followerId: string, creatorId: string): Promise<void> {
    if (followerId === creatorId) throw new BadRequestException('cannot follow yourself');
    const target = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!target || target.status !== 'ACTIVE') throw new NotFoundException('user not found');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: { followerId_creatorId: { followerId, creatorId } },
      });
      if (existing) return; // idempotent
      await tx.follow.create({ data: { followerId, creatorId } });
      // followerCount is a denormalized counter on creator profiles (source of
      // truth stays the follows table).
      await tx.creatorProfile.updateMany({
        where: { userId: creatorId },
        data: { followerCount: { increment: 1 } },
      });
    });
    const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
    if (follower) {
      await this.notifications.notify(
        creatorId,
        'new_follower',
        `@${follower.handle} followed you`,
      );
    }
  }

  async unfollow(followerId: string, creatorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.follow.deleteMany({ where: { followerId, creatorId } });
      if (deleted.count > 0) {
        await tx.creatorProfile.updateMany({
          where: { userId: creatorId, followerCount: { gt: 0 } },
          data: { followerCount: { decrement: 1 } },
        });
      }
    });
  }
}
