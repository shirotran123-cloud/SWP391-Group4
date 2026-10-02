import { Module } from '@nestjs/common';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';

@Module({
  controllers: [AppealsController],
  providers: [AppealsService],
  exports: [AppealsService],
})
export class AppealsModule {}
