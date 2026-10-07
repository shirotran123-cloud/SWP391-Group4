import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  assignmentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  allowedLanguages?: string[];

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxScore?: number;

  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @IsNumber()
  @IsOptional()
  timeLimitMs?: number;

  @IsNumber()
  @IsOptional()
  memoryLimitMb?: number;

  @IsNumber()
  @IsOptional()
  testcasesCount?: number;
}
