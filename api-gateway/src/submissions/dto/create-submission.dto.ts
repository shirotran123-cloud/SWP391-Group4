import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  assignmentId?: string;

  @IsOptional()
  @IsString()
  language?: string;
}
