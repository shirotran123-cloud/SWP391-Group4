import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isMockMode: boolean;

  constructor() {
    this.isMockMode = !(process.env.SMTP_USER && process.env.SMTP_PASS);
    this.initTransporter();
  }

  /** True when no SMTP credentials are configured, so OTPs are printed to the log instead of emailed. */
  public isMock(): boolean {
    return this.isMockMode;
  }

  private initTransporter() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`[MailService] Đã cấu hình Gmail SMTP cho: ${user}`);
    } else {
      this.logger.warn(
        `[MailService] Chưa cấu hình SMTP_USER / SMTP_PASS trong file .env. Hệ thống sẽ chạy chế độ MOCK (in OTP ra terminal).`
      );
    }
  }

  public async sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
    this.logger.log(`=========================================`);
    this.logger.log(`[OTP VERIFICATION] Gửi mã xác nhận tới: ${toEmail}`);
    this.logger.log(`[MÃ XÁC NHẬN CỦA BẠN]: ${otpCode}`);
    this.logger.log(`=========================================`);

    if (!this.transporter) {
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"AITA Platform Support" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `[AITA] Mã xác nhận đăng nhập của bạn: ${otpCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #6366f1; margin: 0; font-size: 24px;">AITA Online Judge Platform</h2>
              <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Hệ thống Chấm bài & Hỗ trợ Lập trình Tự động</p>
            </div>
            <div style="background-color: #1e293b; padding: 24px; border-radius: 8px; text-align: center; border: 1px solid #475569;">
              <p style="color: #cbd5e1; font-size: 15px; margin-bottom: 12px;">Mã xác nhận bảo mật để đăng nhập của bạn là:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8; margin: 16px 0; font-family: monospace;">
                ${otpCode}
              </div>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px; text-align: center;">
              Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email hoặc liên hệ quản trị viên.
            </p>
          </div>
        `,
      });
      this.logger.log(`[MailService] Đã gửi thành công email chứa OTP tới: ${toEmail}`);
      return true;
    } catch (error: any) {
      this.logger.error(`[MailService] Lỗi khi gửi email qua SMTP: ${error.message}`);
      return false;
    }
  }
}
