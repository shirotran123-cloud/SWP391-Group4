import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TeamworkMetricRecord } from './teamwork.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

@Injectable()
export class TeamworkRepository implements OnModuleInit {
  private readonly logger = new Logger(TeamworkRepository.name);
  private readonly records: Map<string, TeamworkMetricRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'teamwork_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    await this.syncWithPostgres();
    try {
      await this.syncLiveGitMetrics();
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] Live Git sync skipped on init: ${err.message}`);
    }
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: TeamworkMetricRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.metricId, {
            ...record,
            analyzedAt: new Date(record.analyzedAt),
          });
        }
        this.logger.log(`[TeamworkRepository] Loaded ${this.records.size} teamwork metrics.`);
      } else {
        this.seedInitialMetrics();
      }
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialMetrics();
    }
  }

  private seedInitialMetrics(): void {
    const defaultMetrics: TeamworkMetricRecord[] = [
      {
        metricId: 'METRIC-01',
        classId: 'CRS-SWP391',
        studentId: 'SE170000',
        studentName: 'Đinh Thành Trung',
        commitCount: 14,
        linesAdded: 1850,
        linesDeleted: 320,
        contributionPct: 32.5,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-02',
        classId: 'CRS-SWP391',
        studentId: 'SE170123',
        studentName: 'Trần Thanh Nguyên',
        commitCount: 10,
        linesAdded: 1100,
        linesDeleted: 150,
        contributionPct: 28.0,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-03',
        classId: 'CRS-SWP391',
        studentId: 'SE170456',
        studentName: 'Nguyễn Hoàng Vinh',
        commitCount: 12,
        linesAdded: 1620,
        linesDeleted: 210,
        contributionPct: 24.5,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-04',
        classId: 'CRS-SWP391',
        studentId: 'SE179999',
        studentName: 'Nguyễn Văn Ỷ Lại (Free-rider sample)',
        commitCount: 1,
        linesAdded: 35,
        linesDeleted: 5,
        contributionPct: 1.5,
        isFreeRider: true,
        analyzedAt: new Date(),
      },
    ];

    for (const m of defaultMetrics) {
      this.records.set(m.metricId, m);
    }
    this.persist();
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[TeamworkRepository] Failed to persist store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT tm.metric_id, tm.class_id, tm.student_id, u.full_name as student_name, 
                tm.commit_count, tm.lines_added, tm.lines_deleted, tm.contribution_pct, 
                tm.is_free_rider, tm.analyzed_at
         FROM teamwork_metrics tm
         LEFT JOIN users u ON tm.student_id = u.user_id`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.metric_id, {
            metricId: r.metric_id,
            classId: r.class_id,
            studentId: r.student_id,
            studentName: r.student_name || r.student_id,
            commitCount: r.commit_count,
            linesAdded: r.lines_added,
            linesDeleted: r.lines_deleted,
            contributionPct: parseFloat(r.contribution_pct),
            isFreeRider: r.is_free_rider,
            analyzedAt: new Date(r.analyzed_at),
          });
        }
        this.logger.log(`✅ [TeamworkRepository] Đã nạp ${rows.length} teamwork metrics từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(m: TeamworkMetricRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      await this.postgres.safeQuery(
        `INSERT INTO teamwork_metrics (metric_id, class_id, student_id, commit_count, lines_added, lines_deleted, contribution_pct, is_free_rider, analyzed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (class_id, student_id) DO UPDATE SET
           commit_count = EXCLUDED.commit_count,
           lines_added = EXCLUDED.lines_added,
           lines_deleted = EXCLUDED.lines_deleted,
           contribution_pct = EXCLUDED.contribution_pct,
           is_free_rider = EXCLUDED.is_free_rider,
           analyzed_at = NOW()`,
        [
          m.metricId,
          m.classId,
          m.studentId,
          m.commitCount,
          m.linesAdded,
          m.linesDeleted,
          m.contributionPct,
          m.isFreeRider,
          m.analyzedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] Postgres save error for ${m.metricId}: ${err.message}`);
    }
  }

  public async findAll(): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values()).sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime());
  }

  public async getByClass(classId: string): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.classId === classId);
  }

  public async findByClassId(classId: string): Promise<TeamworkMetricRecord[]> {
    return this.getByClass(classId);
  }

  public async getByStudent(studentId: string): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.studentId === studentId);
  }

  public async findByStudentId(studentId: string): Promise<TeamworkMetricRecord[]> {
    return this.getByStudent(studentId);
  }

  public async save(metric: TeamworkMetricRecord): Promise<TeamworkMetricRecord> {
    this.records.set(metric.metricId, metric);
    this.persist();
    await this.saveToPostgres(metric);
    return metric;
  }

  public async upsert(metric: TeamworkMetricRecord): Promise<TeamworkMetricRecord> {
    return this.save(metric);
  }

  public async saveBatch(metrics: TeamworkMetricRecord[]): Promise<TeamworkMetricRecord[]> {
    for (const m of metrics) {
      this.records.set(m.metricId, m);
      await this.saveToPostgres(m);
    }
    this.persist();
    return metrics;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // THÀNH VIÊN 4: LIVE GIT CLI PARSER & ANALYTICS ENGINE (UC-12 & BR-12)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Chạy lệnh Git CLI `git log --shortstat` trực tiếp trên repository để phân tích
   * lịch sử commit thật, author, email, và số dòng code thêm/xoá (LOC).
   */
  public executeGitLog(repoPath?: string, maxCommits = 1000): string {
    const targetPath = repoPath || path.resolve(process.cwd());
    const command = `git log -n ${maxCommits} --shortstat --pretty=format:"COMMIT:%H|AUTHOR:%an|EMAIL:%ae"`;
    try {
      return child_process.execSync(command, {
        cwd: targetPath,
        encoding: 'utf-8',
        timeout: 10000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository:GitCLI] Không thể chạy lệnh git log: ${err.message}`);
      return '';
    }
  }

  /**
   * Parser chuyên biệt bóc tách kết quả từ `git log --shortstat`.
   * Cú pháp bóc tách:
   * COMMIT:<hash>|AUTHOR:<name>|EMAIL:<email>
   * <X> files changed, <Y> insertions(+), <Z> deletions(-)
   */
  public parseGitShortstat(gitOutput: string): Map<
    string,
    { author: string; email: string; commitCount: number; linesAdded: number; linesDeleted: number }
  > {
    const authorStats = new Map<
      string,
      { author: string; email: string; commitCount: number; linesAdded: number; linesDeleted: number }
    >();

    if (!gitOutput || typeof gitOutput !== 'string') {
      return authorStats;
    }

    const lines = gitOutput.split('\n');
    let currentAuthor = '';
    let currentEmail = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('COMMIT:')) {
        const parts = line.split('|');
        currentAuthor = parts[1]?.replace('AUTHOR:', '').trim() || 'Unknown';
        currentEmail = parts[2]?.replace('EMAIL:', '').trim().toLowerCase() || 'unknown@aita.edu.vn';

        const key = currentEmail || currentAuthor;
        if (!authorStats.has(key)) {
          authorStats.set(key, {
            author: currentAuthor,
            email: currentEmail,
            commitCount: 0,
            linesAdded: 0,
            linesDeleted: 0,
          });
        }
        authorStats.get(key)!.commitCount += 1;
      } else if (line.includes('changed') || line.includes('insertion') || line.includes('deletion')) {
        let added = 0;
        let deleted = 0;

        const addMatch = line.match(/(\d+)\s+insertion/);
        if (addMatch) added = parseInt(addMatch[1], 10) || 0;

        const delMatch = line.match(/(\d+)\s+deletion/);
        if (delMatch) deleted = parseInt(delMatch[1], 10) || 0;

        const key = currentEmail || currentAuthor;
        if (authorStats.has(key)) {
          authorStats.get(key)!.linesAdded += added;
          authorStats.get(key)!.linesDeleted += deleted;
        }
      }
    }

    return authorStats;
  }

  /**
   * Đồng bộ phân tích Git Live vào CSDL (PostgreSQL & JSON store).
   * Tự động mapping sinh viên, tính toán tỷ lệ đóng góp (contributionPct) và
   * tự động gắn cờ Free-Rider (isFreeRider = true) nếu contributionPct < 10.0% theo BR-12.
   */
  public async syncLiveGitMetrics(repoPath?: string, classId = 'CRS-SWP391'): Promise<TeamworkMetricRecord[]> {
    const gitOutput = this.executeGitLog(repoPath);
    if (!gitOutput) {
      this.logger.warn('[TeamworkRepository] Không nhận được log Git CLI, giữ nguyên metrics hiện tại.');
      return this.findByClassId(classId);
    }

    const parsedStats = this.parseGitShortstat(gitOutput);
    if (parsedStats.size === 0) {
      return this.findByClassId(classId);
    }

    // Tính tổng số dòng code thêm trên toàn bộ repository
    let totalLinesAdded = 0;
    for (const stat of parsedStats.values()) {
      totalLinesAdded += stat.linesAdded;
    }
    if (totalLinesAdded === 0) totalLinesAdded = 1;

    // Bảng quy chuẩn mapping tác giả Git vào mã số sinh viên dự án
    const studentMappings: Array<{
      pattern: RegExp;
      studentId: string;
      studentName: string;
    }> = [
      { pattern: /(trung|dinhthanhtrung|trungdt|trung2708)/i, studentId: 'SE170000', studentName: 'Đinh Thành Trung' },
      { pattern: /(nguyen|ngiein|tranthanhnguyen)/i, studentId: 'SE170123', studentName: 'Trần Thanh Nguyên' },
      { pattern: /(vinh|shirotran|tiến)/i, studentId: 'SE170456', studentName: 'Nguyễn Hoàng Vinh' },
      { pattern: /(thắng|thang|viktor|wilson)/i, studentId: 'SE170789', studentName: 'Bùi Nguyễn Quốc Thắng' },
      { pattern: /(kiên|kien)/i, studentId: 'SE170246', studentName: 'Bùi Trung Kiên' },
    ];

    const studentAggregates = new Map<
      string,
      { studentId: string; studentName: string; commitCount: number; linesAdded: number; linesDeleted: number }
    >();

    // Khởi tạo các sinh viên chuẩn
    for (const m of studentMappings) {
      studentAggregates.set(m.studentId, {
        studentId: m.studentId,
        studentName: m.studentName,
        commitCount: 0,
        linesAdded: 0,
        linesDeleted: 0,
      });
    }

    // Nhóm số liệu Git vào từng sinh viên tương ứng
    for (const stat of parsedStats.values()) {
      const authorText = `${stat.author} ${stat.email}`;
      let matched = false;

      for (const m of studentMappings) {
        if (m.pattern.test(authorText)) {
          const entry = studentAggregates.get(m.studentId)!;
          entry.commitCount += stat.commitCount;
          entry.linesAdded += stat.linesAdded;
          entry.linesDeleted += stat.linesDeleted;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Tác giả bên ngoài hoặc commit ẩn danh
        const anonId = `SE-${Math.abs(authorText.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)) % 10000}`;
        if (!studentAggregates.has(anonId)) {
          studentAggregates.set(anonId, {
            studentId: anonId,
            studentName: stat.author,
            commitCount: stat.commitCount,
            linesAdded: stat.linesAdded,
            linesDeleted: stat.linesDeleted,
          });
        } else {
          const entry = studentAggregates.get(anonId)!;
          entry.commitCount += stat.commitCount;
          entry.linesAdded += stat.linesAdded;
          entry.linesDeleted += stat.linesDeleted;
        }
      }
    }

    // Bổ sung bản ghi mẫu Free-rider để kiểm thử quy tắc BR-12
    studentAggregates.set('SE179999', {
      studentId: 'SE179999',
      studentName: 'Nguyễn Văn Ỷ Lại (Free-rider sample)',
      commitCount: 1,
      linesAdded: 15,
      linesDeleted: 2,
    });

    const updatedRecords: TeamworkMetricRecord[] = [];

    for (const item of studentAggregates.values()) {
      const contributionPct = Number(((item.linesAdded / totalLinesAdded) * 100).toFixed(1));
      const isFreeRider = contributionPct < 10.0; // Quy tắc nghiệp vụ BR-12

      const record: TeamworkMetricRecord = {
        metricId: `METRIC-GIT-${item.studentId}`,
        classId,
        studentId: item.studentId,
        studentName: item.studentName,
        commitCount: item.commitCount,
        linesAdded: item.linesAdded,
        linesDeleted: item.linesDeleted,
        contributionPct,
        isFreeRider,
        analyzedAt: new Date(),
      };

      this.records.set(record.metricId, record);
      await this.saveToPostgres(record);
      updatedRecords.push(record);
    }

    this.persist();
    this.logger.log(`✅ [TeamworkRepository:GitCLI] Đã đồng bộ phân tích Git trực tiếp cho ${updatedRecords.length} sinh viên.`);
    return updatedRecords;
  }
}
