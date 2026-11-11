import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReplaceTestCaseItemDto {
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

export class ReplaceTestCasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReplaceTestCaseItemDto)
  testCases: ReplaceTestCaseItemDto[];
}

