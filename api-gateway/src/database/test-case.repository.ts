import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TestCaseRecord } from './test-case.entity';
import { PostgresService } from './postgres.service';
import { AssignmentRepository } from './assignment.repository';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TestCaseRepository implements OnModuleInit {
  private readonly logger = new Logger(TestCaseRepository.name);
  private readonly records: Map<string, TestCaseRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;
  private syncPromise: Promise<void> | null = null;

  constructor(
    private readonly postgres: PostgresService,
    private readonly assignmentRepo: AssignmentRepository,
  ) {
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
    await this.postgres.ensureInitialized?.();
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

  private mapDbRow(r: any): TestCaseRecord {
    return {
      testCaseId: r.test_case_id,
      assignmentId: r.assignment_id,
      inputData: r.input_data,
      expectedOutput: r.expected_output,
      isHidden: Boolean(r.is_hidden),
      weight: parseFloat(r.weight) || 1.0,
      timeLimitMs: r.time_limit_ms || 2000,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.created_at),
    };
  }

  private pairKey(assignmentId: string, inputData: string, expectedOutput: string): string {
    return `${assignmentId}\u0000${inputData}\u0000${expectedOutput}`;
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      try {
        const res = await this.postgres.query(
          `SELECT test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at
           FROM test_cases ORDER BY created_at ASC, test_case_id ASC`,
        );
        const rows = res.rows || [];
        const dbIds = new Set<string>();
        const dbPairs = new Set<string>();

        for (const r of rows) {
          dbIds.add(r.test_case_id);
          dbPairs.add(this.pairKey(r.assignment_id, r.input_data, r.expected_output));
          this.records.set(r.test_case_id, this.mapDbRow(r));
        }
        if (rows.length > 0) {
          this.logger.log(`✅ [TestCaseRepository] Đã nạp ${rows.length} test cases từ PostgreSQL 15.`);
        }

        // Đồng bộ 2 chiều: đẩy các testcase JSON hợp lệ chưa có trong PostgreSQL lên DB,
        // đồng thời loại bỏ bản sao trùng cặp (assignmentId, inputData, expectedOutput) dưới UUID khác.
        let pushedCount = 0;
        let dedupedCount = 0;
        for (const tc of Array.from(this.records.values())) {
          if (dbIds.has(tc.testCaseId)) {
            continue;
          }
          const key = this.pairKey(tc.assignmentId, tc.inputData, tc.expectedOutput);
          if (dbPairs.has(key)) {
            this.records.delete(tc.testCaseId);
            dedupedCount++;
            continue;
          }
          const parentAssignment = await this.assignmentRepo.findById(tc.assignmentId);
          if (!parentAssignment) {
            continue;
          }
          try {
            await this.saveToPostgres(tc);
            dbIds.add(tc.testCaseId);
            dbPairs.add(key);
            pushedCount++;
          } catch (pushErr: any) {
            this.logger.warn(
              `[TestCaseRepository] Không thể đồng bộ ngược ${tc.testCaseId} (${tc.assignmentId}): ${pushErr.message}`,
            );
          }
        }

        if (pushedCount > 0) {
          this.logger.log(`✅ [TestCaseRepository] Đã đồng bộ ngược ${pushedCount} test cases vào PostgreSQL 15.`);
        }
        if (dedupedCount > 0) {
          this.logger.log(`🧹 [TestCaseRepository] Đã dọn ${dedupedCount} bản sao test case trùng lặp trong JSON store.`);
        }

        this.persist();
      } catch (err: any) {
        this.logger.warn(`[TestCaseRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private async saveToPostgres(r: TestCaseRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    await this.assignmentRepo.ensureInPostgres(r.assignmentId);

    await this.postgres.query(
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
  }

  public async create(record: Omit<TestCaseRecord, 'createdAt' | 'updatedAt'>): Promise<TestCaseRecord> {
    const now = new Date();
    const newRecord: TestCaseRecord = { ...record, createdAt: now, updatedAt: now };
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.testCaseId, newRecord);
    this.persist();
    return newRecord;
  }

  public async getById(testCaseId: string): Promise<TestCaseRecord | null> {
    const inMemory = this.records.get(testCaseId);
    if (inMemory) return inMemory;
    if (this.postgres.isAvailable()) {
      const res = await this.postgres.query(
        `SELECT test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at
         FROM test_cases WHERE test_case_id = $1 LIMIT 1`,
        [testCaseId],
      );
      if (res.rows.length > 0) {
        const mapped = this.mapDbRow(res.rows[0]);
        this.records.set(mapped.testCaseId, mapped);
        return mapped;
      }
    }
    return null;
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

      const merged = new Map<string, TestCaseRecord>();
      const mergedPairs = new Set<string>();
      let changedMemory = false;

      for (const row of result.rows || []) {
        const mapped = this.mapDbRow(row);
        merged.set(mapped.testCaseId, mapped);
        mergedPairs.add(this.pairKey(mapped.assignmentId, mapped.inputData, mapped.expectedOutput));
        const prev = this.records.get(mapped.testCaseId);
        if (
          !prev ||
          prev.inputData !== mapped.inputData ||
          prev.expectedOutput !== mapped.expectedOutput ||
          prev.isHidden !== mapped.isHidden ||
          prev.weight !== mapped.weight ||
          prev.timeLimitMs !== mapped.timeLimitMs
        ) {
          this.records.set(mapped.testCaseId, mapped);
          changedMemory = true;
        }
      }

      // Tuyệt đối không xóa dữ liệu JSON local nếu DB chưa đồng bộ; đẩy bổ sung lên DB nếu hợp lệ,
      // nhưng loại bỏ bản sao trùng cặp (inputData, expectedOutput) dưới UUID khác để không nhân đôi row.
      for (const localRec of Array.from(this.records.values())) {
        if (localRec.assignmentId === assignmentId && !merged.has(localRec.testCaseId)) {
          const key = this.pairKey(localRec.assignmentId, localRec.inputData, localRec.expectedOutput);
          if (mergedPairs.has(key)) {
            this.records.delete(localRec.testCaseId);
            changedMemory = true;
            continue;
          }
          const parentAssignment = await this.assignmentRepo.findById(assignmentId);
          if (parentAssignment) {
            try {
              await this.saveToPostgres(localRec);
            } catch (err: any) {
              this.logger.warn(
                `[TestCaseRepository] Không thể đồng bộ testcase ${localRec.testCaseId} cho ${assignmentId}: ${err.message}`,
              );
            }
          }
          merged.set(localRec.testCaseId, localRec);
          mergedPairs.add(key);
        }
      }

      if (changedMemory) {
        this.persist();
      }

      return Array.from(merged.values()).sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.testCaseId.localeCompare(b.testCaseId),
      );
    }

    return Array.from(this.records.values())
      .filter((r) => r.assignmentId === assignmentId)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.testCaseId.localeCompare(b.testCaseId),
      );
  }

  public async findDuplicate(
    assignmentId: string,
    inputData: string,
    expectedOutput: string,
    excludeId?: string,
  ): Promise<TestCaseRecord | null> {
    for (const record of this.records.values()) {
      if (excludeId && record.testCaseId === excludeId) continue;
      if (record.assignmentId === assignmentId && record.inputData === inputData && record.expectedOutput === expectedOutput) {
        return record;
      }
    }

    if (this.postgres.isAvailable()) {
      const params: any[] = [assignmentId, inputData, expectedOutput];
      const excludeClause = excludeId ? ' AND test_case_id <> $4' : '';
      if (excludeId) params.push(excludeId);
      const res = await this.postgres.query(
        `SELECT test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at
         FROM test_cases
         WHERE assignment_id = $1 AND input_data = $2 AND expected_output = $3${excludeClause}
         LIMIT 1`,
        params,
      );
      if (res.rows.length > 0) {
        const mapped = this.mapDbRow(res.rows[0]);
        this.records.set(mapped.testCaseId, mapped);
        return mapped;
      }
    }

    return null;
  }

  public async update(
    testCaseId: string,
    partial: Partial<Omit<TestCaseRecord, 'testCaseId' | 'createdAt'>>,
  ): Promise<TestCaseRecord | null> {
    const existing = await this.getById(testCaseId);
    if (!existing) return null;
    const updated: TestCaseRecord = { ...existing, ...partial, updatedAt: new Date() };
    await this.saveToPostgres(updated);
    this.records.set(testCaseId, updated);
    this.persist();
    return updated;
  }

  public async replaceForAssignment(
    assignmentId: string,
    items: Array<{
      testCaseId: string;
      inputData: string;
      expectedOutput: string;
      isHidden: boolean;
      weight: number;
      timeLimitMs: number;
    }>,
  ): Promise<TestCaseRecord[]> {
    const baseMs = Date.now();
    const nextRecords: TestCaseRecord[] = items.map((item, idx) => {
      const ts = new Date(baseMs + idx);
      return {
        testCaseId: item.testCaseId,
        assignmentId,
        inputData: item.inputData,
        expectedOutput: item.expectedOutput,
        isHidden: item.isHidden,
        weight: item.weight,
        timeLimitMs: item.timeLimitMs,
        createdAt: ts,
        updatedAt: ts,
      };
    });

    if (this.postgres.isAvailable()) {
      await this.assignmentRepo.ensureInPostgres(assignmentId);
      const pool = this.postgres.getPool();
      if (!pool) {
        throw new Error('PostgreSQL connection pool không khả dụng.');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM test_cases WHERE assignment_id = $1`, [assignmentId]);
        for (const rec of nextRecords) {
          await client.query(
            `INSERT INTO test_cases (test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              rec.testCaseId,
              rec.assignmentId,
              rec.inputData,
              rec.expectedOutput,
              rec.isHidden,
              rec.weight,
              rec.timeLimitMs,
              rec.createdAt,
            ],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    for (const [id, rec] of this.records) {
      if (rec.assignmentId === assignmentId) {
        this.records.delete(id);
      }
    }
    for (const rec of nextRecords) {
      this.records.set(rec.testCaseId, rec);
    }
    this.persist();

    return nextRecords;
  }

  public async delete(testCaseId: string): Promise<boolean> {
    const existing = await this.getById(testCaseId);
    if (!existing) return false;
    if (this.postgres.isAvailable()) {
      await this.postgres.query(`DELETE FROM test_cases WHERE test_case_id = $1`, [testCaseId]);
    }
    this.records.delete(testCaseId);
    this.persist();
    return true;
  }

  public async deleteByAssignmentLocal(assignmentId: string): Promise<void> {
    let removed = false;
    for (const [id, rec] of this.records) {
      if (rec.assignmentId === assignmentId) {
        this.records.delete(id);
        removed = true;
      }
    }
    if (removed) {
      this.persist();
    }
  }
}
