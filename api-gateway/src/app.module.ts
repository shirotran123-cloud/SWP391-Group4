import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WebSocketModule } from './websocket/websocket.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { ExamsModule } from './exams/exams.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AppealsModule } from './appeals/appeals.module';
import { TeamworkModule } from './teamwork/teamwork.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { PlagiarismModule } from './plagiarism/plagiarism.module';
import { InternalEventsController } from './internal/internal-events.controller';

@Module({
  imports: [
    DatabaseModule,
    WebSocketModule,
    QueueModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    AssignmentsModule,
    TestCasesModule,
    ExamsModule,
    SubmissionsModule,
    AppealsModule,
    TeamworkModule,
    SandboxModule,
    PlagiarismModule,
  ],
  controllers: [InternalEventsController],
  providers: [],
})
export class AppModule {}


