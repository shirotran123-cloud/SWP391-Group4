import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Workflow 1 (UC-08): payload describing the assignment the lecturer wants generated. */
export class GenerateExamDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsNotEmpty()
  courseCode: string;

  @IsString()
  @IsIn(['EASY', 'MEDIUM', 'HARD'])
  difficulty: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsArray()
  @IsOptional()
  learningOutcomes?: string[];

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  numTestCases?: number;

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;
}
