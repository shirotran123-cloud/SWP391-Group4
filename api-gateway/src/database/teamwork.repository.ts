import { Injectable, Logger } from '@nestjs/common';
import { TeamworkMetricRecord } from './teamwork.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TeamworkRepository {
  private readonly logger = new Logger(TeamworkRepository.name);
  private readonly records: Map<string, TeamworkMetricRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'teamwork_store.json');
    this.initStore();
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

  public async findAll(): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values());
  }

  public async findByClassId(classId: string): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.classId === classId);
  }

  public async findByStudentId(studentId: string): Promise<TeamworkMetricRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.studentId === studentId);
  }

  public async upsert(record: TeamworkMetricRecord): Promise<TeamworkMetricRecord> {
    this.records.set(record.metricId, record);
    this.flushToDisk();
    return record;
  }
}
