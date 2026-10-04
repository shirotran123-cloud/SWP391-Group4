import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WebSocketModule } from './websocket/websocket.module';
import { QueueModule } from './queue/queue.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { InternalEventsController } from './internal/internal-events.controller';

@Module({
  imports: [DatabaseModule, WebSocketModule, QueueModule, SubmissionsModule],
  controllers: [InternalEventsController],
  providers: [],
})
export class AppModule {}
