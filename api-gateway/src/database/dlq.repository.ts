import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DeadLetterJobRecord, DLQJobStatus } from './dlq.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DLQRepository implements OnModuleInit {
  private readonly logger = new Logger(DLQRepository.name);
  private readonly records: Map<string, DeadLetterJobRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'dlq_store.json');
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
        const parsed: DeadLetterJobRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.dlqId, {
            ...record,
            failedAt: new Date(record.failedAt),
            retriedAt: record.retriedAt ? new Date(record.retriedAt) : undefined,
          });
        }
        this.logger.log(`[DLQRepository] Loaded ${this.records.size} dead-letter records.`);
      }
    } catch (err: any) {
      this.logger.warn(`[DLQRepository] Could not load DLQ store: ${err.message}. Initializing empty store.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[DLQRepository] Failed to persist DLQ store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT dlq_id, queue_name, original_job_id, submission_id, payload, failed_reason, 
                attempts_made, stacktrace, status, failed_at, retried_at 
         FROM dead_letter_jobs ORDER BY failed_at DESC`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.dlq_id, {
            dlqId: r.dlq_id,
            queueName: r.queue_name,
            originalJobId: r.original_job_id,
            submissionId: r.submission_id,
            payload: r.payload,
            failedReason: r.failed_reason,
            attemptsMade: r.attempts_made,
            stacktrace: r.stacktrace,
            status: r.status,
            failedAt: new Date(r.failed_at),
            retriedAt: r.retried_at ? new Date(r.retried_at) : undefined,
          });
        }
        this.logger.log(`✅ [DLQRepository] Đã nạp ${rows.length} DLQ jobs từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[DLQRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(r: DeadLetterJobRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      await this.postgres.safeQuery(
        `INSERT INTO dead_letter_jobs (dlq_id, queue_name, original_job_id, submission_id, payload, failed_reason, attempts_made, stacktrace, status, failed_at, retried_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (dlq_id) DO UPDATE SET
           status = EXCLUDED.status,
           retried_at = EXCLUDED.retried_at`,
        [
          r.dlqId,
          r.queueName,
          r.originalJobId,
          r.submissionId,
          JSON.stringify(r.payload || {}),
          r.failedReason,
          r.attemptsMade,
          r.stacktrace || null,
          r.status,
          r.failedAt,
          r.retriedAt || null,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[DLQRepository] Postgres save error for ${r.dlqId}: ${err.message}`);
    }
  }

  public async create(record: Omit<DeadLetterJobRecord, 'failedAt'>): Promise<DeadLetterJobRecord> {
    const newRecord: DeadLetterJobRecord = {
      ...record,
      failedAt: new Date(),
    };
    this.records.set(newRecord.dlqId, newRecord);
    this.persist();

    await this.saveToPostgres(newRecord);
    return newRecord;
  }

  public async findById(dlqId: string): Promise<DeadLetterJobRecord | null> {
    return this.records.get(dlqId) || null;
  }

  public async findBySubmissionId(submissionId: string): Promise<DeadLetterJobRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.submissionId === submissionId);
  }

  public async findAll(status?: DLQJobStatus): Promise<DeadLetterJobRecord[]> {
    const all = Array.from(this.records.values());
    if (status) {
      return all.filter((r) => r.status === status);
    }
    return all.sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());
  }

  public async markRetried(dlqId: string): Promise<DeadLetterJobRecord | null> {
    const existing = this.records.get(dlqId);
    if (!existing) return null;

    existing.status = 'RETRIED';
    existing.retriedAt = new Date();
    this.persist();

    await this.saveToPostgres(existing);
    return existing;
  }

  public async delete(dlqId: string): Promise<boolean> {
    const existed = this.records.delete(dlqId);
    if (existed) {
      this.persist();
      if (this.postgres.isAvailable()) {
        await this.postgres.safeQuery(`DELETE FROM dead_letter_jobs WHERE dlq_id = $1`, [dlqId]);
      }
    }
    return existed;
  }

  public async purgeAll(): Promise<number> {
    const count = this.records.size;
    this.records.clear();
    this.persist();
    if (this.postgres.isAvailable()) {
      await this.postgres.safeQuery(`DELETE FROM dead_letter_jobs`);
    }
    return count;
  }

  public countActive(): number {
    return Array.from(this.records.values()).filter((r) => r.status === 'FAILED').length;
  }
}
