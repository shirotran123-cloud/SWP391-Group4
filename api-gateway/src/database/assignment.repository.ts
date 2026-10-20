import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AssignmentRecord } from './assignment.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AssignmentRepository implements OnModuleInit {
  private readonly logger = new Logger(AssignmentRepository.name);
  private readonly records: Map<string, AssignmentRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'assignments_store.json');
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
        const parsed: AssignmentRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.assignmentId, {
            ...record,
            deadline: new Date(record.deadline),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[AssignmentRepository] Loaded ${this.records.size} assignments from store.`);
      } else {
        this.seedInitialAssignments();
      }
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialAssignments();
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT assignment_id, class_id, course_id, title, description, allowed_languages, 
                max_score, deadline, due_date, time_limit_ms, memory_limit_mb, testcases_count, 
                is_active, created_at, updated_at 
         FROM assignments ORDER BY created_at DESC`,
      );

      const dbIds = new Set<string>();
      if (rows && rows.length > 0) {
        for (const r of rows) {
          dbIds.add(r.assignment_id);
          this.records.set(r.assignment_id, {
            assignmentId: r.assignment_id,
            courseId: r.course_id || r.class_id,
            title: r.title,
            description: r.description || '',
            allowedLanguages: r.allowed_languages || ['java', 'python', 'cpp', 'dotnet'],
            maxScore: parseFloat(r.max_score) || 10.0,
            deadline: new Date(r.deadline || r.due_date),
            timeLimitMs: r.time_limit_ms || 2000,
            memoryLimitMb: r.memory_limit_mb || 512,
            testcasesCount: r.testcases_count || 2,
            isActive: r.is_active,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          });
        }
        this.logger.log(`✅ [AssignmentRepository] Đã nạp ${rows.length} bài tập từ PostgreSQL 15.`);
      }

      // Đồng bộ 2 chiều
      let newlySynced = 0;
      for (const a of this.records.values()) {
        if (!dbIds.has(a.assignmentId)) {
          await this.saveToPostgres(a);
          dbIds.add(a.assignmentId);
          newlySynced++;
        }
      }
      if (newlySynced > 0) {
        this.logger.log(`✅ [AssignmentRepository] Đã đồng bộ ngược ${newlySynced} bài tập vào PostgreSQL 15.`);
      }

      this.persist();
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(a: AssignmentRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const classId = a.courseId.startsWith('CRS-') ? a.courseId : `CRS-${a.courseId.replace('COURSE-', '')}`;

      await this.postgres.safeQuery(
        `INSERT INTO assignments (
           assignment_id, class_id, course_id, title, description, allowed_languages, 
           max_score, due_date, deadline, time_limit_ms, memory_limit_mb, testcases_count, 
           is_active, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (assignment_id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           allowed_languages = EXCLUDED.allowed_languages,
           max_score = EXCLUDED.max_score,
           due_date = EXCLUDED.due_date,
           deadline = EXCLUDED.deadline,
           time_limit_ms = EXCLUDED.time_limit_ms,
           memory_limit_mb = EXCLUDED.memory_limit_mb,
           testcases_count = EXCLUDED.testcases_count,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          a.assignmentId,
          classId,
          a.courseId,
          a.title,
          a.description || '',
          JSON.stringify(a.allowedLanguages || ['java']),
          a.maxScore,
          a.deadline,
          a.deadline,
          a.timeLimitMs,
          a.memoryLimitMb,
          a.testcasesCount,
          a.isActive,
          a.createdAt,
          a.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] Postgres save error for ${a.assignmentId}: ${err.message}`);
    }
  }

  private seedInitialAssignments(): void {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const defaultAssignments: AssignmentRecord[] = [
      {
        assignmentId: 'TASK-SWP391-SPRINT2',
        courseId: 'COURSE-SWP391',
        title: 'Thuật toán Sắp xếp & Tối ưu hóa Bộ nhớ (Milestone 2)',
        description: 'Xây dựng thuật toán sắp xếp mảng 100,000 phần tử, tối ưu O(N log N) và tuân thủ các nguyên lý SOLID.',
        allowedLanguages: ['java', 'python', 'cpp', 'dotnet'],
        maxScore: 10.0,
        deadline: futureDate,
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        assignmentId: 'TASK-PRN211-M1',
        courseId: 'COURSE-PRN211',
        title: 'Lập trình Cấu trúc dữ liệu & Thuật toán C# .NET',
        description: 'Cài đặt Generic Binary Search Tree và xử lý ngoại lệ trong .NET 8.',
        allowedLanguages: ['dotnet', 'java'],
        maxScore: 10.0,
        deadline: futureDate,
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const a of defaultAssignments) {
      this.records.set(a.assignmentId, a);
    }
    this.persist();
    this.logger.log(`[AssignmentRepository] Seeded ${defaultAssignments.length} default assignments.`);
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[AssignmentRepository] Failed to persist store: ${err.message}`);
    }
  }

  public async create(record: Omit<AssignmentRecord, 'createdAt' | 'updatedAt'>): Promise<AssignmentRecord> {
    const now = new Date();
    const newRecord: AssignmentRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(newRecord.assignmentId, newRecord);
    this.persist();

    await this.saveToPostgres(newRecord);
    return newRecord;
  }

  public async findById(assignmentId: string): Promise<AssignmentRecord | null> {
    return this.records.get(assignmentId) || null;
  }

  public async findByCourseId(courseId: string): Promise<AssignmentRecord[]> {
    return Array.from(this.records.values()).filter((a) => a.courseId === courseId);
  }

  public async findAll(): Promise<AssignmentRecord[]> {
    return Array.from(this.records.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  public async update(assignmentId: string, partial: Partial<Omit<AssignmentRecord, 'assignmentId' | 'createdAt'>>): Promise<AssignmentRecord | null> {
    const existing = this.records.get(assignmentId);
    if (!existing) return null;

    const updated: AssignmentRecord = {
      ...existing,
      ...partial,
      updatedAt: new Date(),
    };
    this.records.set(assignmentId, updated);
    this.persist();

    await this.saveToPostgres(updated);
    return updated;
  }

  public async delete(assignmentId: string): Promise<boolean> {
    const existed = this.records.delete(assignmentId);
    if (existed) {
      this.persist();
      if (this.postgres.isAvailable()) {
        await this.postgres.safeQuery(`DELETE FROM assignments WHERE assignment_id = $1`, [assignmentId]);
      }
    }
    return existed;
  }
}
