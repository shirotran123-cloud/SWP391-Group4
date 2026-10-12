import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WebSocketModule } from './websocket/websocket.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
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
    SubmissionsModule,
  ],
  controllers: [InternalEventsController],
  providers: [],
})
export class AppModule {}
