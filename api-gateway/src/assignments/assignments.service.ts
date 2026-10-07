import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AssignmentRepository } from '../database/assignment.repository';
import { CourseRepository } from '../database/course.repository';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AssignmentRecord } from '../database/assignment.entity';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly assignmentRepo: AssignmentRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  public async createAssignment(dto: CreateAssignmentDto): Promise<AssignmentRecord> {
    const existingById = await this.assignmentRepo.findById(dto.assignmentId);
    if (existingById) {
      throw new ConflictException(`Bài tập với mã ID ${dto.assignmentId} đã tồn tại!`);
    }

    const course = await this.courseRepo.findById(dto.courseId);
    if (!course) {
      this.logger.warn(`[AssignmentsService] Course ${dto.courseId} not found. Creating assignment anyway.`);
    }

    const deadline = new Date(dto.deadline);
    if (isNaN(deadline.getTime())) {
      throw new BadRequestException('Hạn chót nộp bài (deadline) không đúng định dạng ngày tháng hợp lệ!');
    }

    const record = await this.assignmentRepo.create({
      assignmentId: dto.assignmentId,
      courseId: dto.courseId,
      title: dto.title,
      description: dto.description,
      allowedLanguages: dto.allowedLanguages || ['java', 'python', 'cpp', 'dotnet'],
      maxScore: dto.maxScore || 10.0,
      deadline,
      timeLimitMs: dto.timeLimitMs || 2000,
      memoryLimitMb: dto.memoryLimitMb || 512,
      testcasesCount: dto.testcasesCount || 2,
      isActive: true,
    });

    this.logger.log(`[AssignmentsService] Created assignment ${record.assignmentId} for course ${record.courseId}`);
    return record;
  }

  public async getAllAssignments(courseId?: string): Promise<AssignmentRecord[]> {
    if (courseId) {
      return this.assignmentRepo.findByCourseId(courseId);
    }
    return this.assignmentRepo.findAll();
  }

  public async getAssignmentById(assignmentId: string): Promise<AssignmentRecord> {
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Không tìm thấy bài tập với ID: ${assignmentId}`);
    }
    return assignment;
  }

  public async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto): Promise<AssignmentRecord> {
    await this.getAssignmentById(assignmentId);

    const partial: any = { ...dto };
    if (dto.deadline) {
      const parsedDeadline = new Date(dto.deadline);
      if (isNaN(parsedDeadline.getTime())) {
        throw new BadRequestException('Hạn chót nộp bài không đúng định dạng!');
      }
      partial.deadline = parsedDeadline;
    }

    const updated = await this.assignmentRepo.update(assignmentId, partial);
    this.logger.log(`[AssignmentsService] Updated assignment ${assignmentId}`);
    return updated!;
  }

  public async deleteAssignment(assignmentId: string): Promise<{ success: boolean; message: string }> {
    await this.getAssignmentById(assignmentId);
    const success = await this.assignmentRepo.delete(assignmentId);
    this.logger.log(`[AssignmentsService] Deleted assignment ${assignmentId}`);
    return { success, message: `Đã xóa bài tập ${assignmentId} thành công.` };
  }
}
