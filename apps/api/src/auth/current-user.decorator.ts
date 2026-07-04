import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AccessTokenPayload {
  /** user id */
  sub: string;
  handle: string;
  role: 'USER' | 'CREATOR';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: AccessTokenPayload }>();
    return req.user;
  },
);
