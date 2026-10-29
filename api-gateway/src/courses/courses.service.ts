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
    const courseId = dto.courseId?.trim() || ('CRS-' + dto.courseCode.trim().toUpperCase());

    const existingById = await this.courseRepo.findById(courseId);
    if (existingById) {
      throw new ConflictException(`Khóa học với mã ID ${courseId} đã tồn tại!`);
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
      courseId,
      courseCode: dto.courseCode,
      courseName: dto.courseName,
      description: dto.description,
      semester: dto.semester,
      instructorId: dto.instructorId,
      isActive: true,
    });

    this.logger.log(`[CoursesService] Created course ${record.courseCode} (${record.courseId})`);

    // Tự động ghi danh danh sách sinh viên mẫu vào lớp học phần mới để sinh viên có thể thấy bài tập ngay
    try {
      await this.courseRepo.bulkEnrollStudents(courseId, [
        { studentCode: 'SE170000', fullName: 'Đỗ Thành Trung', email: 'trungdt.student@aita.fpt.edu.vn' },
        { studentCode: 'SE170001', fullName: 'Nguyễn Hoàng Phái Thầy', email: 'phaithayj@gmail.com' },
        { studentCode: 'SE170002', fullName: 'Trần Công Tiến', email: 'tientc@aita.fpt.edu.vn' },
      ]);
      this.logger.log(`[CoursesService] Auto-enrolled default student roster into course ${courseId}`);
    } catch (enrollErr: any) {
      this.logger.warn(`[CoursesService] Auto-enroll info: ${enrollErr.message}`);
    }

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

  public async bulkImportStudents(
    courseId: string,
    students: Array<{ studentCode: string; fullName: string; email: string }>,
  ): Promise<{ enrolledCount: number; message: string }> {
    await this.getCourseById(courseId);
    return this.courseRepo.bulkEnrollStudents(courseId, students);
  }

  public async getCoursesByStudent(studentId: string): Promise<CourseRecord[]> {
    const user = (await this.userRepo.findById(studentId)) || (await this.userRepo.findByEmail(studentId));
    const idToSearch = user?.userId || user?.studentCode || studentId;
    const emailToSearch = user?.email || (studentId.includes('@') ? studentId : undefined);
    return this.courseRepo.findCoursesByStudent(idToSearch, emailToSearch);
  }

  public async getStudentsInCourse(courseId: string) {
    await this.getCourseById(courseId);
    return this.courseRepo.getStudentsInCourse(courseId);
  }

  public async removeStudentFromCourse(
    courseId: string,
    studentId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.getCourseById(courseId);
    const success = await this.courseRepo.removeStudentFromCourse(courseId, studentId);
    return {
      success,
      message: `Đã xóa sinh viên ${studentId} khỏi lớp học phần ${courseId}.`,
    };
  }
}

