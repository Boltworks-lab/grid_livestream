import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController, AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [WalletModule, PayoutsModule, ChatModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminGuard, AdminService],
})
export class AdminModule {}
