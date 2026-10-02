import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import {
  GradingGateway,
  TestcaseEvaluatedPayload,
  GradingProgressPayload,
  GradingCompletedPayload,
} from '../websocket/grading.gateway';
import { SubmissionRepository } from '../database/submission.repository';
import { SUBMISSION_STATUS } from '../common/constants/queue.constants';

@Controller('api/v1/internal/events')
export class InternalEventsController {
  private readonly logger = new Logger(InternalEventsController.name);

  constructor(
    private readonly gradingGateway: GradingGateway,
    private readonly submissionRepo: SubmissionRepository,
  ) {}

  @Post('testcase-evaluated')
  @HttpCode(HttpStatus.OK)
  public handleTestcaseEvaluated(@Body() payload: TestcaseEvaluatedPayload) {
    this.logger.log(`[Internal Events] Received testcase:evaluated for ${payload.submissionId}`);
    this.gradingGateway.emitTestcaseEvaluated(payload);
    return { success: true };
  }

  @Post('grading-progress')
  @HttpCode(HttpStatus.OK)
  public handleGradingProgress(@Body() payload: GradingProgressPayload) {
    this.logger.log(`[Internal Events] Received grading:progress for ${payload.submissionId}`);
    this.gradingGateway.emitGradingProgress(payload);
    return { success: true };
  }

  @Post('grading-completed')
  @HttpCode(HttpStatus.OK)
  public async handleGradingCompleted(@Body() payload: GradingCompletedPayload) {
    this.logger.log(`[Internal Events] Received grading:completed for ${payload.submissionId}`);
    await this.submissionRepo.updateStatus(
      payload.submissionId,
      SUBMISSION_STATUS.COMPLETED,
      payload,
      payload.score,
    );
    this.gradingGateway.emitGradingCompleted(payload);
    return { success: true };
  }
}
