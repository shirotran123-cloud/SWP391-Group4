import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAppealDto {
  @IsNotEmpty({ message: 'Mã bài nộp (submissionId) không được để trống' })
  @IsString()
  submissionId: string;

  @IsNotEmpty({ message: 'Mã sinh viên (studentId) không được để trống' })
  @IsString()
  studentId: string;

  @IsNotEmpty({ message: 'Lý do khiếu nại (reason) không được để trống' })
  @IsString()
  @MinLength(10, { message: 'Lý do khiếu nại phải có tối thiểu 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do khiếu nại tối đa 1000 ký tự' })
  reason: string;
}
