/* eslint-disable @typescript-eslint/no-explicit-any -- structural Prisma fake; the
   typed surface is exercised through AuthService itself */
import { randomUUID } from 'node:crypto';

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

/**
 * Minimal in-memory Prisma fake covering exactly what AuthService touches.
 * Real-database integration tests (Testcontainers) arrive with Phase 3 (§10).
 */
function makePrismaFake() {
  const users: any[] = [];
  const refreshTokens: any[] = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: any) =>
        users.find(
          (u) =>
            (where.id && u.id === where.id) ||
            (where.email && u.email === where.email) ||
            (where.handle && u.handle === where.handle),
        ) ?? null,
      findFirst: async ({ where }: any) =>
        users.find((u) =>
          where.OR.some((c: any) => u.email === c.email || u.handle === c.handle),
        ) ?? null,
      create: async ({ data }: any) => {
        const user = {
          id: randomUUID(),
          role: 'USER',
          status: 'ACTIVE',
          displayName: null,
          avatarUrl: null,
          bio: null,
          createdAt: new Date(),
          ...data,
        };
        users.push(user);
        return user;
      },
    },
    refreshToken: {
      create: async ({ data }: any) => {
        const row = { id: randomUUID(), revokedAt: null, createdAt: new Date(), ...data };
        refreshTokens.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = refreshTokens.find((t) => t.tokenHash === where.tokenHash);
        if (!row) return null;
        return include?.user ? { ...row, user: users.find((u) => u.id === row.userId) } : row;
      },
      update: async ({ where, data }: any) => {
        const row = refreshTokens.find((t) => t.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = refreshTokens.filter(
          (t) => t.familyId === where.familyId && t.revokedAt === (where.revokedAt ?? t.revokedAt),
        );
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    _state: { users, refreshTokens },
  };
  return prisma as unknown as PrismaService & { _state: { users: any[]; refreshTokens: any[] } };
}

const registerInput = {
  email: 'mia@example.com',
  password: 'hunter2hunter2',
  handle: 'mia',
  dob: '1990-01-01',
};

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaFake>;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaFake();
    service = new AuthService(
      prisma,
      new JwtService({ secret: 'test-secret-0123456789abcdef012345' }),
    );
  });

  it('register hashes the password and returns tokens + user', async () => {
    const result = await service.register(registerInput);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.handle).toBe('mia');
    const stored = prisma._state.users[0];
    expect(stored.passwordHash).not.toContain('hunter2');
  });

  it('register rejects duplicate emails', async () => {
    await service.register(registerInput);
    await expect(service.register({ ...registerInput, handle: 'mia2' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login verifies the password', async () => {
    await service.register(registerInput);
    await expect(
      service.login({ identifier: 'mia', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const ok = await service.login({
      identifier: 'mia@example.com',
      password: registerInput.password,
    });
    expect(ok.user.id).toBe(prisma._state.users[0].id);
  });

  it('refresh rotates the token and burns the family on reuse', async () => {
    const first = await service.register(registerInput);

    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // replaying the already-rotated token must revoke the whole family…
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    // …including the newest token from that chain
    await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
