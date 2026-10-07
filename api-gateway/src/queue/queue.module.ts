import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { GradingWorkerConsumer } from './grading-worker.consumer';
import { DLQController } from './dlq.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [WebSocketModule, DatabaseModule],
  controllers: [DLQController],
  providers: [QueueService, GradingWorkerConsumer],
  exports: [QueueService, GradingWorkerConsumer],
})
export class QueueModule {}
