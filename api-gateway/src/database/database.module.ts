import { Module, Global } from '@nestjs/common';
import { SubmissionRepository } from './submission.repository';
import { UserRepository } from './user.repository';
import { CourseRepository } from './course.repository';
import { AssignmentRepository } from './assignment.repository';
import { DLQRepository } from './dlq.repository';
import { AppealRepository } from './appeal.repository';
import { TeamworkRepository } from './teamwork.repository';
import { TestCaseRepository } from './test-case.repository';
import { SubmissionDetailRepository } from './submission-detail.repository';
import { AiReviewRepository } from './ai-review.repository';
import { PlagiarismRepository } from './plagiarism.repository';
import { AstFingerprintRepository } from './ast-fingerprint.repository';
import { PostgresService } from './postgres.service';

@Global()
@Module({
  providers: [
    PostgresService,
    SubmissionRepository,
    UserRepository,
    CourseRepository,
    AssignmentRepository,
    DLQRepository,
    AppealRepository,
    TeamworkRepository,
    TestCaseRepository,
    SubmissionDetailRepository,
    AiReviewRepository,
    PlagiarismRepository,
    AstFingerprintRepository,
  ],
  exports: [
    PostgresService,
    SubmissionRepository,
    UserRepository,
    CourseRepository,
    AssignmentRepository,
    DLQRepository,
    AppealRepository,
    TeamworkRepository,
    TestCaseRepository,
    SubmissionDetailRepository,
    AiReviewRepository,
    PlagiarismRepository,
    AstFingerprintRepository,
  ],
})
export class DatabaseModule {}


