import { Injectable, Logger } from '@nestjs/common';
import { UserRecord, UserRole } from './user.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  private readonly records: Map<string, UserRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;
  private lastMtime: number = 0;

  constructor() {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'users_store.json');
    this.initStore();
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

  public async create(record: Omit<UserRecord, 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const now = new Date();
    const newRecord: UserRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
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
      this.records.set(record.userId, record);
      createdRecords.push(record);
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
    return updated;
  }

  public async delete(userId: string): Promise<boolean> {
    this.reloadIfModified();
    const existed = this.records.delete(userId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
