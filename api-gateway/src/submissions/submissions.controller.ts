import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradingWorkerConsumer } from '../queue/grading-worker.consumer';
import { SubmissionRecord } from '../database/submission.entity';

@Controller('api/v1/submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly workerConsumer: GradingWorkerConsumer,
  ) {}

  /**
   * Main submission endpoint (Đinh Thanh Trung task):
   * Receives .zip archive, verifies <= 10MB, computes SHA-256,
   * stores SUBMISSIONS record, enqueues to BullMQ,
   * and returns 202 Accepted in < 200ms.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  public async submitAssignment(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateSubmissionDto,
  ) {
    const result = await this.submissionsService.handleSubmission(file, body);

    return {
      statusCode: HttpStatus.ACCEPTED,
      status: 'QUEUED',
      message: 'Bài nộp đã được tiếp nhận và đưa vào hàng đợi chấm điểm (Redis BullMQ).',
      data: {
        submissionId: result.submission.submissionId,
        studentId: result.submission.studentId,
        assignmentId: result.submission.assignmentId,
        language: result.submission.language,
        fileName: result.submission.fileName,
        fileSizeBytes: result.submission.fileSizeBytes,
        sha256Hash: result.submission.sha256Hash,
        status: result.submission.status,
        queueJobId: result.jobId,
        queueMode: result.queueMode,
        processingTimeMs: result.durationMs,
        createdAt: result.submission.createdAt.toISOString(),
      },
    };
  }

  @Get('stats')
  public async getSubmissionStats() {
    const stats = await this.submissionsService.getSubmissionStats();
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  @Get()
  public async getAllSubmissions(
    @Query('studentId') studentId?: string,
    @Query('assignmentId') assignmentId?: string,
    @Query('status') status?: SubmissionRecord['status'],
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const submissions = await this.submissionsService.getAllSubmissions({
      studentId,
      assignmentId,
      status,
      limit: parsedLimit,
    });
    return {
      statusCode: HttpStatus.OK,
      total: submissions.length,
      data: submissions,
    };
  }

  @Get(':id')
  public async getSubmissionById(@Param('id') id: string) {
    const submission = await this.submissionsService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với ID: ${id}`);
    }
    return {
      statusCode: HttpStatus.OK,
      data: submission,
    };
  }

  /**
   * Triggers or replays the grading pipeline for interactive live demo
   */
  @Post(':id/simulate')
  @HttpCode(HttpStatus.OK)
  public async simulateGrading(@Param('id') id: string) {
    const submission = await this.submissionsService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với ID: ${id}`);
    }

    // Trigger asynchronously so API returns instantly
    setTimeout(() => {
      this.workerConsumer.executeGradingPipeline({
        submissionId: submission.submissionId,
        studentId: submission.studentId,
        assignmentId: submission.assignmentId,
        language: submission.language,
        fileName: submission.fileName,
        fileSizeBytes: submission.fileSizeBytes,
        sha256Hash: submission.sha256Hash,
        filePath: submission.filePath,
        enqueuedAt: new Date().toISOString(),
      });
    }, 100);

    return {
      statusCode: HttpStatus.OK,
      message: `Đang phát lại luồng chấm bài cho submission ${id} qua WebSocket`,
    };
  }
}
