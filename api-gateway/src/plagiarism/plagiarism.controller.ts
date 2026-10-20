import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';

@Controller('api/v1/plagiarism')
export class PlagiarismController {
  constructor(private readonly plagiarismService: PlagiarismService) {}

  /**
   * GET /api/v1/plagiarism/matrix/:assignmentId
   * Trả về ma trận N×N độ tương đồng toàn lớp (chỉ dành LECTURER/HOD/ADMIN - BR-04)
   */
  @Get('matrix/:assignmentId')
  public async getClassMatrix(@Param('assignmentId') assignmentId: string) {
    const report = await this.plagiarismService.getAssignmentMatrix(assignmentId);
    return {
      statusCode: 200,
      data: report,
    };
  }

  /**
   * GET /api/v1/plagiarism/report/:submissionId
   * Trả về báo cáo chi tiết plagiarism của một bài nộp cụ thể
   */
  @Get('report/:submissionId')
  public async getSubmissionReport(@Param('submissionId') submissionId: string) {
    return {
      statusCode: 200,
      message: `Báo cáo plagiarism cho bài nộp ${submissionId}`,
      data: { submissionId },
    };
  }
}
