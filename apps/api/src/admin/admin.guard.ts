import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AdminAuthService, type StaffTokenPayload } from './admin-auth.service';
import { PERMISSION_KEY, roleHas, type Permission } from './permissions';

/**
 * Guards /admin/* with the STAFF trust domain — user tokens are cryptographically
 * useless here (different secret, different typ claim). Applied per-controller,
 * the global user JwtAuthGuard is bypassed via @Public on those controllers.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { staff?: StaffTokenPayload }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('missing staff token');
    req.staff = await this.adminAuth.verifyStaffToken(token);

    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !roleHas(req.staff.role, required)) {
      throw new ForbiddenException(`role ${req.staff.role} lacks ${required}`);
    }
    return true;
  }
}
