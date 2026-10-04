import { Injectable, Logger } from '@nestjs/common';
import { SubmissionRecord } from './submission.entity';
import { SUBMISSION_STATUS } from '../common/constants/queue.constants';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SubmissionRepository {
  private readonly logger = new Logger(SubmissionRepository.name);
  private readonly records: Map<string, SubmissionRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'submissions_store.json');
    this.initStore();
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

    this.records.set(newRecord.submissionId, newRecord);
    this.persist();
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

  public async findAll(): Promise<SubmissionRecord[]> {
    return Array.from(this.records.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
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
    return existing;
  }

  public async updateQueueJobId(submissionId: string, jobId: string): Promise<void> {
    const existing = this.records.get(submissionId);
    if (existing) {
      existing.queueJobId = jobId;
      existing.updatedAt = new Date();
      this.persist();
    }
  }
}
