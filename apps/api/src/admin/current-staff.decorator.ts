import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { StaffTokenPayload } from './admin-auth.service';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ staff: StaffTokenPayload }>();
    return req.staff;
  },
);
