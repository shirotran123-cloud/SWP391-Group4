import { Injectable, Logger } from '@nestjs/common';
import { TestCaseRecord } from './test-case.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TestCaseRepository {
  private readonly logger = new Logger(TestCaseRepository.name);
  private readonly records: Map<string, TestCaseRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'test_cases_store.json');
    this.initStore();
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: TestCaseRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.testCaseId, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[TestCaseRepository] Loaded ${this.records.size} test cases from store.`);
      } else {
        this.seedEmpty();
      }
    } catch (err) {
      this.logger.warn(`[TestCaseRepository] Failed to load store: ${err.message}. Seeding empty.`);
      this.seedEmpty();
    }
  }

  private seedEmpty(): void {
    this.persist();
    this.logger.log(`[TestCaseRepository] Seeded empty test cases store.`);
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`[TestCaseRepository] Failed to persist store: ${err.message}`);
    }
  }

  public async create(record: Omit<TestCaseRecord, 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord> {
    const now = new Date();
    const newRecord: TestCaseRecord = { ...record, createdAt: now, updatedAt: now };
    this.records.set(newRecord.testCaseId, newRecord);
    this.persist();
    return newRecord;
  }

  public async getById(testCaseId: string): Promise<TestCaseRecord | null> {
    return this.records.get(testCaseId) || null;
  }

  public async listByAssignment(assignmentId: string): Promise<TestCaseRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.assignmentId === assignmentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async findDuplicate(assignmentId: string, inputData: string, expectedOutput: string, excludeId?: string): Promise<TestCaseRecord | null> {
    for (const record of this.records.values()) {
      if (excludeId && record.testCaseId === excludeId) continue;
      if (record.assignmentId === assignmentId && record.inputData === inputData && record.expectedOutput === expectedOutput) {
        return record;
      }
    }
    return null;
  }

  public async update(testCaseId: string, partial: Partial<Omit<TestCaseRecord, 'testCaseId' | 'createdAt'>>): Promise<TestCaseRecord | null> {
    const existing = this.records.get(testCaseId);
    if (!existing) return null;
    const updated: TestCaseRecord = { ...existing, ...partial, updatedAt: new Date() };
    this.records.set(testCaseId, updated);
    this.persist();
    return updated;
  }

  public async delete(testCaseId: string): Promise<boolean> {
    const existed = this.records.delete(testCaseId);
    if (existed) this.persist();
    return existed;
  }
}
