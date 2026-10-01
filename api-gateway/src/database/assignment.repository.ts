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

  // Lớp seed sẵn trong init_all_13_tables.sql, dùng làm FK fallback cho assignments.class_id.
  private static readonly SEEDED_CLASS_ID = 'CRS-SWP391';

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'assignments_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      await this.syncWithPostgres();
    }, 1000);
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
    } catch (err) {
      this.logger.warn(`[AssignmentRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialAssignments();
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
    } catch (err) {
      this.logger.error(`[AssignmentRepository] Failed to persist store: ${err.message}`);
    }
  }

  /**
   * Nạp assignments từ PostgreSQL, map course_id <-> courseId để giữ nguyên public API.
   */
  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;

    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT * FROM assignments ORDER BY created_at DESC`,
      );
      for (const r of rows) {
        this.records.set(r.assignment_id, {
          assignmentId: r.assignment_id,
          courseId: r.course_id || r.class_id,
          title: r.title,
          description: r.description || '',
          allowedLanguages: Array.isArray(r.allowed_languages)
            ? r.allowed_languages
            : typeof r.allowed_languages === 'string'
              ? JSON.parse(r.allowed_languages)
              : [],
          maxScore: Number(r.max_score || 0),
          deadline: new Date(r.due_date || r.deadline),
          timeLimitMs: r.time_limit_ms || 2000,
          memoryLimitMb: r.memory_limit_mb || 512,
          testcasesCount: r.testcases_count || 0,
          isActive: r.is_active === true,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        });
      }
      if (rows.length > 0) {
        this.logger.log(`✅ [AssignmentRepository] Đã nạp ${rows.length} bài tập từ PostgreSQL 15.`);
        this.persist();
      } else if (this.records.size > 0) {
        for (const a of this.records.values()) {
          await this.saveToPostgres(a);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Tìm class_id hợp lệ để thỏa FK assignments.class_id -> classes(class_id).
   * Ưu tiên lớp trùng courseId, sau đó fallback về lớp seed CRS-SWP391.
   */
  private async resolveClassId(courseId: string): Promise<string | null> {
    if (!this.postgres.isAvailable()) return null;
    try {
      if (courseId) {
        const byId = await this.postgres.safeQuery<any>(
          `SELECT class_id FROM classes WHERE class_id = $1 LIMIT 1`,
          [courseId],
        );
        if (byId.length > 0) return byId[0].class_id;

        const byCode = await this.postgres.safeQuery<any>(
          `SELECT class_id FROM classes WHERE class_code ILIKE $1 OR class_code ILIKE $2 LIMIT 1`,
          [`%${courseId}%`, `%${courseId.replace(/^COURSE-/, '')}%`],
        );
        if (byCode.length > 0) return byCode[0].class_id;
      }

      const seeded = await this.postgres.safeQuery<any>(
        `SELECT class_id FROM classes WHERE class_id = $1 LIMIT 1`,
        [AssignmentRepository.SEEDED_CLASS_ID],
      );
      if (seeded.length > 0) return seeded[0].class_id;
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] resolveClassId error: ${err.message}`);
    }
    return null;
  }

  /**
   * Write-through an toàn: nếu không tìm thấy classes row hợp lệ thì bỏ qua,
   * nếu insert lỗi FK thì chỉ log warning và tiếp tục (không bao giờ ném exception).
   */
  private async saveToPostgres(record: AssignmentRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const classId = await this.resolveClassId(record.courseId);
      if (!classId) {
        this.logger.warn(
          `[AssignmentRepository] Bỏ qua write-through PostgreSQL cho ${record.assignmentId}: ` +
          `không tìm thấy classes row hợp lệ cho courseId=${record.courseId}.`,
        );
        return;
      }

      const dueDate = record.deadline || new Date();
      const allowedLanguages = JSON.stringify(record.allowedLanguages || []);
      const language = (record.allowedLanguages && record.allowedLanguages[0]) || 'java';
      const timeLimitMs = record.timeLimitMs || 2000;
      const timeLimitSec = Number((timeLimitMs / 1000).toFixed(2));

      await this.postgres.query(
        `INSERT INTO assignments (
           assignment_id, class_id, course_id, title, description, language, allowed_languages,
           time_limit_sec, time_limit_ms, memory_limit_mb, due_date, deadline, max_score,
           testcases_count, is_active, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (assignment_id) DO UPDATE SET
           class_id = EXCLUDED.class_id,
           course_id = EXCLUDED.course_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           language = EXCLUDED.language,
           allowed_languages = EXCLUDED.allowed_languages,
           time_limit_sec = EXCLUDED.time_limit_sec,
           time_limit_ms = EXCLUDED.time_limit_ms,
           memory_limit_mb = EXCLUDED.memory_limit_mb,
           due_date = EXCLUDED.due_date,
           deadline = EXCLUDED.deadline,
           max_score = EXCLUDED.max_score,
           testcases_count = EXCLUDED.testcases_count,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          record.assignmentId,
          classId,
          record.courseId || classId,
          record.title,
          record.description || '',
          language,
          allowedLanguages,
          timeLimitSec,
          timeLimitMs,
          record.memoryLimitMb || 512,
          dueDate,
          dueDate,
          record.maxScore || 0,
          record.testcasesCount || 0,
          record.isActive === true,
          record.createdAt,
          record.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[AssignmentRepository] PostgreSQL write-through error: ${err.message}`);
    }
  }

  public async create(record: Omit<AssignmentRecord, 'createdAt' | 'updatedAt'>): Promise<AssignmentRecord> {
    const now = new Date();
    const newRecord: AssignmentRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.assignmentId, newRecord);
    this.persist();
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
    await this.saveToPostgres(updated);
    this.records.set(assignmentId, updated);
    this.persist();
    return updated;
  }

  public async delete(assignmentId: string): Promise<boolean> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.query(`DELETE FROM assignments WHERE assignment_id = $1`, [assignmentId]);
      } catch (err: any) {
        this.logger.warn(`[AssignmentRepository] Delete in PostgreSQL error: ${err.message}`);
      }
    }
    const existed = this.records.delete(assignmentId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
