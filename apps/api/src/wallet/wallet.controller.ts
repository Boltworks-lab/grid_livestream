import { DIAMOND_PACKAGES, topupCheckoutSchema, type TopupCheckoutInput } from '@grid/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  balances(@CurrentUser() user: AccessTokenPayload) {
    return this.wallet.balances(user.sub);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AccessTokenPayload, @Query('cursor') cursor?: string) {
    return this.wallet.transactions(user.sub, cursor);
  }

  @Public()
  @Get('packages')
  packages() {
    return DIAMOND_PACKAGES;
  }

  @Post('topup/checkout')
  async checkout(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(topupCheckoutSchema)) body: TopupCheckoutInput,
  ) {
    return { checkoutUrl: await this.wallet.createTopupCheckout(user.sub, body.packageId) };
  }
}
