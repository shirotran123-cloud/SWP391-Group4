import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AppealStatus } from '../../database/appeal.entity';

export class ResolveAppealDto {
  @IsNotEmpty({ message: 'Trạng thái giải quyết không được để trống' })
  @IsIn(['ACCEPTED', 'REJECTED'], { message: 'Trạng thái phải là ACCEPTED hoặc REJECTED' })
  status: AppealStatus;

  @IsNotEmpty({ message: 'Mã người phản hồi (reviewerId) không được để trống' })
  @IsString()
  reviewerId: string;

  @IsNotEmpty({ message: 'Ghi chú giải quyết (resolutionNote) không được để trống' })
  @IsString()
  resolutionNote: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  adjustedScore?: number;
}
