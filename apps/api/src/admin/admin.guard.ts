import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { AdminAuthService, type StaffTokenPayload } from './admin-auth.service';

/**
 * Guards /admin/* with the STAFF trust domain — user tokens are cryptographically
 * useless here (different secret, different typ claim). Applied per-controller,
 * the global user JwtAuthGuard is bypassed via @Public on those controllers.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminAuth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { staff?: StaffTokenPayload }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('missing staff token');
    req.staff = await this.adminAuth.verifyStaffToken(token);
    return true;
  }
}
