import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { WalletModule } from '../wallet/wallet.module';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  imports: [WalletModule, ChatModule],
  controllers: [GiftsController],
  providers: [GiftsService],
})
export class GiftsModule {}
