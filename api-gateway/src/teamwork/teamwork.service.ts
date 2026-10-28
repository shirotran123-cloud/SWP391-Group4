import { Injectable, Logger } from '@nestjs/common';
import { TeamworkRepository } from '../database/teamwork.repository';
import { TeamworkMetricRecord } from '../database/teamwork.entity';

@Injectable()
export class TeamworkService {
  private readonly logger = new Logger(TeamworkService.name);

  constructor(private readonly teamworkRepo: TeamworkRepository) {}

  public async getAllMetrics(): Promise<TeamworkMetricRecord[]> {
    return this.teamworkRepo.findAll();
  }

  public async getMetricsByClass(classId: string): Promise<TeamworkMetricRecord[]> {
    return this.teamworkRepo.findByClassId(classId);
  }

  public async getMetricsByStudent(studentId: string): Promise<TeamworkMetricRecord[]> {
    return this.teamworkRepo.findByStudentId(studentId);
  }

  /**
   * Phân tích và lưu trữ đóng góp thành viên nhóm (UC-12 & BR-12):
   * Tự động gán cờ `isFreeRider = true` nếu tỷ lệ đóng góp (contributionPct) < 10.0%
   */
  public async recordMetric(data: {
    classId: string;
    studentId: string;
    studentName?: string;
    commitCount: number;
    linesAdded: number;
    linesDeleted: number;
    contributionPct: number;
  }): Promise<TeamworkMetricRecord> {
    const isFreeRider = data.contributionPct < 10.0; // Quy tắc nghiệp vụ BR-12

    const record: TeamworkMetricRecord = {
      metricId: `METRIC-${Date.now().toString().slice(-6)}-${data.studentId.slice(-4)}`,
      classId: data.classId,
      studentId: data.studentId,
      studentName: data.studentName,
      commitCount: data.commitCount,
      linesAdded: data.linesAdded,
      linesDeleted: data.linesDeleted,
      contributionPct: data.contributionPct,
      isFreeRider,
      analyzedAt: new Date(),
    };

    if (isFreeRider) {
      this.logger.warn(
        `[Teamwork] Cảnh báo Free-rider: Sinh viên ${data.studentId} (${data.studentName || 'N/A'}) có tỷ lệ đóng góp ${data.contributionPct}% (< 10%).`,
      );
    }

    return this.teamworkRepo.upsert(record);
  }

  public async syncGitAnalytics(classId = 'CRS-SWP391'): Promise<TeamworkMetricRecord[]> {
    return this.teamworkRepo.syncLiveGitMetrics(undefined, classId);
  }
}
