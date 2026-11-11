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
  private syncPromise: Promise<void> | null = null;

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

  private normalizeClassId(courseId?: string): string {
    const raw = (courseId || 'CRS-SWP391').trim();
    const normalized = raw.startsWith('CRS-') ? raw : `CRS-${raw.replace(/^COURSE-/i, '')}`;
    return normalized.slice(0, 64);
  }

  private async ensureParentClassInPostgres(classId: string): Promise<void> {
    if (!this.postgres.isAvailable()) return;

    const existingClass = await this.postgres.query(
      `SELECT class_id FROM classes WHERE class_id = $1 LIMIT 1`,
      [classId],
    );
    if (existingClass.rows.length > 0) return;

    await this.postgres.query(
      `INSERT INTO roles (role_id, role_name, description)
       VALUES ('LECTURER', 'LECTURER', 'Giảng viên')
       ON CONFLICT (role_id) DO NOTHING`,
    );

    const lecturerRes = await this.postgres.query(
      `SELECT user_id FROM users
       WHERE user_id = 'GV001' OR role_id IN ('LECTURER', 'ADMIN', 'HOD')
       ORDER BY CASE WHEN user_id = 'GV001' THEN 0 ELSE 1 END
       LIMIT 1`,
    );
    let lecturerId = lecturerRes.rows[0]?.user_id as string | undefined;
    if (!lecturerId) {
      await this.postgres.query(
        `INSERT INTO users (user_id, student_code, full_name, email, role_id, role)
         VALUES ('GV001', 'GV001', 'Giảng Viên Phụ Trách', 'gv001@fpt.edu.vn', 'LECTURER', 'INSTRUCTOR')
         ON CONFLICT DO NOTHING`,
      );
      lecturerId = 'GV001';
    }

    const baseCode = classId.replace(/^CRS-/i, '').trim() || classId;
    let classCode = baseCode.slice(0, 32);
    const codeCheck = await this.postgres.query(
      `SELECT class_id FROM classes WHERE class_code = $1 LIMIT 1`,
      [classCode],
    );
    if (codeCheck.rows.length > 0 && codeCheck.rows[0].class_id !== classId) {
      classCode = classId.slice(0, 32);
      const altCheck = await this.postgres.query(
        `SELECT class_id FROM classes WHERE class_code = $1 LIMIT 1`,
        [classCode],
      );
      if (altCheck.rows.length > 0 && altCheck.rows[0].class_id !== classId) {
        const suffix = `-${Date.now().toString(36).slice(-5)}`;
        classCode = `${baseCode.slice(0, Math.max(1, 32 - suffix.length))}${suffix}`;
      }
    }

    await this.postgres.query(
      `INSERT INTO classes (class_id, lecturer_id, class_code, class_name, semester, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (class_id) DO NOTHING`,
      [
        classId,
        lecturerId,
        classCode,
        `Lớp ${baseCode}`,
        'Fall 2026',
        'Tự động đồng bộ từ bài tập',
      ],
    );
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      try {
        const res = await this.postgres.query(
          `SELECT assignment_id, class_id, course_id, title, description, allowed_languages,
                  max_score, deadline, due_date, time_limit_ms, memory_limit_mb, testcases_count,
                  is_active, created_at, updated_at
           FROM assignments ORDER BY created_at DESC`,
        );
        const rows = res.rows || [];

        const dbIds = new Set<string>();
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
            testcasesCount: typeof r.testcases_count === 'number' ? r.testcases_count : 2,
            isActive: r.is_active,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          });
        }
        if (rows.length > 0) {
          this.logger.log(`✅ [AssignmentRepository] Đã nạp ${rows.length} bài tập từ PostgreSQL 15.`);
        }

        // Đồng bộ 2 chiều: đẩy các bài tập JSON chưa có vào PostgreSQL
        let newlySynced = 0;
        for (const a of this.records.values()) {
          if (!dbIds.has(a.assignmentId)) {
            try {
              await this.saveToPostgres(a);
              dbIds.add(a.assignmentId);
              newlySynced++;
            } catch (syncItemErr: any) {
              this.logger.warn(
                `[AssignmentRepository] Không thể đồng bộ ngược ${a.assignmentId} sang PostgreSQL: ${syncItemErr.message}`,
              );
            }
          }
        }
        if (newlySynced > 0) {
          this.logger.log(`✅ [AssignmentRepository] Đã đồng bộ ngược ${newlySynced} bài tập vào PostgreSQL 15.`);
        }

        this.persist();
      } catch (err: any) {
        this.logger.warn(`[AssignmentRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  public async ensureInPostgres(assignmentId: string): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    const existing = await this.postgres.query(
      `SELECT assignment_id FROM assignments WHERE assignment_id = $1 LIMIT 1`,
      [assignmentId],
    );
    if (existing.rows.length > 0) return;

    const record = this.records.get(assignmentId);
    if (!record) {
      throw new Error(`Không tìm thấy bài tập ${assignmentId} để đồng bộ PostgreSQL.`);
    }
    await this.saveToPostgres(record);
  }

  private async saveToPostgres(a: AssignmentRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    const classId = this.normalizeClassId(a.courseId);
    await this.ensureParentClassInPostgres(classId);

    const parsedDeadline = new Date(a.deadline);
    const validDeadline = isNaN(parsedDeadline.getTime()) ? new Date() : parsedDeadline;
    const parsedCreatedAt = new Date(a.createdAt);
    const validCreatedAt = isNaN(parsedCreatedAt.getTime()) ? new Date() : parsedCreatedAt;
    const parsedUpdatedAt = new Date(a.updatedAt);
    const validUpdatedAt = isNaN(parsedUpdatedAt.getTime()) ? new Date() : parsedUpdatedAt;

    await this.postgres.query(
      `INSERT INTO assignments (
         assignment_id, class_id, course_id, title, description, allowed_languages,
         max_score, due_date, deadline, time_limit_ms, memory_limit_mb, testcases_count,
         is_active, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (assignment_id) DO UPDATE SET
         class_id = EXCLUDED.class_id,
         course_id = EXCLUDED.course_id,
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
        validDeadline,
        validDeadline,
        a.timeLimitMs,
        a.memoryLimitMb,
        a.testcasesCount,
        a.isActive,
        validCreatedAt,
        validUpdatedAt,
      ],
    );
  }

  private seedInitialAssignments(): void {
    const defaultAssignments: AssignmentRecord[] = [
      {
        assignmentId: 'TASK-PRO192-A1',
        courseId: 'CRS-PRO192',
        title: 'Quản lý Đội xe Vận tải hướng đối tượng OOP (PRO192)',
        description: 'Áp dụng các nguyên lý lập trình hướng đối tượng (Kế thừa, Đóng gói, Đa hình, Trừu tượng) để thiết kế hệ thống quản lý phương tiện giao thông và đội xe logistics.',
        allowedLanguages: ['java'],
        maxScore: 10.0,
        deadline: new Date('2026-10-18T23:59:59.000Z'),
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 3,
        isActive: false,
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
        updatedAt: new Date('2026-10-18T23:59:59.000Z'),
      },
      {
        assignmentId: 'TASK-CSD201-A1',
        courseId: 'CRS-CSD201',
        title: 'Thuật toán Cấu trúc Dữ liệu & Đồ thị Dijkstra (CSD201)',
        description: 'Cài đặt giải thuật Dijkstra với PriorityQueue tìm đường đi ngắn nhất trên đồ thị có trọng số và phân tích độ phức tạp O(E log V).',
        allowedLanguages: ['java', 'cpp', 'python'],
        maxScore: 10.0,
        deadline: new Date('2026-10-20T23:59:59.000Z'),
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 3,
        isActive: false,
        createdAt: new Date('2026-10-12T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T23:59:59.000Z'),
      },
      {
        assignmentId: 'TASK-PRJ301-A1',
        courseId: 'CRS-PRJ301',
        title: 'Xây dựng Servlet & Filter Quản lý Sinh viên MVC (PRJ301)',
        description: 'Thiết kế và triển khai web application Java theo mô hình MVC 2, sử dụng Servlet xử lý request và Filter xác thực session người dùng.',
        allowedLanguages: ['java', 'cpp', 'python'],
        maxScore: 10.0,
        deadline: new Date('2026-11-15T23:59:59.000Z'),
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 3,
        isActive: true,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-25T03:00:00.000Z'),
      },
      {
        assignmentId: 'TASK-PRF192-A1',
        courseId: 'CRS-PRF192',
        title: 'Thuật toán Xử lý Mảng và Quản lý Con trỏ Bộ nhớ Động (PRF192)',
        description: 'Lập trình C giải quyết bài toán chuẩn hóa chuỗi ký tự, sắp xếp mảng động và sử dụng con trỏ quản lý bộ nhớ malloc/free.',
        allowedLanguages: ['cpp', 'c', 'java'],
        maxScore: 10.0,
        deadline: new Date('2026-11-20T23:59:59.000Z'),
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testcasesCount: 3,
        isActive: true,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-25T03:00:00.000Z'),
      },
    ];

    for (const a of defaultAssignments) {
      this.records.set(a.assignmentId, a);
    }
    this.persist();
    this.logger.log(`[AssignmentRepository] Seeded ${defaultAssignments.length} canonical assignments.`);
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
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.assignmentId, newRecord);
    this.persist();
    return newRecord;
  }

  public async findById(assignmentId: string): Promise<AssignmentRecord | null> {
    const inMemory = this.records.get(assignmentId);
    if (inMemory) return inMemory;
    if (this.postgres.isAvailable()) {
      const res = await this.postgres.query(
        `SELECT assignment_id, class_id, course_id, title, description, allowed_languages,
                max_score, deadline, due_date, time_limit_ms, memory_limit_mb, testcases_count,
                is_active, created_at, updated_at
         FROM assignments WHERE assignment_id = $1 LIMIT 1`,
        [assignmentId],
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        const hydrated: AssignmentRecord = {
          assignmentId: r.assignment_id,
          courseId: r.course_id || r.class_id,
          title: r.title,
          description: r.description || '',
          allowedLanguages: r.allowed_languages || ['java', 'python', 'cpp', 'dotnet'],
          maxScore: parseFloat(r.max_score) || 10.0,
          deadline: new Date(r.deadline || r.due_date),
          timeLimitMs: r.time_limit_ms || 2000,
          memoryLimitMb: r.memory_limit_mb || 512,
          testcasesCount: typeof r.testcases_count === 'number' ? r.testcases_count : 2,
          isActive: r.is_active,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
        this.records.set(hydrated.assignmentId, hydrated);
        return hydrated;
      }
    }
    return null;
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
    const existing = await this.findById(assignmentId);
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
    const existed = (await this.findById(assignmentId)) !== null;
    if (existed) {
      if (this.postgres.isAvailable()) {
        await this.postgres.query(`DELETE FROM assignments WHERE assignment_id = $1`, [assignmentId]);
      }
      this.records.delete(assignmentId);
      this.persist();
    }
    return existed;
  }
}
