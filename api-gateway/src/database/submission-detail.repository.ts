import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SubmissionDetailRecord } from './submission-detail.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SubmissionDetailRepository implements OnModuleInit {
  private readonly logger = new Logger(SubmissionDetailRepository.name);
  private readonly records: Map<string, SubmissionDetailRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'submission_details_store.json');
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
        const parsed: SubmissionDetailRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.detailId, {
            ...record,
            createdAt: new Date(record.createdAt),
          });
        }
        this.logger.log(`[SubmissionDetailRepository] Đã tải ${this.records.size} log testcase chi tiết từ persistent store.`);
      }
    } catch (err: any) {
      this.logger.warn(`[SubmissionDetailRepository] Lỗi tải store: ${err.message}. Khởi tạo rỗng.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[SubmissionDetailRepository] Lỗi lưu trữ store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT detail_id, submission_id, test_case_id, status, actual_output, time_ms, memory_kb, error_log, created_at 
         FROM submission_details ORDER BY created_at ASC`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.detail_id, {
            detailId: r.detail_id,
            submissionId: r.submission_id,
            testCaseId: r.test_case_id,
            status: r.status,
            actualOutput: r.actual_output,
            timeMs: r.time_ms,
            memoryKb: r.memory_kb,
            errorLog: r.error_log,
            createdAt: new Date(r.created_at),
          });
        }
        this.logger.log(`✅ [SubmissionDetailRepository] Đã đồng bộ ${rows.length} testcase run logs từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[SubmissionDetailRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  public async create(record: Omit<SubmissionDetailRecord, 'createdAt'>): Promise<SubmissionDetailRecord> {
    const now = new Date();
    const newRecord: SubmissionDetailRecord = {
      ...record,
      createdAt: now,
    };

    this.records.set(newRecord.detailId, newRecord);
    this.persist();

    if (this.postgres.isAvailable()) {
      await this.postgres.safeQuery(
        `INSERT INTO submission_details (detail_id, submission_id, test_case_id, status, actual_output, time_ms, memory_kb, error_log, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (detail_id) DO NOTHING`,
        [
          newRecord.detailId,
          newRecord.submissionId,
          newRecord.testCaseId || null,
          newRecord.status,
          newRecord.actualOutput || '',
          newRecord.timeMs,
          newRecord.memoryKb,
          newRecord.errorLog || null,
          newRecord.createdAt,
        ],
      );
    }

    return newRecord;
  }

  public async createBatch(records: Omit<SubmissionDetailRecord, 'createdAt'>[]): Promise<SubmissionDetailRecord[]> {
    const results: SubmissionDetailRecord[] = [];
    for (const r of records) {
      results.push(await this.create(r));
    }
    return results;
  }

  public async findBySubmissionId(submissionId: string): Promise<SubmissionDetailRecord[]> {
    if (this.postgres.isAvailable()) {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT detail_id, submission_id, test_case_id, status, actual_output, time_ms, memory_kb, error_log, created_at 
         FROM submission_details WHERE submission_id = $1 ORDER BY created_at ASC`,
        [submissionId],
      );
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          detailId: r.detail_id,
          submissionId: r.submission_id,
          testCaseId: r.test_case_id,
          status: r.status,
          actualOutput: r.actual_output,
          timeMs: r.time_ms,
          memoryKb: r.memory_kb,
          errorLog: r.error_log,
          createdAt: new Date(r.created_at),
        }));
      }
    }

    return Array.from(this.records.values())
      .filter((r) => r.submissionId === submissionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
