import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { GradingWorkerConsumer } from './grading-worker.consumer';
import { WebSocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [WebSocketModule, DatabaseModule],
  providers: [QueueService, GradingWorkerConsumer],
  exports: [QueueService, GradingWorkerConsumer],
})
export class QueueModule {}
