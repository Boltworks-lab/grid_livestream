import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verifySync } from 'otplib';

import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface StaffTokenPayload {
  sub: string;
  role: StaffRole;
  /** staff tokens NEVER validate as user tokens and vice versa */
  typ: 'staff';
}

interface EnrollTokenPayload {
  sub: string;
  typ: 'staff-enroll';
  secret: string;
}
interface ChallengeTokenPayload {
  sub: string;
  typ: 'staff-challenge';
}

/**
 * Staff auth (brief §3.5): separate credential store (staff_users), separate
 * JWT secret, and TOTP 2FA REQUIRED from day one — first login returns an
 * enrollment challenge (otpauth:// URI for any authenticator app), and no
 * staff token is ever issued without a valid TOTP code.
 */
@Injectable()
export class AdminAuthService {
  private readonly jwt = new JwtService({ secret: env.ADMIN_JWT_SECRET });

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const staff = await this.prisma.staffUser.findUnique({ where: { email } });
    if (
      !staff ||
      staff.status !== 'ACTIVE' ||
      staff.passwordHash.startsWith('!') || // sentinel: system accounts cannot log in
      !(await argon2.verify(staff.passwordHash, password).catch(() => false))
    ) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (!staff.totpSecret) {
      // enrollment: the provisional secret travels only inside the signed token
      const secret = generateSecret();
      const enrollToken = await this.jwt.signAsync(
        { sub: staff.id, typ: 'staff-enroll', secret } satisfies EnrollTokenPayload,
        { expiresIn: 600 },
      );
      return {
        step: 'enroll' as const,
        enrollToken,
        otpauthUrl: generateURI({ secret, issuer: 'Grid Admin', label: staff.email }),
      };
    }

    const challengeToken = await this.jwt.signAsync(
      { sub: staff.id, typ: 'staff-challenge' } satisfies ChallengeTokenPayload,
      { expiresIn: 300 },
    );
    return { step: 'totp' as const, challengeToken };
  }

  async completeEnrollment(enrollToken: string, code: string) {
    const payload = await this.verifyTyped<EnrollTokenPayload>(enrollToken, 'staff-enroll');
    if (!verifySync({ token: code, secret: payload.secret }).valid) {
      throw new UnauthorizedException('invalid TOTP code');
    }
    const staff = await this.prisma.staffUser.update({
      where: { id: payload.sub },
      data: { totpSecret: payload.secret, lastLoginAt: new Date() },
    });
    return this.issue(staff.id, staff.role);
  }

  async verifyTotp(challengeToken: string, code: string) {
    const payload = await this.verifyTyped<ChallengeTokenPayload>(
      challengeToken,
      'staff-challenge',
    );
    const staff = await this.prisma.staffUser.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!staff.totpSecret || !verifySync({ token: code, secret: staff.totpSecret }).valid) {
      throw new UnauthorizedException('invalid TOTP code');
    }
    await this.prisma.staffUser.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issue(staff.id, staff.role);
  }

  async verifyStaffToken(token: string): Promise<StaffTokenPayload> {
    return this.verifyTyped<StaffTokenPayload>(token, 'staff');
  }

  private async issue(staffId: string, role: StaffRole) {
    const staffToken = await this.jwt.signAsync(
      { sub: staffId, role, typ: 'staff' } satisfies StaffTokenPayload,
      { expiresIn: '8h' },
    );
    return { staffToken };
  }

  private async verifyTyped<T extends { typ: string }>(token: string, typ: T['typ']): Promise<T> {
    try {
      const payload = await this.jwt.verifyAsync<T>(token);
      if (payload.typ !== typ) throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException('invalid or expired token');
    }
  }
}
