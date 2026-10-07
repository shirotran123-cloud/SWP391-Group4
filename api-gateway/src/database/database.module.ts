import { Module, Global } from '@nestjs/common';
import { SubmissionRepository } from './submission.repository';
import { UserRepository } from './user.repository';
import { CourseRepository } from './course.repository';
import { AssignmentRepository } from './assignment.repository';
import { DLQRepository } from './dlq.repository';

@Global()
@Module({
  providers: [
    SubmissionRepository,
    UserRepository,
    CourseRepository,
    AssignmentRepository,
    DLQRepository,
  ],
  exports: [
    SubmissionRepository,
    UserRepository,
    CourseRepository,
    AssignmentRepository,
    DLQRepository,
  ],
})
export class DatabaseModule {}
