import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserRecord, UserRole } from './user.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UserRepository implements OnModuleInit {
  private readonly logger = new Logger(UserRepository.name);
  private readonly records: Map<string, UserRecord> = new Map();
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
    this.dataFile = path.join(this.dataDir, 'users_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    await this.syncWithPostgres();
    setTimeout(async () => {
      await this.syncWithPostgres();
    }, 1200);
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        this.reloadIfModified();
        this.logger.log(`[UserRepository] Đã tải ${this.records.size} người dùng từ persistent store.`);
      } else {
        this.seedInitialUsers();
      }
    } catch (err: any) {
      this.logger.warn(`[UserRepository] Lỗi tải store: ${err.message}. Khởi tạo mặc định.`);
      this.seedInitialUsers();
    }
  }

  public reloadIfModified(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const stat = fs.statSync(this.dataFile);
        if (stat.mtimeMs !== this.lastMtime) {
          const raw = fs.readFileSync(this.dataFile, 'utf-8');
          const parsed: UserRecord[] = JSON.parse(raw);
          this.records.clear();
          for (const record of parsed) {
            this.records.set(record.userId, {
              ...record,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt),
            });
          }
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch (err: any) {
      this.logger.warn(`[UserRepository] Không thể đọc users_store.json: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      // 1. Tải danh sách người dùng từ PostgreSQL 15
      const dbUsers = await this.postgres.safeQuery<any>(
        `SELECT user_id, role_id, email, full_name, student_code, role, password_hash, avatar_url, is_active, created_at, updated_at
         FROM users`,
      );

      const dbUserIds = new Set<string>();
      if (dbUsers.length > 0) {
        for (const row of dbUsers) {
          dbUserIds.add(row.user_id);
          let resolvedRole: UserRole = (row.role || row.role_id || 'STUDENT') as UserRole;
          if ((resolvedRole as string) === 'LECTURER' || (resolvedRole as string) === 'HOD') {
            resolvedRole = 'INSTRUCTOR';
          }

          this.records.set(row.user_id, {
            userId: row.user_id,
            studentCode: row.student_code || undefined,
            email: row.email,
            fullName: row.full_name,
            role: resolvedRole,
            passwordHash: row.password_hash,
            avatarUrl: row.avatar_url || undefined,
            isActive: row.is_active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          });

        }
        this.logger.log(`✅ [UserRepository] Đã nạp ${dbUsers.length} tài khoản từ PostgreSQL 15.`);
      }

      // 2. Đồng bộ 2 chiều (Bi-directional Sync): Đẩy các user có trong JSON store mà chưa có trong DB vào PostgreSQL
      let newlySynced = 0;
      for (const u of this.records.values()) {
        if (!dbUserIds.has(u.userId)) {
          await this.saveToPostgres(u);
          dbUserIds.add(u.userId);
          newlySynced++;
        }
      }
      if (newlySynced > 0) {
        this.logger.log(`✅ [UserRepository] Đã bảo toàn và đồng bộ ngược ${newlySynced} tài khoản từ JSON store vào PostgreSQL 15.`);
      }

      this.persist();
    } catch (err: any) {
      this.logger.warn(`[UserRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  private async saveToPostgres(u: UserRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const roleId = u.role === 'INSTRUCTOR' ? 'LECTURER' : (u.role || 'STUDENT');
      const hash = u.passwordHash || '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7';

      await this.postgres.safeQuery(
        `INSERT INTO users (user_id, role_id, email, full_name, student_code, role, password_hash, avatar_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           student_code = EXCLUDED.student_code,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          u.userId,
          roleId,
          u.email,
          u.fullName,
          u.studentCode || (u.role === 'STUDENT' ? u.userId : null),
          u.role,
          hash,
          u.avatarUrl || null,
          u.isActive,
          u.createdAt,
          u.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[UserRepository] PostgreSQL save error for ${u.userId}: ${err.message}`);
    }
  }

  private seedInitialUsers(): void {
    const defaultUsers: UserRecord[] = [
      {
        userId: 'ADMIN001',
        email: 'admin@aita.fpt.edu.vn',
        fullName: 'Hệ Thống Quản Trị AITA',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'ADMIN002',
        email: 'admin.aita@gmail.com',
        fullName: 'Quản Trị Viên AITA (Gmail)',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'GV001',
        email: 'giangvien.edu@gmail.com',
        fullName: 'ThS. Giảng Viên AITA (Demo)',
        role: 'INSTRUCTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'GV002',
        email: 'trungdt@fe.edu.vn',
        fullName: 'ThS. Đinh Thành Trung',
        role: 'INSTRUCTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'GV003',
        email: 'namlh@fe.edu.vn',
        fullName: 'TS. Lê Hoàng Nam (Giảng viên)',
        role: 'INSTRUCTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170000',
        studentCode: 'SE170000',
        email: 'trungdt.student@aita.fpt.edu.vn',
        fullName: 'Đinh Thành Trung (Sinh viên)',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170001',
        studentCode: 'SE170001',
        email: 'phaithayj@gmail.com',
        fullName: 'Nguyễn Hoàng Vinh',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170002',
        studentCode: 'SE170002',
        email: 'linhcampochia@gmail.com',
        fullName: 'Linh Campochia',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170003',
        studentCode: 'SE170003',
        email: 'mochibunnyyy123@gmail.com',
        fullName: 'Viktor Wilson',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170123',
        studentCode: 'SE170123',
        email: 'nguyentt@aita.fpt.edu.vn',
        fullName: 'Trần Thanh Nguyên',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170456',
        studentCode: 'SE170456',
        email: 'vinhtt@aita.fpt.edu.vn',
        fullName: 'Nguyễn Hoàng Vinh (FPT)',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const u of defaultUsers) {
      this.records.set(u.userId, u);
      void this.saveToPostgres(u);
    }
    this.persist();
    this.logger.log(`[UserRepository] Khởi tạo ${defaultUsers.length} người dùng mặc định.`);
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
      if (fs.existsSync(this.dataFile)) {
        this.lastMtime = fs.statSync(this.dataFile).mtimeMs;
      }
    } catch (err: any) {
      this.logger.error(`[UserRepository] Lỗi lưu trữ store: ${err.message}`);
    }
  }

  public async create(record: Omit<UserRecord, 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const now = new Date();
    const newRecord: UserRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(newRecord.userId, newRecord);
    this.persist();

    await this.saveToPostgres(newRecord);
    return newRecord;
  }

  public async createBatchTransactional(newUsers: Omit<UserRecord, 'createdAt' | 'updatedAt'>[]): Promise<UserRecord[]> {
    this.reloadIfModified();
    const existingIds = new Set(this.records.keys());
    const existingEmails = new Set(Array.from(this.records.values()).map((u) => u.email.toLowerCase()));

    const batchIds = new Set<string>();
    const batchEmails = new Set<string>();

    for (let i = 0; i < newUsers.length; i++) {
      const u = newUsers[i];
      const rowNum = i + 1;

      if (!u.userId || !u.email) {
        throw new Error(`Dòng ${rowNum}: Thiếu mã sinh viên hoặc email!`);
      }

      if (batchIds.has(u.userId) || existingIds.has(u.userId)) {
        throw new Error(`Dòng ${rowNum}: Trùng lặp mã sinh viên '${u.userId}'!`);
      }

      const lowerEmail = u.email.toLowerCase();
      if (batchEmails.has(lowerEmail) || existingEmails.has(lowerEmail)) {
        throw new Error(`Dòng ${rowNum}: Trùng lặp địa chỉ email '${u.email}'!`);
      }

      batchIds.add(u.userId);
      batchEmails.add(lowerEmail);
    }

    const now = new Date();
    const createdRecords: UserRecord[] = [];
    for (const u of newUsers) {
      const record: UserRecord = {
        ...u,
        createdAt: now,
        updatedAt: now,
      };
      this.records.set(record.userId, record);
      createdRecords.push(record);
      await this.saveToPostgres(record);
    }

    this.persist();
    this.logger.log(`[UserRepository] Transaction COMMITTED: Đã import ${createdRecords.length} users thành công.`);
    return createdRecords;
  }

  public async findById(userId: string): Promise<UserRecord | null> {
    this.reloadIfModified();
    return this.records.get(userId) || null;
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    this.reloadIfModified();
    for (const user of this.records.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  public async findAll(role?: UserRole): Promise<UserRecord[]> {
    this.reloadIfModified();
    const all = Array.from(this.records.values());
    if (role) {
      return all.filter((u) => u.role === role);
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async update(userId: string, partial: Partial<Omit<UserRecord, 'userId' | 'createdAt'>>): Promise<UserRecord | null> {
    this.reloadIfModified();
    const existing = this.records.get(userId);
    if (!existing) return null;

    const updated: UserRecord = {
      ...existing,
      ...partial,
      updatedAt: new Date(),
    };
    this.records.set(userId, updated);
    this.persist();

    await this.saveToPostgres(updated);
    return updated;
  }

  public async delete(userId: string): Promise<boolean> {
    this.reloadIfModified();
    const existed = this.records.delete(userId);
    if (existed) {
      this.persist();
      if (this.postgres.isAvailable()) {
        await this.postgres.safeQuery(`DELETE FROM users WHERE user_id = $1`, [userId]);
      }
    }
    return existed;
  }
}
