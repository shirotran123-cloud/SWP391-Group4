import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';
import { SubmissionRepository } from '../database/submission.repository';

export class AnalyzePlagiarismDto {
  role?: string;
}

/**
 * BR-04: báo cáo đạo văn chỉ dành cho Giảng viên/HOD.
 * Sinh viên (role = STUDENT) luôn nhận HTTP 403 và KHÔNG bao giờ thấy dữ liệu so khớp.
 */
function assertStaffRole(role: string | undefined, logger: Logger): void {
  const normalized = (role || '').toUpperCase();
  if (normalized === 'STUDENT') {
    logger.warn(`[Plagiarism] BR-04: từ chối truy cập báo cáo đạo văn cho role=${normalized}.`);
    throw new ForbiddenException('Báo cáo đạo văn chỉ dành cho Giảng viên/HOD (BR-04).');
  }
}

@Controller('api/v1/plagiarism')
export class PlagiarismController {
  private readonly logger = new Logger(PlagiarismController.name);

  constructor(
    private readonly plagiarismService: PlagiarismService,
    private readonly submissionRepo: SubmissionRepository,
  ) {}

  /**
   * POST api/v1/plagiarism/analyze/:submissionId
   * body { role?: string }
   */
  @Post('analyze/:submissionId')
  @HttpCode(HttpStatus.OK)
  public async analyzeSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: AnalyzePlagiarismDto,
  ) {
    assertStaffRole(dto?.role, this.logger);

    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với mã: ${submissionId}`);
    }

    const sourceCode = await this.readSubmissionSource(submission.filePath, submission.language);
    if (sourceCode === null) {
      throw new NotFoundException(
        `Không giải nén được source code của bài nộp ${submissionId} (${submission.filePath}).`,
      );
    }

    const result = await this.plagiarismService.detectForSubmission({
      submissionId: submission.submissionId,
      studentId: submission.studentId,
      assignmentId: submission.assignmentId,
      language: submission.language,
      sourceCode,
    });

    return {
      statusCode: HttpStatus.OK,
      message:
        result.topMatch && result.topMatch.isFlagged
          ? `Phát hiện bài nộp ${submissionId} có dấu hiệu đạo văn (${result.topMatch.similarityRate}%).`
          : `Đã phân tích AST cho bài nộp ${submissionId} — không có cặp nào vượt ngưỡng 70%.`,
      data: result,
    };
  }

  /**
   * GET api/v1/plagiarism/assignment/:assignmentId/matrix?role=
   */
  @Get('assignment/:assignmentId/matrix')
  public async getAssignmentMatrix(
    @Param('assignmentId') assignmentId: string,
    @Query('role') role?: string,
  ) {
    assertStaffRole(role, this.logger);
    const matrix = await this.plagiarismService.getAssignmentMatrix(assignmentId);
    return {
      statusCode: HttpStatus.OK,
      message: `Ma trận tương đồng AST của assignment ${assignmentId} (${matrix.flaggedPairsCount}/${matrix.totalPairsCompared} cặp bị gắn cờ).`,
      data: matrix,
    };
  }

  /**
   * GET api/v1/plagiarism/reports?assignmentId=&flaggedOnly=&role=
   */
  @Get('reports')
  public async getReports(
    @Query('assignmentId') assignmentId?: string,
    @Query('flaggedOnly') flaggedOnly?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    assertStaffRole(role, this.logger);

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const reports = await this.plagiarismService.getReports({
      assignmentId,
      flaggedOnly: flaggedOnly === 'true' || flaggedOnly === '1',
      limit: Number.isNaN(parsedLimit as number) ? undefined : parsedLimit,
    });

    return {
      statusCode: HttpStatus.OK,
      total: reports.length,
      data: reports,
    };
  }

  /**
   * GET api/v1/plagiarism/fingerprints/:submissionId?role=
   */
  @Get('fingerprints/:submissionId')
  public async getFingerprints(
    @Param('submissionId') submissionId: string,
    @Query('role') role?: string,
  ) {
    assertStaffRole(role, this.logger);
    const result = await this.plagiarismService.getFingerprints(submissionId);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /** Reads the submission's source code through the shared zip-extraction pattern. */
  private async readSubmissionSource(filePath: string, language: string): Promise<string | null> {
    try {
      return this.plagiarismService.extractSourceCodeFromZip(filePath, language);
    } catch {
      return null;
    }
  }
}
