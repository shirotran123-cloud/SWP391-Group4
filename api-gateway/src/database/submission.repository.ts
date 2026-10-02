import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SubmissionRecord } from './submission.entity';
import { SUBMISSION_STATUS } from '../common/constants/queue.constants';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

export interface SubmissionQueryFilter {
  studentId?: string;
  assignmentId?: string;
  status?: SubmissionRecord['status'];
  limit?: number;
}

@Injectable()
export class SubmissionRepository implements OnModuleInit {
  private readonly logger = new Logger(SubmissionRepository.name);
  private readonly records: Map<string, SubmissionRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;
  private hydrated = false;

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'submissions_store.json');
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
        const parsed: SubmissionRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.submissionId, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[Database] Loaded ${this.records.size} submissions from persistent store.`);
      }
    } catch (err) {
      this.logger.warn(`[Database] Could not load stored submissions: ${err.message}. Initializing empty store.`);
    }
  }

  /**
   * Nạp bản ghi từ PostgreSQL vào bộ nhớ (merge, KHÔNG xóa bản ghi chỉ có trong JSON).
   * Khi trùng khóa, dữ liệu PostgreSQL thắng (durable store).
   */
  public async hydrateFromPostgres(): Promise<void> {
    if (this.hydrated) return;
    if (!this.postgres.isAvailable()) return;

    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT * FROM submissions ORDER BY created_at DESC`,
      );
      for (const r of rows) {
        this.records.set(r.submission_id, this.mapRow(r));
      }
      this.hydrated = true;
      if (rows.length > 0) {
        this.logger.log(`✅ [SubmissionRepository] Đã nạp ${rows.length} bài nộp từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[SubmissionRepository] Lỗi hydrate PostgreSQL: ${err.message}`);
    }
  }

  private mapRow(r: any): SubmissionRecord {
    return {
      submissionId: r.submission_id,
      studentId: r.student_id,
      assignmentId: r.assignment_id,
      language: r.language,
      fileName: r.file_name || 'submission.zip',
      fileSizeBytes: r.file_size_bytes || 0,
      sha256Hash: r.file_hash || r.sha256_hash || '',
      filePath: r.file_path || '',
      status: r.status,
      queueJobId: r.queue_job_id || undefined,
      score: r.score !== null && r.score !== undefined ? Number(r.score) : undefined,
      details: r.details || undefined,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  /**
   * Write-through: JSON store là source of truth cho demo, PostgreSQL là durable store.
   * Mọi lỗi PostgreSQL chỉ ghi warning, KHÔNG bao giờ làm hỏng request.
   */
  private async saveToPostgres(record: SubmissionRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const details =
        record.details === undefined || record.details === null
          ? '{}'
          : JSON.stringify(record.details);

      await this.postgres.query(
        `INSERT INTO submissions (
           submission_id, assignment_id, student_id, file_hash, sha256_hash, file_path, file_name,
           file_size_bytes, language, status, queue_job_id, testcase_score, final_score, score,
           details, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (submission_id) DO UPDATE SET
           status = EXCLUDED.status,
           queue_job_id = EXCLUDED.queue_job_id,
           final_score = EXCLUDED.final_score,
           score = EXCLUDED.score,
           details = EXCLUDED.details,
           updated_at = NOW()`,
        [
          record.submissionId,
          record.assignmentId,
          record.studentId,
          record.sha256Hash || '',
          record.sha256Hash || null,
          record.filePath || '',
          record.fileName || 'submission.zip',
          record.fileSizeBytes || 0,
          record.language || 'java',
          record.status,
          record.queueJobId || null,
          record.score !== undefined ? record.score : null,
          record.score !== undefined ? record.score : null,
          record.score !== undefined ? record.score : null,
          details,
          record.createdAt,
          record.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[SubmissionRepository] PostgreSQL write-through error: ${err.message}`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`[Database] Failed to persist submissions store: ${err.message}`);
    }
  }

  public async create(record: Omit<SubmissionRecord, 'createdAt' | 'updatedAt'>): Promise<SubmissionRecord> {
    const now = new Date();
    const newRecord: SubmissionRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };

    await this.hydrateFromPostgres();
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.submissionId, newRecord);
    this.persist();
    return newRecord;
  }

  public async findById(submissionId: string): Promise<SubmissionRecord | null> {
    await this.hydrateFromPostgres();
    return this.records.get(submissionId) || null;
  }

  public async findByHash(sha256Hash: string): Promise<SubmissionRecord | null> {
    await this.hydrateFromPostgres();
    for (const record of this.records.values()) {
      if (record.sha256Hash === sha256Hash) {
        return record;
      }
    }
    return null;
  }

  public async findAll(filter?: SubmissionQueryFilter): Promise<SubmissionRecord[]> {
    await this.hydrateFromPostgres();
    let list = Array.from(this.records.values());

    if (filter?.studentId) {
      list = list.filter((r) => r.studentId === filter.studentId);
    }
    if (filter?.assignmentId) {
      list = list.filter((r) => r.assignmentId === filter.assignmentId);
    }
    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filter?.limit && filter.limit > 0) {
      return list.slice(0, filter.limit);
    }

    return list;
  }

  public async updateStatus(
    submissionId: string,
    status: SubmissionRecord['status'],
    details?: Record<string, any>,
    score?: number,
  ): Promise<SubmissionRecord | null> {
    await this.hydrateFromPostgres();
    const existing = this.records.get(submissionId);
    if (!existing) return null;

    existing.status = status;
    existing.updatedAt = new Date();
    if (details) {
      existing.details = { ...(existing.details || {}), ...details };
    }
    if (score !== undefined) {
      existing.score = score;
    }

    await this.saveToPostgres(existing);
    this.persist();
    return existing;
  }

  public async updateQueueJobId(submissionId: string, jobId: string): Promise<void> {
    await this.hydrateFromPostgres();
    const existing = this.records.get(submissionId);
    if (existing) {
      existing.queueJobId = jobId;
      existing.updatedAt = new Date();
      await this.saveToPostgres(existing);
      this.persist();
    }
  }

  public async delete(submissionId: string): Promise<boolean> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.query(`DELETE FROM submissions WHERE submission_id = $1`, [submissionId]);
      } catch (err: any) {
        this.logger.warn(`[SubmissionRepository] Delete in PostgreSQL error: ${err.message}`);
      }
    }
    const deleted = this.records.delete(submissionId);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  public getStats(): { total: number; queued: number; inProgress: number; completed: number; failed: number } {
    let queued = 0;
    let inProgress = 0;
    let completed = 0;
    let failed = 0;

    for (const r of this.records.values()) {
      if (r.status === SUBMISSION_STATUS.QUEUED) queued++;
      else if (r.status === SUBMISSION_STATUS.IN_PROGRESS) inProgress++;
      else if (r.status === SUBMISSION_STATUS.COMPLETED) completed++;
      else if (r.status === SUBMISSION_STATUS.FAILED) failed++;
    }

    return {
      total: this.records.size,
      queued,
      inProgress,
      completed,
      failed,
    };
  }
}
