import { Module } from '@nestjs/common';
import { TeamworkController } from './teamwork.controller';
import { TeamworkService } from './teamwork.service';

@Module({
  controllers: [TeamworkController],
  providers: [TeamworkService],
  exports: [TeamworkService],
})
export class TeamworkModule {}
