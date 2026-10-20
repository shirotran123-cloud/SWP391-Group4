import { Module, Global } from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';
import { PlagiarismController } from './plagiarism.controller';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PlagiarismController],
  providers: [PlagiarismService],
  exports: [PlagiarismService],
})
export class PlagiarismModule {}
