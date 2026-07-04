import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from '@grid/shared';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';

import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const [byEmail, byHandle] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: input.email } }),
      this.prisma.user.findUnique({ where: { handle: input.handle } }),
    ]);
    if (byEmail) throw new ConflictException('email already registered');
    if (byHandle) throw new ConflictException('handle already taken');

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        handle: input.handle,
        passwordHash: await argon2.hash(input.password),
        dob: new Date(input.dob),
        country: input.country ?? null,
      },
    });
    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.identifier }, { handle: input.identifier }] },
    });
    // argon2.verify against a constant hash even when the user is missing would
    // be nicer for timing; acceptable at this stage behind rate limiting (§3.7).
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('invalid credentials');
    }
    this.assertActive(user);
    return this.issueTokens(user);
  }

  /**
   * Refresh rotation with reuse detection: each refresh token is single-use and
   * belongs to a family. Presenting an already-rotated (revoked) token burns the
   * whole family — a replayed stolen token logs everyone out of that chain.
   */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = sha256(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('unknown refresh token');

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('refresh token reuse detected');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('refresh token expired');
    this.assertActive(stored.user);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user, stored.familyId);
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private assertActive(user: User): void {
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`account is ${user.status.toLowerCase()}`);
    }
  }

  private async issueTokens(user: User, familyId?: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, handle: user.handle, role: user.role },
      { expiresIn: env.JWT_ACCESS_TTL },
    );

    const rawRefresh = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawRefresh),
        familyId: familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * DAY_MS),
      },
    });

    return { accessToken, refreshToken: rawRefresh, user: toAuthUser(user) };
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    handle: user.handle,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
