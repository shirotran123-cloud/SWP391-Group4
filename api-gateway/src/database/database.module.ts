import { Module } from '@nestjs/common';
import { SubmissionRepository } from './submission.repository';

@Module({
  providers: [SubmissionRepository],
  exports: [SubmissionRepository],
})
export class DatabaseModule {}
