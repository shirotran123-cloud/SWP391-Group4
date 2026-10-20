import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TeamworkMetricRecord } from './teamwork.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

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
}
