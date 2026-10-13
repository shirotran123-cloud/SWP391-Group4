import { Injectable, Logger } from '@nestjs/common';
import { AppealRecord, AppealStatus } from './appeal.entity';
import * as fs from 'fs';
import * as path from 'path';

export interface AppealQueryFilter {
  studentId?: string;
  submissionId?: string;
  status?: AppealStatus;
  limit?: number;
}

@Injectable()
export class AppealRepository {
  private readonly logger = new Logger(AppealRepository.name);
  private readonly records: Map<string, AppealRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'appeals_store.json');
    this.initStore();
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: AppealRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.appealId, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
            resolvedAt: record.resolvedAt ? new Date(record.resolvedAt) : undefined,
          });
        }
        this.logger.log(`[AppealRepository] Loaded ${this.records.size} appeals from store.`);
      } else {
        this.seedInitialAppeals();
      }
    } catch (err: any) {
      this.logger.warn(`[AppealRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialAppeals();
    }
  }

  private seedInitialAppeals(): void {
    const sampleAppeal: AppealRecord = {
      appealId: 'APL-SAMPLE-001',
      submissionId: 'SUB-SAMPLE-01',
      studentId: 'SE170000',
      reason: 'Kính gửi Thầy, bài của em bị chấm trừ điểm SOLID ở hàm main() nhưng em đã tách logic sang Service riêng. Kính mong Thầy xem xét lại.',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3600 * 1000 * 4), // 4h ago
      updatedAt: new Date(Date.now() - 3600 * 1000 * 4),
    };
    this.records.set(sampleAppeal.appealId, sampleAppeal);
    this.flushToDisk();
  }

  private flushToDisk(): void {
    try {
      const array = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(array, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[AppealRepository] Failed to write to store: ${err.message}`);
    }
  }

  public async create(record: Omit<AppealRecord, 'createdAt' | 'updatedAt'>): Promise<AppealRecord> {
    const fullRecord: AppealRecord = {
      ...record,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.set(fullRecord.appealId, fullRecord);
    this.flushToDisk();
    return fullRecord;
  }

  public async findById(appealId: string): Promise<AppealRecord | null> {
    return this.records.get(appealId) || null;
  }

  public async findBySubmissionId(submissionId: string): Promise<AppealRecord[]> {
    return Array.from(this.records.values()).filter(
      (r) => r.submissionId === submissionId,
    );
  }

  public async countBySubmissionId(submissionId: string): Promise<number> {
    return (await this.findBySubmissionId(submissionId)).length;
  }

  public async findAll(filter?: AppealQueryFilter): Promise<AppealRecord[]> {
    let result = Array.from(this.records.values());

    if (filter?.studentId) {
      result = result.filter((r) => r.studentId === filter.studentId);
    }
    if (filter?.submissionId) {
      result = result.filter((r) => r.submissionId === filter.submissionId);
    }
    if (filter?.status) {
      result = result.filter((r) => r.status === filter.status);
    }

    // Sắp xếp mới nhất lên trước
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  public async updateResolution(
    appealId: string,
    status: AppealStatus,
    reviewerId: string,
    resolutionNote: string,
    adjustedScore?: number,
  ): Promise<AppealRecord | null> {
    const existing = this.records.get(appealId);
    if (!existing) return null;

    const updated: AppealRecord = {
      ...existing,
      status,
      reviewerId,
      resolutionNote,
      adjustedScore: adjustedScore !== undefined ? adjustedScore : existing.adjustedScore,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.set(appealId, updated);
    this.flushToDisk();
    return updated;
  }
}
