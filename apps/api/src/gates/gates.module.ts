import { Module } from '@nestjs/common';

import { WalletModule } from '../wallet/wallet.module';
import { GatesController } from './gates.controller';
import { GatesService } from './gates.service';

@Module({
  imports: [WalletModule],
  controllers: [GatesController],
  providers: [GatesService],
})
export class GatesModule {}
