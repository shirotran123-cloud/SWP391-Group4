import { Controller, Get, Post, Param, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { TeamworkService } from './teamwork.service';

@Controller('api/v1/teamwork-metrics')
export class TeamworkController {
  constructor(private readonly teamworkService: TeamworkService) {}

  @Get()
  public async getAllMetrics() {
    const metrics = await this.teamworkService.getAllMetrics();
    return {
      statusCode: HttpStatus.OK,
      total: metrics.length,
      data: metrics,
    };
  }

  @Get('class/:classId')
  public async getMetricsByClass(@Param('classId') classId: string) {
    const metrics = await this.teamworkService.getMetricsByClass(classId);
    return {
      statusCode: HttpStatus.OK,
      classId,
      total: metrics.length,
      freeRidersCount: metrics.filter((m) => m.isFreeRider).length,
      data: metrics,
    };
  }

  @Get('student/:studentId')
  public async getMetricsByStudent(@Param('studentId') studentId: string) {
    const metrics = await this.teamworkService.getMetricsByStudent(studentId);
    return {
      statusCode: HttpStatus.OK,
      studentId,
      data: metrics,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async recordMetric(
    @Body()
    body: {
      classId: string;
      studentId: string;
      studentName?: string;
      commitCount: number;
      linesAdded: number;
      linesDeleted: number;
      contributionPct: number;
    },
  ) {
    const metric = await this.teamworkService.recordMetric(body);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Ghi nhận chỉ số đóng góp nhóm thành công (UC-12).',
      data: metric,
    };
  }
}
