import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { GradingWorkerConsumer } from './grading-worker.consumer';
import { DLQController } from './dlq.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { DatabaseModule } from '../database/database.module';
import { PlagiarismModule } from '../plagiarism/plagiarism.module';
import { SandboxModule } from '../sandbox/sandbox.module';

@Module({
  // PlagiarismModule + SandboxModule cung cấp PlagiarismService/SandboxService cho
  // GradingWorkerConsumer (bước 6 quét đạo văn AST/Winnowing và bước 2 sandbox).
  imports: [WebSocketModule, DatabaseModule, PlagiarismModule, SandboxModule],
  controllers: [DLQController],
  providers: [QueueService, GradingWorkerConsumer],
  exports: [QueueService, GradingWorkerConsumer],
})
export class QueueModule {}
