import { Module } from '@nestjs/common';

import { LedgerService } from './ledger.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  controllers: [WalletController],
  providers: [LedgerService, WalletService],
  exports: [LedgerService],
})
export class WalletModule {}
