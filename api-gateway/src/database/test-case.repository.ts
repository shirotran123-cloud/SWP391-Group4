import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TestCaseRecord } from './test-case.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TestCaseRepository implements OnModuleInit {
  private readonly logger = new Logger(TestCaseRepository.name);
  private readonly records: Map<string, TestCaseRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'test_cases_store.json');
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
    } catch (err: any) {
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
    } catch (err: any) {
      this.logger.error(`[TestCaseRepository] Failed to persist store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at 
         FROM test_cases ORDER BY created_at ASC`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.test_case_id, {
            testCaseId: r.test_case_id,
            assignmentId: r.assignment_id,
            inputData: r.input_data,
            expectedOutput: r.expected_output,
            isHidden: r.is_hidden,
            weight: parseFloat(r.weight) || 1.0,
            timeLimitMs: r.time_limit_ms || 2000,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.created_at),
          });
        }
        this.logger.log(`✅ [TestCaseRepository] Đã nạp ${rows.length} test cases từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[TestCaseRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(r: TestCaseRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      await this.postgres.safeQuery(
        `INSERT INTO test_cases (test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (test_case_id) DO UPDATE SET
           input_data = EXCLUDED.input_data,
           expected_output = EXCLUDED.expected_output,
           is_hidden = EXCLUDED.is_hidden,
           weight = EXCLUDED.weight,
           time_limit_ms = EXCLUDED.time_limit_ms`,
        [
          r.testCaseId,
          r.assignmentId,
          r.inputData,
          r.expectedOutput,
          r.isHidden,
          r.weight,
          r.timeLimitMs || 2000,
          r.createdAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[TestCaseRepository] Postgres save error for ${r.testCaseId}: ${err.message}`);
    }
  }

  public async create(record: Omit<TestCaseRecord, 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord> {
    const now = new Date();
    const newRecord: TestCaseRecord = { ...record, createdAt: now, updatedAt: now };
    this.records.set(newRecord.testCaseId, newRecord);
    this.persist();

    await this.saveToPostgres(newRecord);
    return newRecord;
  }

  public async getById(testCaseId: string): Promise<TestCaseRecord | null> {
    return this.records.get(testCaseId) || null;
  }

  public async listByAssignment(assignmentId: string): Promise<TestCaseRecord[]> {
    if (this.postgres.isAvailable()) {
      const result = await this.postgres.query(
        `SELECT test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at
         FROM test_cases
         WHERE assignment_id = $1
         ORDER BY created_at ASC, test_case_id ASC`,
        [assignmentId],
      );
      const records: TestCaseRecord[] = result.rows.map((r: any) => ({
        testCaseId: r.test_case_id,
        assignmentId: r.assignment_id,
        inputData: r.input_data,
        expectedOutput: r.expected_output,
        isHidden: r.is_hidden,
        weight: parseFloat(r.weight) || 1.0,
        timeLimitMs: r.time_limit_ms || 2000,
        createdAt: new Date(r.created_at),
        updatedAt: new Date(r.created_at),
      }));

      for (const [testCaseId, record] of this.records) {
        if (record.assignmentId === assignmentId) {
          this.records.delete(testCaseId);
        }
      }
      for (const record of records) {
        this.records.set(record.testCaseId, record);
      }
      this.persist();
      return records;
    }

    return Array.from(this.records.values())
      .filter((r) => r.assignmentId === assignmentId)
      .sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.testCaseId.localeCompare(b.testCaseId),
      );
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

    await this.saveToPostgres(updated);
    return updated;
  }

  public async delete(testCaseId: string): Promise<boolean> {
    const existed = this.records.delete(testCaseId);
    if (existed) {
      this.persist();
      if (this.postgres.isAvailable()) {
        await this.postgres.safeQuery(`DELETE FROM test_cases WHERE test_case_id = $1`, [testCaseId]);
      }
    }
    return existed;
  }
}
