import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamGeneratorClient } from './exam-generator.client';
import { TestCasesModule } from '../test-cases/test-cases.module';

/**
 * Workflow 1 (UC-08) module.
 *
 * DatabaseModule is @Global(), so AssignmentRepository / TestCaseRepository /
 * PostgresService are injectable without importing it. TestCasesModule is
 * imported because it exports TestCasesService (used for test-case persistence).
 */
@Module({
  imports: [TestCasesModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamGeneratorClient],
  exports: [ExamsService, ExamGeneratorClient],
})
export class ExamsModule {}
