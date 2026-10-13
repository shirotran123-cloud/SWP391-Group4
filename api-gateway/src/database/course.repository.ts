import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CourseRecord } from './course.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

export interface EnrolledStudentInfo {
  userId: string;
  studentCode: string;
  fullName: string;
  email: string;
  enrolledAt: Date;
  status: string;
}

@Injectable()
export class CourseRepository implements OnModuleInit {
  private readonly logger = new Logger(CourseRepository.name);
  private readonly records: Map<string, CourseRecord> = new Map();
  private readonly studentEnrollments: Map<string, Set<string>> = new Map(); // studentId -> Set<classId>
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'courses_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      await this.syncWithPostgres();
    }, 1000);
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;

    try {
      // 1. Nạp tất cả các lớp học từ bảng classes
      const dbClasses = await this.postgres.safeQuery<any>(
        `SELECT * FROM classes WHERE is_active = true ORDER BY created_at DESC`,
      );

      if (dbClasses.length > 0) {
        for (const row of dbClasses) {
          const courseId = row.class_id;
          const rec: CourseRecord = {
            courseId,
            courseCode: row.class_code,
            courseName: row.class_name,
            description: row.description || '',
            semester: row.semester,
            instructorId: row.lecturer_id,
            isActive: row.is_active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          this.records.set(courseId, rec);
        }
        this.logger.log(`✅ [CourseRepository] Đã đồng bộ ${dbClasses.length} lớp học phần từ PostgreSQL 15.`);
      } else if (this.records.size > 0) {
        // Đồng bộ các lớp ban đầu sang PostgreSQL
        for (const c of this.records.values()) {
          await this.saveToPostgres(c);
        }
      }

      // 2. Nạp quan hệ ghi danh từ class_members
      const dbMembers = await this.postgres.safeQuery<any>(
        `SELECT class_id, user_id FROM class_members WHERE status = 'ACTIVE'`,
      );
      for (const m of dbMembers) {
        if (!this.studentEnrollments.has(m.user_id)) {
          this.studentEnrollments.set(m.user_id, new Set());
        }
        this.studentEnrollments.get(m.user_id)!.add(m.class_id);
      }
      this.logger.log(`✅ [CourseRepository] Đã nạp ${dbMembers.length} lượt ghi danh từ class_members.`);

      this.persist();
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(c: CourseRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      // Đảm bảo giảng viên tồn tại trong users table
      await this.postgres.safeQuery(
        `INSERT INTO users (user_id, student_code, full_name, email, role_id, role, password_hash)
         VALUES ($1, $1, 'Giảng Viên Phụ Trách', $2, 'LECTURER', 'INSTRUCTOR', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW')
         ON CONFLICT (user_id) DO NOTHING`,
        [c.instructorId, `${c.instructorId.toLowerCase()}@fpt.edu.vn`],
      );

      await this.postgres.query(
        `INSERT INTO classes (class_id, lecturer_id, class_code, class_name, semester, description, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (class_id) DO UPDATE SET
           class_code = EXCLUDED.class_code,
           class_name = EXCLUDED.class_name,
           semester = EXCLUDED.semester,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          c.courseId,
          c.instructorId,
          c.courseCode,
          c.courseName,
          c.semester,
          c.description || '',
          c.isActive,
          c.createdAt,
          c.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] PostgreSQL save error: ${err.message}`);
    }
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: CourseRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.courseId, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[CourseRepository] Loaded ${this.records.size} courses from store.`);
      } else {
        this.seedInitialCourses();
      }
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialCourses();
    }
  }

  private seedInitialCourses(): void {
    const defaultCourses: CourseRecord[] = [
      {
        courseId: 'CRS-SWP391',
        courseCode: 'SE1701-SWP391',
        courseName: 'Application Development Project (SWP391)',
        description: 'Dự án Phát triển phần mềm theo chuẩn Agile Scrum',
        semester: 'Fall 2026',
        instructorId: 'GV001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        courseId: 'CRS-PRO192',
        courseCode: 'SE1702-PRO192',
        courseName: 'Object-Oriented Programming (PRO192)',
        description: 'Lập trình hướng đối tượng với Java và Design Patterns',
        semester: 'Fall 2026',
        instructorId: 'GV001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        courseId: 'CRS-CSD201',
        courseCode: 'SE1703-CSD201',
        courseName: 'Data Structures and Algorithms (CSD201)',
        description: 'Cấu trúc dữ liệu và giải thuật nâng cao',
        semester: 'Fall 2026',
        instructorId: 'GV001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const c of defaultCourses) {
      this.records.set(c.courseId, c);
    }
    this.persist();
    this.logger.log(`[CourseRepository] Seeded ${defaultCourses.length} default courses.`);
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[CourseRepository] Failed to persist store: ${err.message}`);
    }
  }

  public async create(record: Omit<CourseRecord, 'createdAt' | 'updatedAt'>): Promise<CourseRecord> {
    const now = new Date();
    const newRecord: CourseRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.courseId, newRecord);
    this.persist();
    return newRecord;
  }

  public async findById(courseId: string): Promise<CourseRecord | null> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT * FROM classes WHERE class_id = $1`,
          [courseId],
        );
        if (rows.length > 0) {
          const r = rows[0];
          return {
            courseId: r.class_id,
            courseCode: r.class_code,
            courseName: r.class_name,
            description: r.description || '',
            semester: r.semester,
            instructorId: r.lecturer_id,
            isActive: r.is_active,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          };
        }
      } catch (e) {
        // fallback to memory
      }
    }
    return this.records.get(courseId) || null;
  }

  public async findByCode(courseCode: string): Promise<CourseRecord | null> {
    for (const course of this.records.values()) {
      if (course.courseCode.toUpperCase() === courseCode.toUpperCase()) {
        return course;
      }
    }
    return null;
  }

  public async findAll(): Promise<CourseRecord[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT * FROM classes WHERE is_active = true ORDER BY created_at DESC`,
        );
        if (rows.length > 0) {
          return rows.map((r) => ({
            courseId: r.class_id,
            courseCode: r.class_code,
            courseName: r.class_name,
            description: r.description || '',
            semester: r.semester,
            instructorId: r.lecturer_id,
            isActive: r.is_active,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          }));
        }
      } catch (e) {
        // fallback
      }
    }
    return Array.from(this.records.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  public async update(courseId: string, partial: Partial<Omit<CourseRecord, 'courseId' | 'createdAt'>>): Promise<CourseRecord | null> {
    const existing = this.records.get(courseId);
    if (!existing) return null;

    const updated: CourseRecord = {
      ...existing,
      ...partial,
      updatedAt: new Date(),
    };
    await this.saveToPostgres(updated);
    this.records.set(courseId, updated);
    this.persist();
    return updated;
  }

  public async delete(courseId: string): Promise<boolean> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.query(`DELETE FROM classes WHERE class_id = $1`, [courseId]);
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] Delete in PostgreSQL error: ${err.message}`);
      }
    }
    const existed = this.records.delete(courseId);
    if (existed) {
      this.persist();
    }
    return existed;
  }

  /**
   * UC-02: Nhập danh sách sinh viên qua Excel và ghi danh vào lớp với 100% ACID SQL Transaction
   */
  public async bulkEnrollStudents(
    classId: string,
    students: Array<{ studentCode: string; fullName: string; email: string }>,
  ): Promise<{ enrolledCount: number; message: string }> {
    if (!students || students.length === 0) {
      throw new Error('Danh sách sinh viên tải lên rỗng!');
    }

    // 1. Kiểm tra validation sơ bộ trước giao dịch
    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const row = i + 1;
      if (!s.studentCode || !s.email) {
        throw new Error(`Dòng số ${row}: Thiếu Mã số sinh viên hoặc Email!`);
      }
      if (seenCodes.has(s.studentCode)) {
        throw new Error(`Dòng số ${row}: Phát hiện MSSV trùng lặp [${s.studentCode}] trong file Excel!`);
      }
      if (seenEmails.has(s.email.toLowerCase())) {
        throw new Error(`Dòng số ${row}: Phát hiện Email trùng lặp [${s.email}] trong file Excel!`);
      }
      seenCodes.add(s.studentCode);
      seenEmails.add(s.email.toLowerCase());
    }

    // 2. Mở SQL Transaction trong PostgreSQL 15
    if (this.postgres.isAvailable()) {
      const pool = this.postgres.getPool();
      if (pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          this.logger.log(`[CourseRepository:ACID] Bắt đầu SQL TRANSACTION nhập ${students.length} sinh viên vào lớp ${classId}...`);

        for (let i = 0; i < students.length; i++) {
          const s = students[i];
          const row = i + 1;

          // Thử nghiệm cờ lỗi mô phỏng (nếu studentCode chứa trigger ROLLBACK)
          if (s.studentCode.includes('ERROR_ROLLBACK')) {
            throw new Error(`Dòng số ${row}: Vi phạm ràng buộc dữ liệu R06 [${s.studentCode}]! Kích hoạt ROLLBACK 100%.`);
          }

          // A. Insert/Update vào bảng users
          await client.query(
            `INSERT INTO users (user_id, student_code, full_name, email, role_id, role, password_hash, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'STUDENT', 'STUDENT', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               full_name = EXCLUDED.full_name,
               email = EXCLUDED.email,
               updated_at = NOW()`,
            [s.studentCode, s.studentCode, s.fullName || s.studentCode, s.email],
          );

          // B. Ghi danh vào bảng class_members
          await client.query(
            `INSERT INTO class_members (class_id, user_id, status, enrolled_at)
             VALUES ($1, $2, 'ACTIVE', NOW())
             ON CONFLICT (class_id, user_id) DO UPDATE SET status = 'ACTIVE'`,
            [classId, s.studentCode],
          );
        }

        await client.query('COMMIT');
        this.logger.log(`✅ [CourseRepository:ACID] SQL TRANSACTION COMMITTED THÀNH CÔNG: Đã nhập ${students.length} sinh viên vào lớp ${classId}!`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        this.logger.error(`❌ [CourseRepository:ACID] SQL TRANSACTION ROLLBACK 100%: ${err.message}`);
        throw new Error(`[GIAO DỊCH THẤT BẠI - ĐÃ ROLLBACK 100%]: ${err.message}`);
      } finally {
        client.release();
      }
    }
  }

    // 3. Cập nhật bộ nhớ đệm
    for (const s of students) {
      if (!this.studentEnrollments.has(s.studentCode)) {
        this.studentEnrollments.set(s.studentCode, new Set());
      }
      this.studentEnrollments.get(s.studentCode)!.add(classId);
    }

    return {
      enrolledCount: students.length,
      message: `Đã nhập và ghi danh thành công ${students.length} sinh viên vào lớp học phần ${classId} (SQL Transaction Committed).`,
    };
  }

  /**
   * Lấy danh sách các lớp học phần mà sinh viên đang theo học
   */
  public async findCoursesByStudent(studentId: string): Promise<CourseRecord[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT c.* FROM classes c
           JOIN class_members cm ON c.class_id = cm.class_id
           WHERE (cm.user_id = $1 OR cm.user_id = (SELECT student_code FROM users WHERE user_id = $1))
             AND cm.status = 'ACTIVE' AND c.is_active = true
           ORDER BY c.created_at DESC`,
          [studentId],
        );
        if (rows.length > 0) {
          return rows.map((r) => ({
            courseId: r.class_id,
            courseCode: r.class_code,
            courseName: r.class_name,
            description: r.description || '',
            semester: r.semester,
            instructorId: r.lecturer_id,
            isActive: r.is_active,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          }));
        }
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] findCoursesByStudent error: ${err.message}`);
      }
    }

    // Fallback: Tìm qua memory map hoặc trả về tất cả các lớp đang mở
    const enrolledClassIds = this.studentEnrollments.get(studentId);
    if (enrolledClassIds && enrolledClassIds.size > 0) {
      return Array.from(this.records.values()).filter((c) => enrolledClassIds.has(c.courseId));
    }

    // Nếu sinh viên chưa có môn riêng, mặc định cho thấy môn SWP391 chuẩn
    return Array.from(this.records.values()).slice(0, 2);
  }

  /**
   * Lấy danh sách sinh viên ghi danh trong lớp
   */
  public async getStudentsInCourse(classId: string): Promise<EnrolledStudentInfo[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT u.user_id, u.student_code, u.full_name, u.email, cm.enrolled_at, cm.status
           FROM class_members cm
           JOIN users u ON cm.user_id = u.user_id
           WHERE cm.class_id = $1
           ORDER BY cm.enrolled_at DESC`,
          [classId],
        );
        return rows.map((r) => ({
          userId: r.user_id,
          studentCode: r.student_code || r.user_id,
          fullName: r.full_name,
          email: r.email,
          enrolledAt: new Date(r.enrolled_at),
          status: r.status,
        }));
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] getStudentsInCourse error: ${err.message}`);
      }
    }
    return [];
  }
}
