import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTestCaseDto {
  @IsString()
  @IsOptional()
  inputData?: string;

  @IsString()
  @IsOptional()
  expectedOutput?: string;

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
