import { Module } from '@nestjs/common';
import { GradingGateway } from './grading.gateway';

@Module({
  providers: [GradingGateway],
  exports: [GradingGateway],
})
export class WebSocketModule {}
