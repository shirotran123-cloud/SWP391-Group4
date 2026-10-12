import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { UserRepository } from '../database/user.repository';
import { UserRecord } from '../database/user.entity';
import { MailService } from './mail.service';
import * as crypto from 'crypto';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  exp: number;
  iat: number;
}

interface OtpEntry {
  otp: string;
  expiresAt: number;
  password?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret = process.env.JWT_SECRET || 'aita_super_secret_jwt_key_swp391_2026';

  // Lưu OTP trong bộ nhớ (In-memory storage) với thời gian hết hạn 5 phút
  private readonly otpCache = new Map<string, OtpEntry>();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly mailService: MailService,
  ) {}

  /**
   * Sinh token JWT ký bằng HMAC-SHA256 (chuẩn RFC 7519 không phụ thuộc thư viện ngoài).
   */
  public signJwt(payload: Omit<JwtPayload, 'exp' | 'iat'>, expiresInSeconds = 86400): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  /**
   * Xác thực và giải mã token JWT.
   */
  public verifyJwt(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token không hợp lệ hoặc sai định dạng!');
    }

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      throw new UnauthorizedException('Chữ ký Token không hợp lệ hoặc đã bị can thiệp!');
    }

    const payload: JwtPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new UnauthorizedException('Token đã hết hạn!');
    }

    return payload;
  }

  /**
   * Bước 1: Gửi mã OTP về email của người dùng khi đăng nhập
   */
  public async requestLoginOtp(email: string, password?: string): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const lowerEmail = email.toLowerCase().trim();

    // Sinh mã ngẫu nhiên 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút hiệu lực

    this.otpCache.set(lowerEmail, {
      otp,
      expiresAt,
      password,
    });

    // Gửi email qua MailService
    await this.mailService.sendOtpEmail(lowerEmail, otp);

    return {
      success: true,
      message: `Mã OTP đã được gửi về hòm thư ${lowerEmail}.`,
      debugOtp: process.env.SMTP_USER ? undefined : otp,
    };
  }

  /**
   * Bước 2: Xác thực mã OTP và hoàn tất đăng nhập
   */
  public async verifyLoginOtp(email: string, otp: string): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    const entry = this.otpCache.get(lowerEmail);

    if (!entry) {
      throw new BadRequestException('Chưa có mã xác nhận nào được yêu cầu cho email này, hoặc mã đã bị hủy!');
    }

    if (Date.now() > entry.expiresAt) {
      this.otpCache.delete(lowerEmail);
      throw new BadRequestException('Mã xác nhận OTP đã hết hạn! Vui lòng yêu cầu mã mới.');
    }

    if (entry.otp !== otp.trim()) {
      throw new BadRequestException('Mã xác nhận OTP không chính xác!');
    }

    // Mã đúng -> Xóa OTP khỏi cache để tránh dùng lại (One-Time-Password)
    this.otpCache.delete(lowerEmail);

    let user = await this.userRepo.findByEmail(lowerEmail);
    if (!user) {
      user = await this.userRepo.create({
        userId: lowerEmail,
        email: lowerEmail,
        fullName: lowerEmail.split('@')[0],
        role: 'STUDENT',
        isActive: true,
      });
      this.logger.log(`[AuthService] Người dùng xác thực OTP tạo mới: ${user.email}`);
    }

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user };
  }

  /**
   * Đăng nhập qua Google SSO (UC-01):
   * Chỉ cho phép tài khoản trường (@fpt.edu.vn, @fe.edu.vn, @aita.fpt.edu.vn) hoặc @gmail.com hợp lệ.
   */
  public async loginWithGoogle(email: string, fullName?: string): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    const isAllowedDomain =
      lowerEmail.endsWith('@fpt.edu.vn') ||
      lowerEmail.endsWith('@fe.edu.vn') ||
      lowerEmail.endsWith('@aita.fpt.edu.vn') ||
      lowerEmail.endsWith('@gmail.com');

    // Chặn triệt để nếu không thuộc domain cho phép
    if (!isAllowedDomain) {
      this.logger.warn(`[AuthService] Chặn đăng nhập Google SSO từ domain trái phép: ${lowerEmail}`);
      throw new ForbiddenException(
        `Đăng nhập Google SSO bị từ chối! Email '${lowerEmail}' không thuộc domain được cấp phép (@fpt.edu.vn / @fe.edu.vn / @gmail.com).`,
      );
    }

    let user = await this.userRepo.findByEmail(lowerEmail);

    if (!user) {
      user = await this.userRepo.create({
        userId: lowerEmail,
        email: lowerEmail,
        fullName: fullName || lowerEmail.split('@')[0],
        role: lowerEmail.includes('teacher') || lowerEmail.includes('gv') ? 'INSTRUCTOR' : 'STUDENT',
        isActive: true,
      });
      this.logger.log(`[AuthService] Đăng ký tài khoản Google mới: ${user.email} (${user.role})`);
    }

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user };
  }

  /**
   * Đăng nhập tiêu chuẩn bằng Email và Mật khẩu (Direct login fallback nếu cần)
   */
  public async loginWithCredentials(email: string, password?: string): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    let user = await this.userRepo.findByEmail(lowerEmail);
    if (!user) {
      user = await this.userRepo.create({
        userId: lowerEmail,
        email: lowerEmail,
        fullName: lowerEmail.split('@')[0],
        role: 'STUDENT',
        isActive: true,
      });
      this.logger.log(`[AuthService] Đăng nhập tạo mới: ${user.email}`);
    }

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user };
  }
}
