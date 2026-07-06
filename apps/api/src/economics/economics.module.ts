import { Global, Module } from '@nestjs/common';

import { EconomicsService } from './economics.service';

@Global()
@Module({
  providers: [EconomicsService],
  exports: [EconomicsService],
})
export class EconomicsModule {}
