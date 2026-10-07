import { IsEmail, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { UserRole } from '../../database/user.entity';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEnum(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
