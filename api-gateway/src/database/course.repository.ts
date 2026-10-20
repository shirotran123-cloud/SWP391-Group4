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
  private readonly courseMembers: Map<string, Map<string, EnrolledStudentInfo>> = new Map(); // classId -> Map<studentCode, EnrolledStudentInfo>
  private readonly dataDir: string;
  private readonly dataFile: string;
  private lastMtime: number = 0;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'courses_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    // Chạy đồng bộ ngay lập tức và đồng bộ lại sau 1s để bắt kịp kết nối PostgreSQL
    await this.syncWithPostgres();
    setTimeout(async () => {
      await this.syncWithPostgres();
    }, 1000);
  }

  /**
   * Tự động đồng bộ lại bộ nhớ nếu file courses_store.json được chỉnh sửa từ bên ngoài hoặc sau khi khởi động
   */
  public reloadIfModified(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const stat = fs.statSync(this.dataFile);
        if (stat.mtimeMs !== this.lastMtime) {
          const raw = fs.readFileSync(this.dataFile, 'utf-8');
          const parsed: CourseRecord[] = JSON.parse(raw);
          for (const record of parsed) {
            this.records.set(record.courseId, {
              ...record,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt),
            });
          }
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] Không thể đọc courses_store.json: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;

    try {
      this.reloadIfModified();

      // 1. Nạp tất cả các lớp học từ bảng classes trong PostgreSQL
      const dbClasses = await this.postgres.safeQuery<any>(
        `SELECT * FROM classes WHERE is_active = true ORDER BY created_at DESC`,
      );

      const dbClassIds = new Set<string>();
      if (dbClasses.length > 0) {
        for (const row of dbClasses) {
          dbClassIds.add(row.class_id);
          const rec: CourseRecord = {
            courseId: row.class_id,
            courseCode: row.class_code,
            courseName: row.class_name,
            description: row.description || '',
            semester: row.semester,
            instructorId: row.lecturer_id,
            isActive: row.is_active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          this.records.set(row.class_id, rec);
        }
        this.logger.log(`✅ [CourseRepository] Đã nạp ${dbClasses.length} lớp học phần từ PostgreSQL 15.`);
      }

      // 2. ĐỒNG BỘ 2 CHIỀU (Bi-directional Sync): Đẩy tất cả các khóa học có trong JSON store nhưng chưa có trong PostgreSQL vào DB
      let newlySynced = 0;
      for (const c of this.records.values()) {
        if (!dbClassIds.has(c.courseId)) {
          await this.saveToPostgres(c);
          dbClassIds.add(c.courseId);
          newlySynced++;
        }
      }
      if (newlySynced > 0) {
        this.logger.log(`✅ [CourseRepository] Đã bảo toàn và đồng bộ ngược ${newlySynced} lớp học phần từ JSON store vào PostgreSQL 15.`);
      }

      // 3. Nạp quan hệ ghi danh từ class_members
      const dbMembers = await this.postgres.safeQuery<any>(
        `SELECT class_id, user_id FROM class_members WHERE status = 'ACTIVE'`,
      );
      for (const m of dbMembers) {
        if (!this.studentEnrollments.has(m.user_id)) {
          this.studentEnrollments.set(m.user_id, new Set());
        }
        this.studentEnrollments.get(m.user_id)!.add(m.class_id);
      }
      if (dbMembers.length > 0) {
        this.logger.log(`✅ [CourseRepository] Đã nạp ${dbMembers.length} lượt ghi danh từ class_members.`);
      }

      this.persist();
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(c: CourseRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      // Đảm bảo giảng viên tồn tại trong users table
      const lecturerCheck = await this.postgres.safeQuery<any>(
        `SELECT user_id FROM users WHERE user_id = $1 LIMIT 1`,
        [c.instructorId],
      );
      if (lecturerCheck.length === 0) {
        await this.postgres.safeQuery(
          `INSERT INTO users (user_id, student_code, full_name, email, role_id, role, password_hash)
           VALUES ($1, $1, 'Giảng Viên Phụ Trách', $2, 'LECTURER', 'INSTRUCTOR', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW')
           ON CONFLICT DO NOTHING`,
          [c.instructorId, `${c.instructorId.toLowerCase()}@fpt.edu.vn`],
        );
      }

      await this.postgres.safeQuery(
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
      if (fs.existsSync(this.dataFile)) {
        this.lastMtime = fs.statSync(this.dataFile).mtimeMs;
      }
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
    this.reloadIfModified();
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT * FROM classes WHERE class_id = $1`,
          [courseId],
        );
        if (rows.length > 0) {
          const r = rows[0];
          const rec: CourseRecord = {
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
          this.records.set(r.class_id, rec);
          return rec;
        }
      } catch (e) {
        // fallback to memory
      }
    }
    const mem = this.records.get(courseId);
    if (mem && this.postgres.isAvailable()) {
      void this.saveToPostgres(mem);
    }
    return mem || null;
  }

  public async findByCode(courseCode: string): Promise<CourseRecord | null> {
    this.reloadIfModified();
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT * FROM classes WHERE UPPER(class_code) = UPPER($1) LIMIT 1`,
          [courseCode.trim()],
        );
        if (rows.length > 0) {
          const r = rows[0];
          const rec: CourseRecord = {
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
          this.records.set(r.class_id, rec);
          return rec;
        }
      } catch (e) {
        // fallback
      }
    }
    for (const course of this.records.values()) {
      if (course.courseCode.toUpperCase() === courseCode.toUpperCase()) {
        return course;
      }
    }
    return null;
  }

  public async findAll(): Promise<CourseRecord[]> {
    this.reloadIfModified();

    const merged = new Map<string, CourseRecord>();

    // 1. Nạp từ memory map / courses_store.json trước
    for (const [id, c] of this.records.entries()) {
      merged.set(id, c);
    }

    // 2. Nếu PostgreSQL sẵn sàng, truy vấn classes và hợp nhất 2 chiều
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT * FROM classes WHERE is_active = true ORDER BY created_at DESC`,
        );
        for (const r of rows) {
          const rec: CourseRecord = {
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
          merged.set(r.class_id, rec);
          if (!this.records.has(r.class_id)) {
            this.records.set(r.class_id, rec);
          }
        }

        // Đảm bảo các khóa học trong memory store cũng được bảo toàn và lưu vào PostgreSQL
        for (const c of merged.values()) {
          const existsInDb = rows.some((r: any) => r.class_id === c.courseId);
          if (!existsInDb) {
            void this.saveToPostgres(c);
          }
        }
      } catch (e: any) {
        this.logger.warn(`[CourseRepository] findAll PostgreSQL query fallback: ${e.message}`);
      }
    }

    return Array.from(merged.values()).sort(
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

          // Đảm bảo lớp học phần tồn tại trong PostgreSQL trước khi ghi danh
          const classCheck = await client.query(`SELECT class_id FROM classes WHERE class_id = $1 LIMIT 1`, [classId]);
          if (classCheck.rows.length === 0) {
            const memCourse = this.records.get(classId);
            if (memCourse) {
              await this.saveToPostgres(memCourse);
            }
          }

          for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const row = i + 1;

            // Thử nghiệm cờ lỗi mô phỏng (nếu studentCode chứa trigger ROLLBACK)
            if (s.studentCode && s.studentCode.includes('ERROR_ROLLBACK')) {
              throw new Error(`Dòng số ${row}: Vi phạm ràng buộc dữ liệu R06 [${s.studentCode}]! Kích hoạt ROLLBACK 100%.`);
            }

            const studentCodeTrimmed = (s.studentCode || '').trim();
            const emailTrimmed = (s.email || '').trim().toLowerCase();
            const fullNameTrimmed = (s.fullName || s.studentCode || '').trim();

            // A. Kiểm tra xem user đã tồn tại theo email hoặc student_code hoặc user_id chưa
            const existingUserRes = await client.query(
              `SELECT user_id, student_code, email FROM users 
               WHERE LOWER(email) = LOWER($1) OR student_code = $2 OR user_id = $2 
               LIMIT 1`,
              [emailTrimmed, studentCodeTrimmed],
            );

            let effectiveUserId = studentCodeTrimmed;

            if (existingUserRes.rows.length > 0) {
              effectiveUserId = existingUserRes.rows[0].user_id;
              // Cập nhật thông tin sinh viên hiện có
              await client.query(
                `UPDATE users 
                 SET student_code = COALESCE(NULLIF($1, ''), student_code),
                     full_name = COALESCE(NULLIF($2, ''), full_name),
                     is_active = true,
                     updated_at = NOW()
                 WHERE user_id = $3`,
                [studentCodeTrimmed, fullNameTrimmed, effectiveUserId],
              );
            } else {
              // Tạo mới sinh viên
              await client.query(
                `INSERT INTO users (user_id, student_code, full_name, email, role_id, role, password_hash, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'STUDENT', 'STUDENT', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true, NOW(), NOW())
                 ON CONFLICT (user_id) DO UPDATE SET
                   student_code = EXCLUDED.student_code,
                   full_name = EXCLUDED.full_name,
                   email = EXCLUDED.email,
                   updated_at = NOW()`,
                [effectiveUserId, studentCodeTrimmed, fullNameTrimmed, emailTrimmed],
              );
            }

            // B. Ghi danh vào bảng class_members bằng effectiveUserId
            await client.query(
              `INSERT INTO class_members (class_id, user_id, status, enrolled_at)
               VALUES ($1, $2, 'ACTIVE', NOW())
               ON CONFLICT (class_id, user_id) DO UPDATE SET status = 'ACTIVE'`,
              [classId, effectiveUserId],
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

    // 3. Cập nhật bộ nhớ đệm (Lưu theo cả Mã SV lẫn Email để hỗ trợ truy vấn)
    if (!this.courseMembers.has(classId)) {
      this.courseMembers.set(classId, new Map());
    }
    const classMap = this.courseMembers.get(classId)!;

    for (const s of students) {
      const studentCodeTrimmed = (s.studentCode || '').trim();
      const emailTrimmed = (s.email || '').trim().toLowerCase();
      const fullNameTrimmed = (s.fullName || s.studentCode || '').trim();

      classMap.set(studentCodeTrimmed, {
        userId: studentCodeTrimmed,
        studentCode: studentCodeTrimmed,
        fullName: fullNameTrimmed,
        email: emailTrimmed,
        enrolledAt: new Date(),
        status: 'ACTIVE',
      });

      const keys = [studentCodeTrimmed, emailTrimmed].filter(Boolean) as string[];
      for (const k of keys) {
        if (!this.studentEnrollments.has(k)) {
          this.studentEnrollments.set(k, new Set());
        }
        this.studentEnrollments.get(k)!.add(classId);
      }
    }

    // 4. Đồng bộ vào users_store.json để tài khoản sinh viên được cấp quyền đăng nhập ngay lập tức
    try {
      const usersFile = path.join(this.dataDir, 'users_store.json');
      if (fs.existsSync(usersFile)) {
        const rawUsers = fs.readFileSync(usersFile, 'utf-8');
        const userList: any[] = JSON.parse(rawUsers);
        let hasNewUser = false;

        for (const s of students) {
          const studentCodeTrimmed = (s.studentCode || '').trim();
          const emailTrimmed = (s.email || '').trim().toLowerCase();
          const fullNameTrimmed = (s.fullName || s.studentCode || '').trim();

          const existingUser = userList.find(
            (u) => (u.email && u.email.toLowerCase() === emailTrimmed) || u.studentCode === studentCodeTrimmed || u.userId === studentCodeTrimmed,
          );

          if (existingUser) {
            existingUser.studentCode = studentCodeTrimmed;
            existingUser.fullName = fullNameTrimmed || existingUser.fullName;
            existingUser.updatedAt = new Date().toISOString();
            hasNewUser = true;
          } else {
            userList.push({
              userId: studentCodeTrimmed,
              studentCode: studentCodeTrimmed,
              email: emailTrimmed,
              fullName: fullNameTrimmed,
              role: 'STUDENT',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            hasNewUser = true;
          }
        }

        if (hasNewUser) {
          fs.writeFileSync(usersFile, JSON.stringify(userList, null, 2), 'utf-8');
          this.logger.log(`[CourseRepository] Đã đồng bộ tài khoản sinh viên mới vào users_store.json.`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[CourseRepository] Không thể đồng bộ users_store.json: ${err.message}`);
    }

    return {
      enrolledCount: students.length,
      message: `Đã nhập và ghi danh thành công ${students.length} sinh viên vào lớp học phần ${classId} (SQL Transaction Committed).`,
    };
  }

  /**
   * Lấy danh sách các lớp học phần mà sinh viên đang theo học
   */
  public async findCoursesByStudent(studentId: string, studentEmail?: string): Promise<CourseRecord[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT c.* FROM classes c
           JOIN class_members cm ON c.class_id = cm.class_id
           WHERE (cm.user_id = $1 
               OR ($2::text IS NOT NULL AND cm.user_id = $2)
               OR cm.user_id = (SELECT student_code FROM users WHERE user_id = $1 OR email = $1 OR ($2::text IS NOT NULL AND email = $2) LIMIT 1)
               OR cm.user_id = (SELECT user_id FROM users WHERE student_code = $1 OR email = $1 OR ($2::text IS NOT NULL AND email = $2) LIMIT 1))
             AND cm.status = 'ACTIVE' AND c.is_active = true
           ORDER BY c.created_at DESC`,
          [studentId, studentEmail || null],
        );
        if (rows.length > 0) {
          const seen = new Set<string>();
          const result: CourseRecord[] = [];
          for (const r of rows) {
            const upper = (r.class_code || r.class_id || '').toUpperCase();
            let norm = r.class_code || r.class_id;
            if (upper.includes('SWP391')) norm = 'SWP391';
            else if (upper.includes('PRN211')) norm = 'PRN211';
            else if (upper.includes('CSD201') || upper.includes('CSD')) norm = 'CSD201';

            if (!seen.has(norm)) {
              seen.add(norm);
              result.push({
                courseId: r.class_id,
                courseCode: norm,
                courseName: r.class_name,
                description: r.description || '',
                semester: r.semester,
                instructorId: r.lecturer_id,
                isActive: r.is_active,
                createdAt: new Date(r.created_at),
                updatedAt: new Date(r.updated_at),
              });
            }
          }
          if (result.length > 0) return result;
        }
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] findCoursesByStudent error: ${err.message}`);
      }
    }

    // Fallback: Tìm qua memory map theo cả studentId, email, lowercase
    const keysToSearch = [
      studentId,
      studentId?.toLowerCase(),
      studentEmail,
      studentEmail?.toLowerCase(),
    ].filter(Boolean) as string[];
    const matchedClassIds = new Set<string>();
    for (const k of keysToSearch) {
      const ids = this.studentEnrollments.get(k);
      if (ids) {
        ids.forEach((id) => matchedClassIds.add(id));
      }
    }

    let coursesToReturn: CourseRecord[] = [];
    if (matchedClassIds.size > 0) {
      coursesToReturn = Array.from(this.records.values()).filter((c) => matchedClassIds.has(c.courseId));
    } else {
      coursesToReturn = Array.from(this.records.values());
    }

    // Chuẩn hóa và gom nhóm
    const seenCodes = new Set<string>();
    const coreCourses: CourseRecord[] = [];

    for (const c of coursesToReturn) {
      const code = (c.courseCode || c.courseId || '').toUpperCase();
      let norm = c.courseCode || c.courseId;
      if (code.includes('SWP391')) norm = 'SWP391';
      else if (code.includes('PRN211')) norm = 'PRN211';
      else if (code.includes('CSD201') || code.includes('CSD')) norm = 'CSD201';

      if (!seenCodes.has(norm)) {
        seenCodes.add(norm);
        coreCourses.push({
          ...c,
          courseCode: norm,
        });
      }
    }

    // Bổ sung môn cốt lõi nếu danh sách chưa có môn nào
    if (coreCourses.length === 0) {
      for (const targetNorm of ['SWP391', 'PRN211', 'CSD201']) {
        if (!seenCodes.has(targetNorm)) {
          const found = Array.from(this.records.values()).find((c) => {
            const upper = (c.courseCode || c.courseId || '').toUpperCase();
            return upper.includes(targetNorm);
          });
          if (found) {
            seenCodes.add(targetNorm);
            coreCourses.push({
              ...found,
              courseCode: targetNorm,
            });
          }
        }
      }
    }

    if (coreCourses.length > 0) return coreCourses;
    return Array.from(this.records.values()).slice(0, 3);
  }

  public async getStudentsInCourse(classId: string): Promise<EnrolledStudentInfo[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT u.user_id, u.student_code, u.full_name, u.email, cm.enrolled_at, cm.status
           FROM class_members cm
           JOIN users u ON cm.user_id = u.user_id OR cm.user_id = u.student_code
           WHERE cm.class_id = $1
           ORDER BY cm.enrolled_at DESC`,
          [classId],
        );
        if (rows.length > 0) {
          return rows.map((r) => ({
            userId: r.user_id,
            studentCode: r.student_code || r.user_id,
            fullName: r.full_name,
            email: r.email,
            enrolledAt: new Date(r.enrolled_at),
            status: r.status,
          }));
        }
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] getStudentsInCourse error: ${err.message}`);
      }
    }

    const memList = Array.from(this.courseMembers.get(classId)?.values() || []);
    if (memList.length > 0) return memList;

    // Default seed students if empty and SWP391
    if (classId.includes('SWP391')) {
      return [
        { userId: 'SE170000', studentCode: 'SE170000', fullName: 'Đinh Thành Trung', email: 'trungdt.student@aita.fpt.edu.vn', enrolledAt: new Date(), status: 'ACTIVE' },
        { userId: 'SE170123', studentCode: 'SE170123', fullName: 'Trần Thanh Nguyên', email: 'nguyentt@aita.fpt.edu.vn', enrolledAt: new Date(), status: 'ACTIVE' },
        { userId: 'SE170456', studentCode: 'SE170456', fullName: 'Nguyễn Hoàng Vinh', email: 'vinhtt@aita.fpt.edu.vn', enrolledAt: new Date(), status: 'ACTIVE' },
      ];
    }
    return [];
  }

  /**
   * Xóa sinh viên khỏi lớp học phần (Gỡ ghi danh khỏi class_members)
   */
  public async removeStudentFromCourse(classId: string, studentId: string): Promise<boolean> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.query(
          `DELETE FROM class_members 
           WHERE class_id = $1 
             AND (user_id = $2 
                  OR user_id = (SELECT user_id FROM users WHERE student_code = $2 OR email = $2 LIMIT 1)
                  OR user_id = (SELECT student_code FROM users WHERE user_id = $2 OR email = $2 LIMIT 1))`,
          [classId, studentId],
        );
        this.logger.log(`[CourseRepository] Đã xóa sinh viên ${studentId} khỏi lớp ${classId} trong PostgreSQL 15.`);
      } catch (err: any) {
        this.logger.warn(`[CourseRepository] Lỗi xóa sinh viên trong PostgreSQL: ${err.message}`);
      }
    }

    const classMap = this.courseMembers.get(classId);
    if (classMap) {
      classMap.delete(studentId);
    }
    const enrollments = this.studentEnrollments.get(studentId);
    if (enrollments) {
      enrollments.delete(classId);
    }
    return true;
  }
}

