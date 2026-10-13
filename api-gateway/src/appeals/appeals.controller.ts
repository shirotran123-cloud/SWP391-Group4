import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AppealsService } from './appeals.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';
import { AppealStatus } from '../database/appeal.entity';

@Controller('api/v1/appeals')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createAppeal(@Body() dto: CreateAppealDto) {
    const appeal = await this.appealsService.createAppeal(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Đơn phúc khảo đã được tiếp nhận thành công (UC-06).',
      data: appeal,
    };
  }

  @Get()
  public async getAppeals(
    @Query('studentId') studentId?: string,
    @Query('submissionId') submissionId?: string,
    @Query('status') status?: AppealStatus,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const appeals = await this.appealsService.getAppeals({
      studentId,
      submissionId,
      status,
      limit: parsedLimit,
    });
    return {
      statusCode: HttpStatus.OK,
      total: appeals.length,
      data: appeals,
    };
  }

  @Get(':id')
  public async getAppealById(@Param('id') id: string) {
    const appeal = await this.appealsService.getAppealById(id);
    return {
      statusCode: HttpStatus.OK,
      data: appeal,
    };
  }

  @Put(':id/resolve')
  public async resolveAppeal(
    @Param('id') id: string,
    @Body() dto: ResolveAppealDto,
  ) {
    const resolved = await this.appealsService.resolveAppeal(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: `Đơn phúc khảo ${id} đã được xử lý (${dto.status}).`,
      data: resolved,
    };
  }
}
