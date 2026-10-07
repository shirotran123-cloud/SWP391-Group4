import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateAssignmentDto {
  @IsString()
  @IsOptional()
  title?: string;

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
  @IsOptional()
  deadline?: string;

  @IsNumber()
  @IsOptional()
  timeLimitMs?: number;

  @IsNumber()
  @IsOptional()
  memoryLimitMb?: number;

  @IsNumber()
  @IsOptional()
  testcasesCount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
