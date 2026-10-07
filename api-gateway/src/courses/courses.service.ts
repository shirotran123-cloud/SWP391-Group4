import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CourseRepository } from '../database/course.repository';
import { UserRepository } from '../database/user.repository';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseRecord } from '../database/course.entity';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly userRepo: UserRepository,
  ) {}

  public async createCourse(dto: CreateCourseDto): Promise<CourseRecord> {
    const existingById = await this.courseRepo.findById(dto.courseId);
    if (existingById) {
      throw new ConflictException(`Khóa học với mã ID ${dto.courseId} đã tồn tại!`);
    }

    const existingByCode = await this.courseRepo.findByCode(dto.courseCode);
    if (existingByCode) {
      throw new ConflictException(`Mã học phần ${dto.courseCode} đã tồn tại trong hệ thống!`);
    }

    // Verify instructor exists
    const instructor = await this.userRepo.findById(dto.instructorId);
    if (!instructor) {
      this.logger.warn(`[CoursesService] Instructor ${dto.instructorId} not found in DB. Creating course anyway.`);
    }

    const record = await this.courseRepo.create({
      courseId: dto.courseId,
      courseCode: dto.courseCode,
      courseName: dto.courseName,
      description: dto.description,
      semester: dto.semester,
      instructorId: dto.instructorId,
      isActive: true,
    });

    this.logger.log(`[CoursesService] Created course ${record.courseCode} (${record.courseId})`);
    return record;
  }

  public async getAllCourses(): Promise<CourseRecord[]> {
    return this.courseRepo.findAll();
  }

  public async getCourseById(courseId: string): Promise<CourseRecord> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new NotFoundException(`Không tìm thấy khóa học với ID: ${courseId}`);
    }
    return course;
  }

  public async updateCourse(courseId: string, dto: UpdateCourseDto): Promise<CourseRecord> {
    await this.getCourseById(courseId);
    const updated = await this.courseRepo.update(courseId, dto);
    this.logger.log(`[CoursesService] Updated course ${courseId}`);
    return updated!;
  }

  public async deleteCourse(courseId: string): Promise<{ success: boolean; message: string }> {
    await this.getCourseById(courseId);
    const success = await this.courseRepo.delete(courseId);
    this.logger.log(`[CoursesService] Deleted course ${courseId}`);
    return { success, message: `Đã xóa khóa học ${courseId} thành công.` };
  }
}
