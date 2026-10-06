import { Module } from '@nestjs/common';
import { PlagiarismController } from './plagiarism.controller';
import { PlagiarismService } from './plagiarism.service';
import { PlagiarismRepository } from '../database/plagiarism.repository';

/**
 * Plagiarism detection module (Workflow 2 step 6).
 *
 * `DatabaseModule` is `@Global()`, so `PostgresService`, `SubmissionRepository` and
 * `UserRepository` are injected without re-importing it here. `PlagiarismService` and
 * `PlagiarismRepository` are exported for the grading worker integrator.
 */
@Module({
  controllers: [PlagiarismController],
  providers: [PlagiarismService, PlagiarismRepository],
  exports: [PlagiarismService, PlagiarismRepository],
})
export class PlagiarismModule {}
