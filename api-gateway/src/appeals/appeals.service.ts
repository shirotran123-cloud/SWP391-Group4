import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AppealRepository, AppealQueryFilter } from '../database/appeal.repository';
import { SubmissionRepository } from '../database/submission.repository';
import { AssignmentRepository } from '../database/assignment.repository';
import { CourseRepository } from '../database/course.repository';
import { UserRepository } from '../database/user.repository';
import { AppealRecord, AppealStatus } from '../database/appeal.entity';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';

export interface EligibleReviewerDto {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  openAppeals: number;
  hasConflict: boolean;
  conflictReason?: string;
}

@Injectable()
export class AppealsService {
  private readonly logger = new Logger(AppealsService.name);
  private static readonly MAX_APPEALS_PER_SUBMISSION = 1; // Quy chế khảo thí: Mỗi bài nộp chỉ phúc khảo 1 lần duy nhất (Final Verdict)
  private static readonly DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 giờ

  constructor(
    private readonly appealRepo: AppealRepository,
    private readonly submissionRepo: SubmissionRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly courseRepo: CourseRepository,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Xác định các User có xung đột quyền lợi (Conflict of Interest):
   * 1. Sinh viên sở hữu bài nộp (không được tự chấm).
   * 2. Giảng viên phụ trách môn học / ra đề / chấm lần đầu.
   */
  public async getConflictedUserIds(
    submissionId: string,
  ): Promise<{ conflictedIds: string[]; details: Record<string, string> }> {
    const conflictedIds: string[] = [];
    const details: Record<string, string> = {};

    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      return { conflictedIds, details };
    }

    // 1. Sinh viên nộp bài
    if (submission.studentId) {
      conflictedIds.push(submission.studentId);
      details[submission.studentId] = 'Sinh viên sở hữu bài nộp (không thể tự chấm)';
    }

    // 2. Giảng viên phụ trách môn / ra đề
    if (submission.assignmentId) {
      const assignment = await this.assignmentRepo.findById(submission.assignmentId);
      if (assignment?.courseId) {
        const course = await this.courseRepo.findById(assignment.courseId);
        if (course?.instructorId) {
          if (!conflictedIds.includes(course.instructorId)) {
            conflictedIds.push(course.instructorId);
          }
          details[course.instructorId] = `Giảng viên phụ trách môn ${course.courseCode} (${course.instructorId}) - Người ra đề / chấm lần đầu`;
        }
      }
    }

    // 3. Người chấm lần đầu lưu trong metadata (nếu có)
    if (submission.details?.gradedById) {
      const graderId = String(submission.details.gradedById);
      if (!conflictedIds.includes(graderId)) {
        conflictedIds.push(graderId);
      }
      details[graderId] = 'Giảng viên chấm lần đầu';
    }

    return { conflictedIds, details };
  }

  /**
   * Danh sách Giảng viên đủ điều kiện kèm số lượng đơn đang thụ lý và cờ cảnh báo xung đột quyền lợi
   */
  public async getEligibleReviewers(appealId: string): Promise<EligibleReviewerDto[]> {
    const appeal = await this.appealRepo.findById(appealId);
    if (!appeal) {
      throw new NotFoundException(`Không tìm thấy đơn phúc khảo: ${appealId}`);
    }

    const { conflictedIds, details } = await this.getConflictedUserIds(appeal.submissionId);
    const workloads = await this.appealRepo.getWorkloadByReviewer();

    const allInstructors = (await this.userRepo.findAll()).filter(
      (u) => u.role === 'INSTRUCTOR' || u.role === 'HOD',
    );

    return allInstructors.map((u) => {
      const hasConflict = conflictedIds.includes(u.userId);
      return {
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        openAppeals: workloads[u.userId] || 0,
        hasConflict,
        conflictReason: hasConflict ? details[u.userId] : undefined,
      };
    });
  }

