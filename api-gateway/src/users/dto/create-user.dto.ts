import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../database/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  // HOD (Head of Department) is part of the SSOT role set, so it must be assignable.
  @IsEnum(['STUDENT', 'INSTRUCTOR', 'ADMIN', 'HOD'])
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
