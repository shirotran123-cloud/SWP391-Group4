import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('api/v1/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createCourse(@Body() dto: CreateCourseDto) {
    const course = await this.coursesService.createCourse(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo khóa học thành công.',
      data: course,
    };
  }

  @Get()
  public async getAllCourses() {
    const courses = await this.coursesService.getAllCourses();
    return {
      statusCode: HttpStatus.OK,
      total: courses.length,
      data: courses,
    };
  }

  @Get(':id')
  public async getCourseById(@Param('id') id: string) {
    const course = await this.coursesService.getCourseById(id);
    return {
      statusCode: HttpStatus.OK,
      data: course,
    };
  }

  @Put(':id')
  public async updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    const updated = await this.coursesService.updateCourse(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật thông tin khóa học thành công.',
      data: updated,
    };
  }

  @Delete(':id')
  public async deleteCourse(@Param('id') id: string) {
    const result = await this.coursesService.deleteCourse(id);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }
}
