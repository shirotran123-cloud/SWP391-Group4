import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Controller('api/v1/assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createAssignment(@Body() dto: CreateAssignmentDto) {
    const assignment = await this.assignmentsService.createAssignment(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo bài tập thành công.',
      data: assignment,
    };
  }

  @Get()
  public async getAllAssignments(@Query('courseId') courseId?: string) {
    const assignments = await this.assignmentsService.getAllAssignments(courseId);
    return {
      statusCode: HttpStatus.OK,
      total: assignments.length,
      data: assignments,
    };
  }

  @Get(':id')
  public async getAssignmentById(@Param('id') id: string) {
    const assignment = await this.assignmentsService.getAssignmentById(id);
    return {
      statusCode: HttpStatus.OK,
      data: assignment,
    };
  }

  @Put(':id')
  public async updateAssignment(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    const updated = await this.assignmentsService.updateAssignment(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật bài tập thành công.',
      data: updated,
    };
  }

  @Delete(':id')
  public async deleteAssignment(@Param('id') id: string) {
    const result = await this.assignmentsService.deleteAssignment(id);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }
}
