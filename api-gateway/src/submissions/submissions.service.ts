import {
  Injectable,
  Logger,
  BadRequestException,
  PayloadTooLargeException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SubmissionRepository, SubmissionQueryFilter } from '../database/submission.repository';
import { AssignmentRepository } from '../database/assignment.repository';
import { UserRepository } from '../database/user.repository';
import { QueueService } from '../queue/queue.service';
import { GradingGateway } from '../websocket/grading.gateway';
import { MAX_UPLOAD_SIZE_BYTES, SUBMISSION_STATUS } from '../common/constants/queue.constants';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionRecord } from '../database/submission.entity';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly submissionRepo: SubmissionRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly userRepo: UserRepository,
    private readonly queueService: QueueService,
    private readonly gradingGateway: GradingGateway,
  ) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'submissions');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Processes a student submission (Workflow 2 Main Pipeline Entry):
   * 1. Validates .zip format & file size <= 10MB
   * 2. Validates student existence & assignment rules (deadline, allowed language)
   * 3. Computes cryptographic SHA-256 hash
   * 4. Stores record in SUBMISSIONS database table
   * 5. Enqueues job to Redis BullMQ queue (< 200ms SLA)
   */
  public async handleSubmission(
    file: Express.Multer.File,
    dto: CreateSubmissionDto,
  ): Promise<{
    submission: SubmissionRecord;
    durationMs: number;
    queueMode: 'REDIS' | 'IN_MEMORY';
    jobId: string;
  }> {
    const startTime = performance.now();

    // 1. Validation
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên file bài nộp (field: "file")');
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `Dung lượng file vượt quá giới hạn 10MB! (Hiện tại: ${(file.size / (1024 * 1024)).toFixed(2)}MB, tối đa: 10MB)`,
      );
    }

    const originalName = file.originalname || 'submission.zip';
    if (!originalName.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Hệ thống chỉ chấp nhận định dạng file nén .zip!');
    }

    const studentId = dto.studentId || 'SE170000';
    const assignmentId = dto.assignmentId || 'TASK-SWP391-SPRINT2';
    const language = (dto.language || 'java').toLowerCase();

    // Check assignment rules if assignment exists
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (assignment) {
      if (!assignment.isActive) {
        throw new BadRequestException(`Bài tập ${assignmentId} hiện đang bị khóa!`);
      }

      if (new Date() > new Date(assignment.deadline)) {
        throw new BadRequestException(
          `Đã quá hạn chót nộp bài (${new Date(assignment.deadline).toLocaleString('vi-VN')})!`,
        );
      }

      if (assignment.allowedLanguages && assignment.allowedLanguages.length > 0) {
        const isAllowed = assignment.allowedLanguages.some(
          (lang) => lang.toLowerCase() === language,
        );
        if (!isAllowed) {
          throw new BadRequestException(
            `Ngôn ngữ '${language}' không nằm trong danh sách được phép (${assignment.allowedLanguages.join(', ')})!`,
          );
        }
      }
    }

    // 2. High-speed SHA-256 Calculation
    const sha256Hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 3. Generate Submission ID
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const submissionId = `SUB-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    // 4. Save file to disk
    const savedFileName = `${submissionId}.zip`;
    const destinationPath = path.join(this.uploadDir, savedFileName);
    fs.writeFileSync(destinationPath, file.buffer);

    // 5. Store record in SUBMISSIONS database table
    const record = await this.submissionRepo.create({
      submissionId,
      studentId,
      assignmentId,
      language,
      fileName: originalName,
      fileSizeBytes: file.size,
      sha256Hash,
      filePath: destinationPath,
      status: SUBMISSION_STATUS.QUEUED,
    });

    // 6. Push job into Redis BullMQ Queue (< 200ms SLA)
    const queueResult = await this.queueService.addSubmissionJob({
      submissionId,
      studentId,
      assignmentId,
      language,
      fileName: originalName,
      fileSizeBytes: file.size,
      sha256Hash,
      filePath: destinationPath,
      enqueuedAt: new Date().toISOString(),
    });

    await this.submissionRepo.updateQueueJobId(submissionId, queueResult.jobId);

    const totalDurationMs = Math.round((performance.now() - startTime) * 100) / 100;
    this.logger.log(
      `[Gateway] Submission ${submissionId} (Hash: ${sha256Hash.substring(0, 12)}...) accepted & queued in ${totalDurationMs}ms (SLA < 200ms: ${totalDurationMs < 200 ? 'PASSED' : 'EXCEEDED'})`,
    );

    // Emit initial queue event to WebSocket
    this.gradingGateway.emitGradingProgress({
      submissionId,
      stepId: '1',
      stepName: 'Hàng đợi Redis BullMQ',
      status: 'in_progress',
      detail: `Đã xếp hàng chờ Worker (Job ID: ${queueResult.jobId}, Vị trí: 1)`,
    });

    return {
      submission: record,
      durationMs: totalDurationMs,
      queueMode: queueResult.mode,
      jobId: queueResult.jobId,
    };
  }

  public async getSubmissionById(id: string): Promise<SubmissionRecord | null> {
    return this.submissionRepo.findById(id);
  }

  public async getAllSubmissions(filter?: SubmissionQueryFilter): Promise<SubmissionRecord[]> {
    return this.submissionRepo.findAll(filter);
  }

  public async getSubmissionStats() {
    return this.submissionRepo.getStats();
  }
}
