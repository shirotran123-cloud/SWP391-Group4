import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTestCaseDto {
  @IsString()
  @IsNotEmpty()
  assignmentId: string;

  @IsString()
  inputData: string;

  @IsString()
  @IsNotEmpty()
  expectedOutput: string;

  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsNumber()
  @IsOptional()
  timeLimitMs?: number;
}
