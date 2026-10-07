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

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'users_store.json');
    this.initStore();
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: UserRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.userId, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[UserRepository] Loaded ${this.records.size} users from persistent store.`);
      } else {
        this.seedInitialUsers();
      }
    } catch (err) {
      this.logger.warn(`[UserRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialUsers();
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
        userId: 'GV001',
        email: 'trungdt.teacher@aita.fpt.edu.vn',
        fullName: 'ThS. Đinh Thành Trung (Giảng viên)',
        role: 'INSTRUCTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170000',
        email: 'trungdt.student@aita.fpt.edu.vn',
        fullName: 'Đinh Thành Trung (Sinh viên)',
        role: 'STUDENT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: 'SE170123',
        email: 'nguyentt@aita.fpt.edu.vn',
        fullName: 'Trần Thanh Nguyên',
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
    this.logger.log(`[UserRepository] Seeded ${defaultUsers.length} default users.`);
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`[UserRepository] Failed to persist store: ${err.message}`);
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

  public async findById(userId: string): Promise<UserRecord | null> {
    return this.records.get(userId) || null;
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.records.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  public async findAll(role?: UserRole): Promise<UserRecord[]> {
    const all = Array.from(this.records.values());
    if (role) {
      return all.filter((u) => u.role === role);
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async update(userId: string, partial: Partial<Omit<UserRecord, 'userId' | 'createdAt'>>): Promise<UserRecord | null> {
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
    const existed = this.records.delete(userId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
