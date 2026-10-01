import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { TestCasesService } from './test-cases.service';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';

@Controller('api/v1/test-cases')
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body() dto: CreateTestCaseDto) {
    const data = await this.testCasesService.create(dto);
    return { statusCode: HttpStatus.CREATED, message: 'Tạo test case thành công.', data };
  }

  @Get('assignment/:assignmentId')
  public async listByAssignment(@Param('assignmentId') assignmentId: string, @Query('includeHidden') includeHidden?: string) {
    const data = await this.testCasesService.listByAssignment(assignmentId, includeHidden === 'true');
    return { statusCode: HttpStatus.OK, total: data.length, data };
  }

  @Get(':id')
  public async getById(@Param('id') id: string) {
    const data = await this.testCasesService.getById(id);
    return { statusCode: HttpStatus.OK, data };
  }

  @Put(':id')
  public async update(@Param('id') id: string, @Body() dto: UpdateTestCaseDto) {
    const data = await this.testCasesService.update(id, dto);
    return { statusCode: HttpStatus.OK, message: 'Cập nhật test case thành công.', data };
  }

  @Delete(':id')
  public async delete(@Param('id') id: string) {
    const result = await this.testCasesService.delete(id);
    return { statusCode: HttpStatus.OK, ...result };
  }
}
