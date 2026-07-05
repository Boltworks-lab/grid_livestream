import { forwardRef, Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { EntitlementService } from './entitlement.service';
import { LivekitService } from './livekit.service';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';

@Module({
  imports: [forwardRef(() => ChatModule)],
  controllers: [StreamsController],
  providers: [StreamsService, EntitlementService, LivekitService],
  exports: [EntitlementService],
})
export class StreamsModule {}
