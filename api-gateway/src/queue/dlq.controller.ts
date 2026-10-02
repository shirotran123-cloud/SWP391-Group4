import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('api/v1/queue')
export class DLQController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  public async getQueueStats() {
    const stats = await this.queueService.getQueueStats();
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  @Get('dlq')
  public async getAllDLQJobs() {
    const jobs = await this.queueService.getAllDLQJobs();
    return {
      statusCode: HttpStatus.OK,
      total: jobs.length,
      data: jobs,
    };
  }

  @Post('dlq/retry/:id')
  @HttpCode(HttpStatus.OK)
  public async retryDLQJob(@Param('id') id: string) {
    try {
      const result = await this.queueService.retryDLQJob(id);
      return {
        statusCode: HttpStatus.OK,
        ...result,
      };
    } catch (err) {
      throw new NotFoundException(err.message);
    }
  }

  @Delete('dlq/:id')
  public async deleteDLQJob(@Param('id') id: string) {
    const success = await this.queueService.deleteDLQJob(id);
    if (!success) {
      throw new NotFoundException(`Không tìm thấy bản ghi DLQ với mã: ${id}`);
    }
    return {
      statusCode: HttpStatus.OK,
      message: `Đã xóa bản ghi DLQ ${id} thành công.`,
    };
  }

  @Post('dlq/purge')
  @HttpCode(HttpStatus.OK)
  public async purgeAllDLQ() {
    const count = await this.queueService.purgeAllDLQ();
    return {
      statusCode: HttpStatus.OK,
      message: `Đã dọn sạch toàn bộ ${count} bản ghi trong Dead Letter Queue.`,
      purgedCount: count,
    };
  }
}
