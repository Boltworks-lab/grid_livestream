import { forwardRef, Module } from '@nestjs/common';

import { StreamsModule } from '../streams/streams.module';
import { ChatGateway } from './chat.gateway';
import { ChatPersistenceService } from './chat-persistence.service';
import { ChatService } from './chat.service';

@Module({
  imports: [forwardRef(() => StreamsModule)],
  providers: [ChatGateway, ChatService, ChatPersistenceService],
  exports: [ChatService],
})
export class ChatModule {}
