import { economicsSchema, type Economics } from '@grid/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PayoutsService } from '../payouts/payouts.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CurrentStaff } from './current-staff.decorator';
import type { StaffTokenPayload } from './admin-auth.service';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const totpSchema = z.object({ token: z.string().min(20), code: z.string().length(6) });
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const actionSchema = z.object({
  action: z.enum(['WARN', 'MUTE', 'REMOVE_CONTENT', 'SUSPEND', 'BAN', 'SHADOWBAN']),
  reason: z.string().trim().min(3).max(500),
});

/** Staff login — public routes, throttled hard, separate trust domain. */
@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>) {
    return this.auth.login(body.email, body.password);
  }

  @Post('totp/enroll')
  @HttpCode(200)
  enroll(@Body(new ZodValidationPipe(totpSchema)) body: z.infer<typeof totpSchema>) {
    return this.auth.completeEnrollment(body.token, body.code);
  }

  @Post('totp/verify')
  @HttpCode(200)
  verify(@Body(new ZodValidationPipe(totpSchema)) body: z.infer<typeof totpSchema>) {
    return this.auth.verifyTotp(body.token, body.code);
  }
}

/** All operational admin endpoints — staff token required (AdminGuard). */
@Public() // bypass the USER guard; AdminGuard enforces the staff domain
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('payouts')
  async payoutQueue(@Query('status') status?: string) {
    return (await this.admin.payoutQueue(status)).map((p) => ({
      id: p.id,
      creatorHandle: p.creator.user.handle,
      coinAmount: Number(p.coinAmount),
      fiatAmountCents: p.fiatAmountCents,
      status: p.status,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  @Post('payouts/:id/approve')
  @HttpCode(200)
  async approvePayout(
    @CurrentStaff() staff: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const payout = await this.payouts.approve(id, staff.sub);
    return { id: payout.id, status: payout.status, failureReason: payout.failureReason };
  }

  @Post('payouts/:id/reject')
  @HttpCode(200)
  async rejectPayout(
    @CurrentStaff() staff: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
  ) {
    const payout = await this.admin.rejectPayout(id, staff.sub, body.reason);
    return { id: payout.id, status: payout.status };
  }

  @Get('reports')
  async reportQueue() {
    return (await this.admin.reportQueue()).map((r) => ({
      id: r.id,
      reporterHandle: r.reporter.handle,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post('reports/:id/action')
  @HttpCode(200)
  async actOnReport(
    @CurrentStaff() staff: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(actionSchema)) body: z.infer<typeof actionSchema>,
  ) {
    const report = await this.admin.actOnReport(id, staff.sub, body.action, body.reason);
    return { id: report.id, status: report.status };
  }

  @Post('reports/:id/dismiss')
  @HttpCode(200)
  async dismissReport(
    @CurrentStaff() staff: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const report = await this.admin.dismissReport(id, staff.sub);
    return { id: report.id, status: report.status };
  }

  @Get('users/lookup')
  lookupUser(@Query('q') q: string) {
    return this.admin.lookupUser((q ?? '').trim().toLowerCase());
  }

  @Get('economics')
  getEconomics() {
    return this.admin.getEconomics();
  }

  @Put('economics')
  updateEconomics(
    @CurrentStaff() staff: StaffTokenPayload,
    @Body(new ZodValidationPipe(economicsSchema)) body: Economics,
  ) {
    return this.admin.updateEconomics(body, staff.sub);
  }

  @Get('audit')
  async auditLog() {
    return (await this.admin.auditLog()).map((entry) => ({
      id: entry.id,
      staffEmail: entry.staff.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}
