import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DatabaseModule, QueueModule, WebSocketModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
