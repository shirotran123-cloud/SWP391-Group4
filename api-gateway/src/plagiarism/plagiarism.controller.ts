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

  /**
   * GET /api/v1/plagiarism/benchmark-ieee
   * Bảng số liệu thực nghiệm đối soát mã nguồn ngụy trang phục vụ Bài báo IEEE (Thành viên 4)
   */
  @Get('benchmark-ieee')
  public async getIEEEBenchmark() {
    const results = await this.plagiarismService.getIEEEOffuscationBenchmark();
    return {
      statusCode: 200,
      message: 'Bộ thực nghiệm đo lường đối soát mã nguồn ngụy trang IEEE Benchmark Suite',
      totalScenarios: results.length,
      data: results,
    };
  }
}
