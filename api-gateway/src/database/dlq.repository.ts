import { Injectable, Logger } from '@nestjs/common';
import { DeadLetterJobRecord, DLQJobStatus } from './dlq.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DLQRepository {
  private readonly logger = new Logger(DLQRepository.name);
  private readonly records: Map<string, DeadLetterJobRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'dlq_store.json');
    this.initStore();
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
    } catch (err) {
      this.logger.warn(`[DLQRepository] Could not load DLQ store: ${err.message}. Initializing empty store.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`[DLQRepository] Failed to persist DLQ store: ${err.message}`);
    }
  }

  public async create(record: Omit<DeadLetterJobRecord, 'failedAt'>): Promise<DeadLetterJobRecord> {
    const newRecord: DeadLetterJobRecord = {
      ...record,
      failedAt: new Date(),
    };
    this.records.set(newRecord.dlqId, newRecord);
    this.persist();
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
    return existing;
  }

  public async delete(dlqId: string): Promise<boolean> {
    const existed = this.records.delete(dlqId);
    if (existed) {
      this.persist();
    }
    return existed;
  }

  public async purgeAll(): Promise<number> {
    const count = this.records.size;
    this.records.clear();
    this.persist();
    return count;
  }

  public countActive(): number {
    return Array.from(this.records.values()).filter((r) => r.status === 'FAILED').length;
  }
}
