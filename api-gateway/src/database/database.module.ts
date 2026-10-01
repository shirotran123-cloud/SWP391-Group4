import { Module, Global } from '@nestjs/common';
import { SubmissionRepository } from './submission.repository';
import { UserRepository } from './user.repository';
import { CourseRepository } from './course.repository';
import { AssignmentRepository } from './assignment.repository';
import { DLQRepository } from './dlq.repository';
import { AppealRepository } from './appeal.repository';
import { TeamworkRepository } from './teamwork.repository';
import { TestCaseRepository } from './test-case.repository';
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
  ],
})
export class DatabaseModule {}


