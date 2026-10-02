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
  private hydrated = false;

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'teamwork_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      await this.hydrateFromPostgres();
    }, 1000);
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
        studentId: 'SE170001',
        studentName: 'Nguyễn Hoàng Vinh',
        commitCount: 12,
        linesAdded: 1620,
        linesDeleted: 210,
        contributionPct: 28.0,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-03',
        classId: 'CRS-SWP391',
        studentId: 'SE170003',
        studentName: 'Trần Thanh Nguyên',
        commitCount: 10,
        linesAdded: 1100,
        linesDeleted: 150,
        contributionPct: 21.0,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-04',
        classId: 'CRS-SWP391',
        studentId: 'SE170004',
        studentName: 'Văn Thái Trung',
        commitCount: 11,
        linesAdded: 950,
        linesDeleted: 120,
        contributionPct: 15.5,
        isFreeRider: false,
        analyzedAt: new Date(),
      },
      {
        metricId: 'METRIC-05',
        classId: 'CRS-SWP391',
        studentId: 'SE179999',
        studentName: 'Nguyễn Văn Ỷ Lại (Free-rider sample)',
        commitCount: 1,
        linesAdded: 35,
        linesDeleted: 5,
        contributionPct: 3.0, // < 10% -> Free rider!
        isFreeRider: true,
        analyzedAt: new Date(),
      },
    ];

    for (const m of defaultMetrics) {
      this.records.set(m.metricId, m);
    }
    this.flushToDisk();
  }

  private flushToDisk(): void {
    try {
      const array = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(array, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[TeamworkRepository] Failed to write to store: ${err.message}`);
    }
  }

  /**
   * Nạp chỉ số teamwork từ PostgreSQL. Bảng dùng UNIQUE (class_id, student_id) nên khóa merge là cặp đó.
   */
  public async hydrateFromPostgres(): Promise<void> {
    if (this.hydrated) return;
    if (!this.postgres.isAvailable()) return;

    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT * FROM teamwork_metrics ORDER BY analyzed_at DESC`,
      );
      for (const r of rows) {
        this.records.set(r.metric_id, {
          metricId: r.metric_id,
          classId: r.class_id,
          studentId: r.student_id,
          studentName: undefined,
          commitCount: r.commit_count || 0,
          linesAdded: r.lines_added || 0,
          linesDeleted: r.lines_deleted || 0,
          contributionPct: Number(r.contribution_pct || 0),
          isFreeRider: r.is_free_rider === true,
          analyzedAt: new Date(r.analyzed_at),
        });
      }
      this.hydrated = true;
      if (rows.length > 0) {
        this.logger.log(`✅ [TeamworkRepository] Đã nạp ${rows.length} chỉ số teamwork từ PostgreSQL 15.`);
        this.flushToDisk();
      }
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] Lỗi hydrate PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Upsert theo ràng buộc UNIQUE (class_id, student_id) của bảng teamwork_metrics.
   * Write-through an toàn: lỗi PostgreSQL chỉ ghi warning.
   */
  private async saveToPostgres(record: TeamworkMetricRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      await this.postgres.query(
        `INSERT INTO teamwork_metrics (
           metric_id, class_id, student_id, commit_count, lines_added, lines_deleted,
           contribution_pct, is_free_rider, analyzed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (class_id, student_id) DO UPDATE SET
           commit_count = EXCLUDED.commit_count,
           lines_added = EXCLUDED.lines_added,
           lines_deleted = EXCLUDED.lines_deleted,
           contribution_pct = EXCLUDED.contribution_pct,
           is_free_rider = EXCLUDED.is_free_rider,
           analyzed_at = EXCLUDED.analyzed_at`,
        [
          record.metricId,
          record.classId,
          record.studentId,
          record.commitCount || 0,
          record.linesAdded || 0,
          record.linesDeleted || 0,
          record.contributionPct || 0,
          record.isFreeRider === true,
          record.analyzedAt || new Date(),
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[TeamworkRepository] PostgreSQL write-through error: ${err.message}`);
    }
  }

  public async findAll(): Promise<TeamworkMetricRecord[]> {
    await this.hydrateFromPostgres();
    return Array.from(this.records.values());
  }

  public async findByClassId(classId: string): Promise<TeamworkMetricRecord[]> {
    await this.hydrateFromPostgres();
    return Array.from(this.records.values()).filter((r) => r.classId === classId);
  }

  public async findByStudentId(studentId: string): Promise<TeamworkMetricRecord[]> {
    await this.hydrateFromPostgres();
    return Array.from(this.records.values()).filter((r) => r.studentId === studentId);
  }

  public async upsert(record: TeamworkMetricRecord): Promise<TeamworkMetricRecord> {
    await this.hydrateFromPostgres();
    await this.saveToPostgres(record);
    this.records.set(record.metricId, record);
    this.flushToDisk();
    return record;
  }
}
