import * as AdmZip from 'adm-zip';
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
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionsService } from './submissions.service';
import { GradebookService, AttemptPolicy } from './gradebook.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradingWorkerConsumer } from '../queue/grading-worker.consumer';
import { SubmissionRecord } from '../database/submission.entity';

@Controller('api/v1/submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly workerConsumer: GradingWorkerConsumer,
    private readonly gradebookService: GradebookService,
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

  /**
   * Gradebook with ONE row per student per assignment.
   *
   * A student may upload several times, but only one attempt becomes the mark of record. The
   * policy decides which: `LAST` (default, the most recent graded attempt), `BEST` (highest
   * score) or `FIRST` (earliest). Declared before `:id` so the literal path is matched first.
   */
  @Get('gradebook')
  public async getGradebook(
    @Query('assignmentId') assignmentId?: string,
    @Query('studentId') studentId?: string,
    @Query('policy') policy?: string,
    @Query('requesterRole') requesterRole?: string,
  ) {
    // BR-04: bảng điểm chỉ dành cho giảng viên / HOD / quản trị viên.
    const role = (requesterRole || '').toUpperCase();
    if (role && !['LECTURER', 'HOD', 'ADMIN'].includes(role)) {
      throw new ForbiddenException('Không có quyền xem bảng điểm chốt.');
    }

    const normalized = (policy || 'LAST').toUpperCase();
    const allowed: AttemptPolicy[] = ['LAST', 'BEST', 'FIRST'];
    const resolved: AttemptPolicy = allowed.includes(normalized as AttemptPolicy)
      ? (normalized as AttemptPolicy)
      : 'LAST';

    const result = await this.gradebookService.buildGradebook({
      assignmentId,
      studentId,
      policy: resolved,
    });

    return {
      statusCode: HttpStatus.OK,
      message:
        result.policy === 'BEST'
          ? `Bảng điểm chốt theo điểm cao nhất: ${result.totalRows} dòng từ ${result.totalSubmissionsConsidered} bài nộp.`
          : result.policy === 'FIRST'
            ? `Bảng điểm chốt theo lần nộp đầu: ${result.totalRows} dòng từ ${result.totalSubmissionsConsidered} bài nộp.`
            : `Bảng điểm chốt theo bài nộp cuối: ${result.totalRows} dòng từ ${result.totalSubmissionsConsidered} bài nộp.`,
      total: result.totalRows,
      data: result,
    };
  }

  @Get()
  public async getAllSubmissions(
    @Query('studentId') studentId?: string,
    @Query('assignmentId') assignmentId?: string,
    @Query('status') status?: SubmissionRecord['status'],
    @Query('limit') limit?: string,
    @Query('requesterRole') requesterRole?: string,
  ) {
    // BR-04: Báo cáo đạo văn tuyệt đối không công khai cho sinh viên
    const isPrivileged = ['LECTURER', 'HOD', 'ADMIN'].includes((requesterRole || '').toUpperCase());

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
      data: submissions.map((s) => {
        const details = s.details || {};
        if (!isPrivileged) {
          // Student: strip sạch toàn bộ plagiarism metrics (BR-04)
          const {
            plagiarismMatch: _pm,
            plagiarismStatus: _ps,
            similarityRate: _sr,
            computedScoreBeforePenalty: _csbp,
            ...safeDetails
          } = details as any;
          return {
            ...s,
            similarityRate: undefined,
            plagiarismStatus: undefined,
            plagiarismMatch: undefined,
            result: safeDetails,
          };
        }
        // Lecturer/HOD/Admin: trả đầy đủ bao gồm plagiarism metrics
        const sim = details.similarityRate ?? details.plagiarismMatch?.similarityRate ?? 0;
        const pStatus = details.plagiarismStatus ||
          (sim >= 70 ? 'ĐẠO VĂN' : sim >= 40 ? 'NGHI VẤN' : 'AN TOÀN');
        return {
          ...s,
          similarityRate: sim,
          plagiarismStatus: pStatus,
          plagiarismMatch: details.plagiarismMatch ?? null,
          result: details,
        };
      }),
    };
  }

  @Get(':id')
  public async getSubmissionById(
    @Param('id') id: string,
    @Query('requesterRole') requesterRole?: string,
  ) {
    const submission = await this.submissionsService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với ID: ${id}`);
    }
    const isPrivileged = ['LECTURER', 'HOD', 'ADMIN'].includes((requesterRole || '').toUpperCase());
    const details = submission.details || {};

    if (!isPrivileged) {
      const {
        plagiarismMatch: _pm,
        plagiarismStatus: _ps,
        similarityRate: _sr,
        computedScoreBeforePenalty: _csbp,
        ...safeDetails
      } = details as any;
      return {
        statusCode: HttpStatus.OK,
        data: {
          ...submission,
          similarityRate: undefined,
          plagiarismStatus: undefined,
          plagiarismMatch: undefined,
          result: safeDetails,
        },
      };
    }
    const sim = details.similarityRate ?? details.plagiarismMatch?.similarityRate ?? 0;
    const pStatus = details.plagiarismStatus ||
      (sim >= 70 ? 'ĐẠO VĂN' : sim >= 40 ? 'NGHI VẤN' : 'AN TOÀN');
    return {
      statusCode: HttpStatus.OK,
      data: { ...submission, similarityRate: sim, plagiarismStatus: pStatus, plagiarismMatch: details.plagiarismMatch ?? null, result: details },
    };
  }

  /**
   * Download file .zip gốc của bài nộp (dành cho Giảng viên chấm tay)
   */
  @Get(':id/download')
  public async downloadSubmissionFile(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const submission = await this.submissionsService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với ID: ${id}`);
    }

    let resolvedPath = submission.filePath;
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      const localUploadPath = path.resolve(process.cwd(), 'uploads', 'submissions', `${id}.zip`);
      if (fs.existsSync(localUploadPath)) {
        resolvedPath = localUploadPath;
      } else if (resolvedPath) {
        const byBaseName = path.resolve(process.cwd(), 'uploads', 'submissions', path.basename(resolvedPath));
        if (fs.existsSync(byBaseName)) {
          resolvedPath = byBaseName;
        }
      }
    }

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      throw new NotFoundException(
        `File zip của bài nộp ${id} không tồn tại trên server. ` +
        `(Path: ${submission.filePath || 'không có'})`,
      );
    }

    const originalFileName = submission.fileName || `${id}.zip`;
    const safeFileName = originalFileName.endsWith('.zip')
      ? originalFileName
      : `${originalFileName}.zip`;

    const stat = fs.statSync(resolvedPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('X-Submission-Id', id);
    res.setHeader('X-Student-Id', submission.studentId);
    res.setHeader('X-SHA256', submission.sha256Hash || '');

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
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
  /**
   * Trích xuất và xem trực tiếp mã nguồn của bài nộp
   */
  @Get(':id/source')
  public async getSubmissionSourceCode(@Param('id') id: string) {
    const submission = await this.submissionsService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với ID: ${id}`);
    }

    if (submission.details?.sourceCode) {
      return {
        statusCode: HttpStatus.OK,
        submissionId: id,
        fileName: submission.fileName,
        language: submission.language,
        sourceCode: submission.details.sourceCode,
      };
    }

    // Cố gắng giải nén từ file .zip trên ổ cứng
    let resolvedPath = submission.filePath;
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      resolvedPath = path.resolve(process.cwd(), 'uploads', 'submissions', `${id}.zip`);
    }

    if (resolvedPath && fs.existsSync(resolvedPath)) {
      try {
        const zip = new AdmZip(resolvedPath);
        const zipEntries = zip.getEntries();
        const codeEntry =
          zipEntries.find(
            (entry: any) =>
              !entry.isDirectory &&
              (entry.entryName.toLowerCase().includes('solution.') ||
                /\.(java|cpp|c|py|cs|js|ts)$/i.test(entry.entryName)),
          ) || zipEntries.find((entry: any) => !entry.isDirectory);

        if (codeEntry) {
          const codeText = codeEntry.getData().toString('utf8');
          return {
            statusCode: HttpStatus.OK,
            submissionId: id,
            fileName: codeEntry.entryName,
            language: submission.language,
            sourceCode: codeText,
          };
        }
      } catch (err) {
        // fallback
      }
    }

    return {
      statusCode: HttpStatus.OK,
      submissionId: id,
      fileName: submission.fileName,
      language: submission.language,
      sourceCode: '// Không tìm thấy mã nguồn cho bài nộp này.',
    };
  }

}
