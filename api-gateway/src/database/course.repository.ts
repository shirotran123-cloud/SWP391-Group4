import { Injectable, Logger } from '@nestjs/common';
import { CourseRecord } from './course.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CourseRepository {
  private readonly logger = new Logger(CourseRepository.name);
  private readonly records: Map<string, CourseRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'courses_store.json');
    this.initStore();
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
    } catch (err) {
      this.logger.warn(`[CourseRepository] Failed to load store: ${err.message}. Seeding defaults.`);
      this.seedInitialCourses();
    }
  }

  private seedInitialCourses(): void {
    const defaultCourses: CourseRecord[] = [
      {
        courseId: 'COURSE-SWP391',
        courseCode: 'SWP391',
        courseName: 'Application Development Project',
        description: 'Dự án Phát triển Ứng dụng - Kỹ thuật phần mềm',
        semester: 'Fall 2026',
        instructorId: 'GV001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        courseId: 'COURSE-PRN211',
        courseCode: 'PRN211',
        courseName: 'Basic Cross-Platform .NET Application',
        description: 'Lập trình ứng dụng đa nền tảng với .NET Core',
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
    } catch (err) {
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
    this.records.set(newRecord.courseId, newRecord);
    this.persist();
    return newRecord;
  }

  public async findById(courseId: string): Promise<CourseRecord | null> {
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
    this.records.set(courseId, updated);
    this.persist();
    return updated;
  }

  public async delete(courseId: string): Promise<boolean> {
    const existed = this.records.delete(courseId);
    if (existed) {
      this.persist();
    }
    return existed;
  }
}
