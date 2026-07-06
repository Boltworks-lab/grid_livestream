import { setSubPriceSchema, type SetSubPriceInput } from '@grid/shared';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Creator sets their own monthly price (§3.2 creator-set pricing). */
  @Put('price')
  setPrice(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(setSubPriceSchema)) body: SetSubPriceInput,
  ) {
    return this.subs.setPrice(user.sub, body.priceCents);
  }

  @Get(':creatorId/status')
  status(
    @CurrentUser() user: AccessTokenPayload,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
  ) {
    return this.subs.statusFor(user.sub, creatorId);
  }

  @Post(':creatorId/checkout')
  async checkout(
    @CurrentUser() user: AccessTokenPayload,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
  ) {
    const me = await this.prisma.user.findUnique({ where: { id: user.sub } });
    return this.subs.createCheckout(user.sub, me?.email ?? null, creatorId);
  }

  @Delete(':creatorId')
  cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
  ) {
    return this.subs.cancel(user.sub, creatorId);
  }
}
