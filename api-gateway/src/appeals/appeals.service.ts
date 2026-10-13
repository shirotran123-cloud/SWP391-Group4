import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AppealRepository, AppealQueryFilter } from '../database/appeal.repository';
import { SubmissionRepository } from '../database/submission.repository';
import { AppealRecord, AppealStatus } from '../database/appeal.entity';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';

@Injectable()
export class AppealsService {
  private readonly logger = new Logger(AppealsService.name);
  private static readonly MAX_APPEALS_PER_SUBMISSION = 2; // BR-05
  private static readonly DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 giờ

  constructor(
    private readonly appealRepo: AppealRepository,
    private readonly submissionRepo: SubmissionRepository,
  ) {}

  /**
   * Tạo đơn khiếu nại / phúc khảo (UC-06 & BR-05):
   * - Kiểm tra bài nộp tồn tại
   * - Kiểm tra số lần phúc khảo <= 2 lần
   * - Kiểm tra thời hạn khiếu nại <= 48 giờ
   */
  public async createAppeal(dto: CreateAppealDto): Promise<AppealRecord> {
    const submission = await this.submissionRepo.findById(dto.submissionId);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với mã: ${dto.submissionId}`);
    }

    // 1. Kiểm tra số lần khiếu nại (BR-05: <= 2 lần)
    const existingCount = await this.appealRepo.countBySubmissionId(dto.submissionId);
    if (existingCount >= AppealsService.MAX_APPEALS_PER_SUBMISSION) {
      throw new BadRequestException(
        `Vượt quá số lần phúc khảo cho phép! (Bài nộp này đã có ${existingCount}/2 lần khiếu nại theo quy tắc BR-05).`,
      );
    }

    // 2. Kiểm tra cửa sổ thời gian (BR-05: <= 48h)
    const submissionTime = new Date(submission.createdAt).getTime();
    const elapsedTime = Date.now() - submissionTime;
    if (elapsedTime > AppealsService.DISPUTE_WINDOW_MS) {
      const elapsedHours = (elapsedTime / (1000 * 3600)).toFixed(1);
      throw new BadRequestException(
        `Đã quá thời hạn phúc khảo cho phép! (Đã trôi qua ${elapsedHours} giờ kể từ khi nộp, quy định BR-05 tối đa 48 giờ).`,
      );
    }

    const appealId = `APL-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newAppeal = await this.appealRepo.create({
      appealId,
      submissionId: dto.submissionId,
      studentId: dto.studentId,
      reason: dto.reason.trim(),
      status: 'PENDING',
    });

    this.logger.log(
      `[Appeals] Sinh viên ${dto.studentId} đã gửi đơn phúc khảo ${appealId} cho bài nộp ${dto.submissionId} (Lần ${existingCount + 1}/2).`,
    );

    return newAppeal;
  }

  public async getAppeals(filter?: AppealQueryFilter): Promise<AppealRecord[]> {
    return this.appealRepo.findAll(filter);
  }

  public async getAppealById(appealId: string): Promise<AppealRecord> {
    const appeal = await this.appealRepo.findById(appealId);
    if (!appeal) {
      throw new NotFoundException(`Không tìm thấy đơn phúc khảo: ${appealId}`);
    }
    return appeal;
  }

  public async resolveAppeal(appealId: string, dto: ResolveAppealDto): Promise<AppealRecord> {
    const appeal = await this.appealRepo.findById(appealId);
    if (!appeal) {
      throw new NotFoundException(`Không tìm thấy đơn phúc khảo: ${appealId}`);
    }

    const updated = await this.appealRepo.updateResolution(
      appealId,
      dto.status,
      dto.reviewerId,
      dto.resolutionNote,
      dto.adjustedScore,
    );

    // Nếu chấp thuận và có điểm điều chỉnh, cập nhật vào bảng Submissions
    if (dto.status === 'ACCEPTED' && dto.adjustedScore !== undefined) {
      const sub = await this.submissionRepo.findById(appeal.submissionId);
      if (sub) {
        sub.score = dto.adjustedScore;
        sub.updatedAt = new Date();
        this.logger.log(
          `[Appeals] Đã cập nhật điểm bài nộp ${sub.submissionId} thành ${dto.adjustedScore} theo đơn phúc khảo ${appealId}.`,
        );
      }
    }

    return updated!;
  }
}
