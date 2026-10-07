import { Injectable, Logger } from '@nestjs/common';
import { AssignmentRecord } from './assignment.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AssignmentRepository {
  private readonly logger = new Logger(AssignmentRepository.name);
  private readonly records: Map<string, AssignmentRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'assignments_store.json');
    this.initStore();
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

  public async create(record: Omit<AssignmentRecord, 'createdAt' | 'updatedAt'>): Promise<AssignmentRecord> {
    const now = new Date();
    const newRecord: AssignmentRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
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
    this.records.set(assignmentId, updated);
    this.persist();
    return updated;
  }

  public async delete(assignmentId: string): Promise<boolean> {
    const existed = this.records.delete(assignmentId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
