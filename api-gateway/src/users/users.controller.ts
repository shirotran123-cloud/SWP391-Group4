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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../database/user.entity';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createUser(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createUser(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo tài khoản người dùng thành công.',
      data: user,
    };
  }

  @Get()
  public async getAllUsers(@Query('role') role?: UserRole) {
    const users = await this.usersService.getAllUsers(role);
    return {
      statusCode: HttpStatus.OK,
      total: users.length,
      data: users,
    };
  }

  @Get(':id')
  public async getUserById(@Param('id') id: string) {
    const user = await this.usersService.getUserById(id);
    return {
      statusCode: HttpStatus.OK,
      data: user,
    };
  }

  @Put(':id')
  public async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.updateUser(id, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật thông tin người dùng thành công.',
      data: updated,
    };
  }

  @Delete(':id')
  public async deleteUser(@Param('id') id: string) {
    const result = await this.usersService.deleteUser(id);
    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }
}
