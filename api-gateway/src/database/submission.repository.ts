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

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'submissions_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    await this.syncWithPostgres();
    setTimeout(async () => {
      await this.syncWithPostgres();
    }, 1500);
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
        this.logger.log(`[SubmissionRepository] Loaded ${this.records.size} submissions from persistent store.`);
      }
    } catch (err: any) {
      this.logger.warn(`[SubmissionRepository] Could not load stored submissions: ${err.message}. Initializing empty store.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[SubmissionRepository] Failed to persist submissions store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT submission_id, assignment_id, student_id, file_hash, sha256_hash, file_path, 
                file_name, file_size_bytes, language, status, queue_job_id, score, final_score, details, 
                created_at, updated_at 
         FROM submissions ORDER BY created_at DESC`,
      );

      const dbIds = new Set<string>();
      if (rows && rows.length > 0) {
        for (const r of rows) {
          dbIds.add(r.submission_id);
          this.records.set(r.submission_id, {
            submissionId: r.submission_id,
            assignmentId: r.assignment_id,
            studentId: r.student_id,
            language: r.language,
            fileName: r.file_name,
            fileSizeBytes: r.file_size_bytes,
            sha256Hash: r.sha256_hash || r.file_hash,
            filePath: r.file_path,
            status: r.status,
            queueJobId: r.queue_job_id,
            score: r.final_score !== null && r.final_score !== undefined ? parseFloat(r.final_score) : (r.score !== null ? parseFloat(r.score) : undefined),
            details: r.details,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          });
        }
        this.logger.log(`✅ [SubmissionRepository] Đã nạp ${rows.length} bài nộp từ PostgreSQL 15.`);
      }

      // Đẩy các submissions trong JSON store chưa có trong DB vào PostgreSQL
      let syncedCount = 0;
      for (const sub of this.records.values()) {
        if (!dbIds.has(sub.submissionId)) {
          await this.saveToPostgres(sub);
          dbIds.add(sub.submissionId);
          syncedCount++;
        }
      }
      if (syncedCount > 0) {
        this.logger.log(`✅ [SubmissionRepository] Đã đồng bộ ngược ${syncedCount} bài nộp vào PostgreSQL 15.`);
      }

      this.persist();
    } catch (err: any) {
      this.logger.warn(`[SubmissionRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(r: SubmissionRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      await this.postgres.safeQuery(
        `INSERT INTO submissions (
           submission_id, assignment_id, student_id, file_hash, sha256_hash, 
           file_path, file_name, file_size_bytes, language, status, queue_job_id, 
           score, final_score, details, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (submission_id) DO UPDATE SET
           status = EXCLUDED.status,
           queue_job_id = EXCLUDED.queue_job_id,
           score = EXCLUDED.score,
           final_score = EXCLUDED.final_score,
           details = EXCLUDED.details,
           updated_at = NOW()`,
        [
          r.submissionId,
          r.assignmentId,
          r.studentId,
          r.sha256Hash,
          r.sha256Hash,
          r.filePath,
          r.fileName,
          r.fileSizeBytes,
          r.language,
          r.status,
          r.queueJobId || null,
          r.score !== undefined ? r.score : null,
          r.score !== undefined ? r.score : null,
          JSON.stringify(r.details || {}),
          r.createdAt,
          r.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[SubmissionRepository] Postgres save error for ${r.submissionId}: ${err.message}`);
    }
  }

  public async create(record: Omit<SubmissionRecord, 'createdAt' | 'updatedAt'>): Promise<SubmissionRecord> {
    const now = new Date();
    const newRecord: SubmissionRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(newRecord.submissionId, newRecord);
    this.persist();

    await this.saveToPostgres(newRecord);
    return newRecord;
  }

  public async findById(submissionId: string): Promise<SubmissionRecord | null> {
    return this.records.get(submissionId) || null;
  }

  public async findByHash(sha256Hash: string): Promise<SubmissionRecord | null> {
    for (const record of this.records.values()) {
      if (record.sha256Hash === sha256Hash) {
        return record;
      }
    }
    return null;
  }

  public async findAll(filter?: SubmissionQueryFilter): Promise<SubmissionRecord[]> {
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

    this.persist();
    await this.saveToPostgres(existing);
    return existing;
  }

  public async updateQueueJobId(submissionId: string, jobId: string): Promise<void> {
    const existing = this.records.get(submissionId);
    if (existing) {
      existing.queueJobId = jobId;
      existing.updatedAt = new Date();
      this.persist();
      await this.saveToPostgres(existing);
    }
  }

  public async delete(submissionId: string): Promise<boolean> {
    const deleted = this.records.delete(submissionId);
    if (deleted) {
      this.persist();
      if (this.postgres.isAvailable()) {
        await this.postgres.safeQuery(`DELETE FROM submissions WHERE submission_id = $1`, [submissionId]);
      }
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