  /**
   * Tạo đơn khiếu nại / phúc khảo (UC-06 & BR-05):
   * - Kiểm tra bài nộp tồn tại
   * - Kiểm tra số lần phúc khảo: 1 lần duy nhất
   * - Kiểm tra thời hạn khiếu nại <= 48 giờ
   * - Chụp snapshot bất biến: submissionSha256, originalScore
   */
  public async createAppeal(dto: CreateAppealDto): Promise<AppealRecord> {
    const submission = await this.submissionRepo.findById(dto.submissionId);
    if (!submission) {
      throw new NotFoundException(`Không tìm thấy bài nộp với mã: ${dto.submissionId}`);
    }

    // 1. Kiểm tra số lần khiếu nại (1 lần duy nhất theo thông lệ đại học)
    const existingCount = await this.appealRepo.countBySubmissionId(dto.submissionId);
    if (existingCount >= AppealsService.MAX_APPEALS_PER_SUBMISSION) {
      throw new BadRequestException(
        `Vượt quá số lần phúc khảo cho phép! (Bài nộp này đã có ${existingCount}/1 lần khiếu nại. Theo quy chế, mỗi bài chỉ được phúc khảo 1 lần duy nhất).`,
      );
    }

    // 2. Kiểm tra cửa sổ thời gian (BR-05: <= 48h, chỉ áp dụng strict trên production)
    const submissionTime = new Date(submission.createdAt).getTime();
    const elapsedTime = Date.now() - submissionTime;
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && elapsedTime > AppealsService.DISPUTE_WINDOW_MS) {
      const elapsedHours = (elapsedTime / (1000 * 3600)).toFixed(1);
      throw new BadRequestException(
        `Đã quá thời hạn phúc khảo cho phép! (Đã trôi qua ${elapsedHours} giờ kể từ khi nộp, quy định BR-05 tối đa 48 giờ).`,
      );
    }

    const appealId = `APL-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Lưu snapshot bất biến của bài nộp tại thời điểm tạo đơn
    const submissionSha256 = submission.sha256Hash || 'N/A';
    const originalScore = submission.score ?? 0;

    const newAppeal = await this.appealRepo.create({
      appealId,
      submissionId: dto.submissionId,
      studentId: dto.studentId,
      reason: dto.reason.trim(),
      status: 'PENDING',
      submissionSha256,
      originalScore,
    });

    this.logger.log(
      `[Appeals] Sinh viên ${dto.studentId} đã gửi đơn phúc khảo ${appealId} cho bài nộp ${dto.submissionId} (Lần ${existingCount + 1}/1, SHA256: ${submissionSha256.slice(0, 10)}...).`,
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

  public async assignReviewer(
    appealId: string,
    reviewerId: string,
    assignedById: string = 'admin',
  ): Promise<AppealRecord> {
    const appeal = await this.appealRepo.findById(appealId);
    if (!appeal) {
      throw new NotFoundException(`Không tìm thấy đơn phúc khảo: ${appealId}`);
    }

    // Kiểm tra xung đột quyền lợi (Conflict of Interest)
    const { conflictedIds, details } = await this.getConflictedUserIds(appeal.submissionId);
    if (conflictedIds.includes(reviewerId)) {
      const reason = details[reviewerId] || 'Giảng viên phụ trách môn / ra đề chấm lần đầu';
      throw new BadRequestException(
        `Xung đột quyền lợi (Conflict of Interest): Không thể phân công ${reviewerId} do là ${reason}. Vui lòng chọn Giảng viên độc lập khác.`,
      );
    }

    const updated = await this.appealRepo.updateAssignment(appealId, reviewerId, assignedById);
    this.logger.log(
      `[Appeals] Admin (${assignedById}) đã phân công đơn phúc khảo ${appealId} cho Giảng viên độc lập: ${reviewerId}.`,
    );
    return updated!;
  }

  public async resolveAppeal(appealId: string, dto: ResolveAppealDto): Promise<AppealRecord> {
    const appeal = await this.appealRepo.findById(appealId);
    if (!appeal) {
      throw new NotFoundException(`Không tìm thấy đơn phúc khảo: ${appealId}`);
    }

    const sub = await this.submissionRepo.findById(appeal.submissionId);
    if (!sub) {
      throw new NotFoundException(`Không tìm thấy bài nộp gốc: ${appeal.submissionId}`);
    }

    // Kiểm tra tính toàn vẹn (Integrity Check) qua mã băm SHA-256
    if (appeal.submissionSha256 && sub.sha256Hash && appeal.submissionSha256 !== 'N/A') {
      if (appeal.submissionSha256 !== sub.sha256Hash) {
        throw new BadRequestException(
          `CẢNH BÁO BẢO MẬT: Mã băm SHA-256 của bài nộp (${sub.sha256Hash.slice(0, 10)}...) không khớp với snapshot lúc gửi đơn (${appeal.submissionSha256.slice(0, 10)}...). Bài nộp có dấu hiệu bị can thiệp sau khi khiếu nại!`,
        );
      }
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
      await this.submissionRepo.updateStatus(
        appeal.submissionId,
        sub.status,
        undefined,
        dto.adjustedScore,
      );
      this.logger.log(
        `[Appeals] Đã cập nhật điểm bài nộp ${sub.submissionId} từ ${appeal.originalScore ?? sub.score} thành ${dto.adjustedScore} theo đơn phúc khảo ${appealId}.`,
      );
    }

    return updated!;
  }
}
