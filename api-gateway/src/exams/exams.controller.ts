import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamGeneratorClient } from './exam-generator.client';
import { GenerateExamDto } from './dto/generate-exam.dto';

/** Workflow 1 (UC-08): AI-Assisted Exam & Rubric Generation. */
@Controller('api/v1/exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly examGeneratorClient: ExamGeneratorClient,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  public async generate(@Body() dto: GenerateExamDto) {
    const result = await this.examsService.generateAndPersist(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Sinh de thi bang AI va luu vao he thong thanh cong.',
      data: result,
    };
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  public async preview(@Body() dto: GenerateExamDto) {
    const result = await this.examsService.generatePreview(dto);
    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  @Get('health')
  public async health() {
    const up = await this.examGeneratorClient.isHubHealthy();
    return {
      statusCode: HttpStatus.OK,
      data: {
        hub: up ? 'UP' : 'DOWN',
        offlineFallbackAvailable: true,
      },
    };
  }
}
