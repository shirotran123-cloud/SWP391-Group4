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
  private hydrated = false;

  // Placeholder BCrypt hash trùng với seed trong database/init_all_13_tables.sql.
  // TODO: password_hash là NOT NULL trong schema nhưng người dùng Google SSO không có mật khẩu cục bộ,
  // nên chỉ ghi placeholder này cho tới khi có luồng đặt mật khẩu nội bộ.
  private static readonly PLACEHOLDER_PASSWORD_HASH =
    '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7';

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'users_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    setTimeout(async () => {
      await this.hydrateFromPostgres();
    }, 1000);
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

  /**
   * Tự động đồng bộ lại bộ nhớ nếu file users_store.json được chỉnh sửa từ bên ngoài
   */
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
        email: 'trungdt@fe.edu.vn',
        fullName: 'ThS. Đinh Thành Trung',
        role: 'INSTRUCTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170000',
        email: 'trungse170000@fpt.edu.vn',
        fullName: 'Đinh Thành Trung (Sinh viên)',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const u of defaultUsers) {
      this.records.set(u.userId, u);
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

  /**
   * Map vai trò của ứng dụng sang role_id hợp lệ trong bảng roles (RBAC).
   * INSTRUCTOR -> LECTURER; vai trò không xác định -> STUDENT.
   */
  private mapRoleId(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'ADMIN':
        return 'ADMIN';
      case 'HOD':
        return 'HOD';
      case 'LECTURER':
      case 'INSTRUCTOR':
        return 'LECTURER';
      case 'STUDENT':
        return 'STUDENT';
      default:
        return 'STUDENT';
    }
  }

  /**
   * student_code là UNIQUE và nullable; chỉ gán cho tài khoản sinh viên.
   */
  private mapStudentCode(record: UserRecord): string | null {
    return this.mapRoleId(record.role) === 'STUDENT' ? record.userId : null;
  }

  /**
   * Nạp người dùng từ PostgreSQL (merge; PostgreSQL thắng khi trùng khóa).
   */
  public async hydrateFromPostgres(): Promise<void> {
    if (this.hydrated) return;
    if (!this.postgres.isAvailable()) return;

    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT * FROM users ORDER BY created_at DESC`,
      );
      for (const r of rows) {
        const rawRole: string = r.role || this.mapRoleId(r.role_id);
        this.records.set(r.user_id, {
          userId: r.user_id,
          email: r.email,
          fullName: r.full_name,
          role: (rawRole === 'LECTURER' ? 'INSTRUCTOR' : rawRole) as UserRole,
          passwordHash: r.password_hash || undefined,
          avatarUrl: r.avatar_url || undefined,
          isActive: r.is_active === true,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        });
      }
      this.hydrated = true;
      if (rows.length > 0) {
        this.logger.log(`✅ [UserRepository] Đã nạp ${rows.length} người dùng từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[UserRepository] Lỗi hydrate PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Đảm bảo role_id tham chiếu tồn tại trong bảng roles trước khi ghi users (FK an toàn).
   */
  private async ensureRole(client: any, roleId: string): Promise<void> {
    await client.query(
      `INSERT INTO roles (role_id, role_name) VALUES ($1, $1) ON CONFLICT (role_id) DO NOTHING`,
      [roleId],
    );
  }

  /**
   * Write-through an toàn cho một người dùng. Mọi lỗi chỉ log warning.
   */
  private async saveToPostgres(record: UserRecord): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    const pool = this.postgres.getPool();
    if (!pool) return;

    const roleId = this.mapRoleId(record.role);
    let client: any = null;
    try {
      client = await pool.connect();
      await this.ensureRole(client, roleId);
      await client.query(
        `INSERT INTO users (user_id, role_id, email, full_name, student_code, role, password_hash, avatar_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           role_id = EXCLUDED.role_id,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          record.userId,
          roleId,
          record.email,
          record.fullName,
          this.mapStudentCode(record),
          roleId,
          record.passwordHash || UserRepository.PLACEHOLDER_PASSWORD_HASH,
          record.avatarUrl || null,
          record.isActive === true,
          record.createdAt,
          record.updatedAt,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`[UserRepository] PostgreSQL write-through error: ${err.message}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  public async create(record: Omit<UserRecord, 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const now = new Date();
    const newRecord: UserRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    await this.hydrateFromPostgres();
    await this.saveToPostgres(newRecord);
    this.records.set(newRecord.userId, newRecord);
    this.persist();
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
      createdRecords.push(record);
    }

    // Ghi toàn bộ batch trong MỘT transaction PostgreSQL; lỗi bất kỳ -> ROLLBACK 100%.
    if (this.postgres.isAvailable()) {
      const pool = this.postgres.getPool();
      if (pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          this.logger.log(`[UserRepository:ACID] Bắt đầu SQL TRANSACTION nhập ${createdRecords.length} người dùng...`);

          for (let i = 0; i < createdRecords.length; i++) {
            const record = createdRecords[i];
            const roleId = this.mapRoleId(record.role);

            await this.ensureRole(client, roleId);

            await client.query(
              `INSERT INTO users (user_id, role_id, email, full_name, student_code, role, password_hash, avatar_url, is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
              [
                record.userId,
                roleId,
                record.email,
                record.fullName,
                this.mapStudentCode(record),
                roleId,
                record.passwordHash || UserRepository.PLACEHOLDER_PASSWORD_HASH,
                record.avatarUrl || null,
                record.isActive === true,
              ],
            );
          }

          await client.query('COMMIT');
          this.logger.log(`✅ [UserRepository:ACID] SQL TRANSACTION COMMITTED: đã nhập ${createdRecords.length} người dùng.`);
        } catch (err: any) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr: any) {
            this.logger.error(`❌ [UserRepository:ACID] ROLLBACK thất bại: ${rollbackErr.message}`);
          }
          this.logger.error(`❌ [UserRepository:ACID] SQL TRANSACTION ROLLBACK 100%: ${err.message}`);
          throw new Error(`[GIAO DỊCH THẤT BẠI - ĐÃ ROLLBACK 100%]: ${err.message}`);
        } finally {
          client.release();
        }
      }
    }

    for (const record of createdRecords) {
      this.records.set(record.userId, record);
    }

    this.persist();
    this.logger.log(`[UserRepository] Transaction COMMITTED: Đã import ${createdRecords.length} users thành công.`);
    await this.hydrateFromPostgres();
    return createdRecords;
  }

  public async findById(userId: string): Promise<UserRecord | null> {
    await this.hydrateFromPostgres();
    this.reloadIfModified();
    return this.records.get(userId) || null;
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    await this.hydrateFromPostgres();
    this.reloadIfModified();
    for (const user of this.records.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  public async findAll(role?: UserRole): Promise<UserRecord[]> {
    await this.hydrateFromPostgres();
    this.reloadIfModified();
    const all = Array.from(this.records.values());
    if (role) {
      return all.filter((u) => u.role === role);
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async update(userId: string, partial: Partial<Omit<UserRecord, 'userId' | 'createdAt'>>): Promise<UserRecord | null> {
    await this.hydrateFromPostgres();
    this.reloadIfModified();
    const existing = this.records.get(userId);
    if (!existing) return null;

    const updated: UserRecord = {
      ...existing,
      ...partial,
      updatedAt: new Date(),
    };
    await this.saveToPostgres(updated);
    this.records.set(userId, updated);
    this.persist();
    return updated;
  }

  public async delete(userId: string): Promise<boolean> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
      } catch (err: any) {
        this.logger.warn(`[UserRepository] Delete in PostgreSQL error: ${err.message}`);
      }
    }
    this.reloadIfModified();
    const existed = this.records.delete(userId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
