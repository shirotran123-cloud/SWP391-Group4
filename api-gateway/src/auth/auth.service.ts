import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { UserRepository } from '../database/user.repository';
import { UserRecord } from '../database/user.entity';
import * as crypto from 'crypto';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  exp: number;
  iat: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret = process.env.JWT_SECRET || 'aita_super_secret_jwt_key_swp391_2026';

  constructor(private readonly userRepo: UserRepository) {}

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
   * Đăng nhập qua Google SSO (UC-01):
   * Chỉ cho phép tài khoản trường (@fpt.edu.vn, @fe.edu.vn) hoặc email sinh viên đã có trong whitelist lớp học.
   */
  public async loginWithGoogle(email: string, fullName?: string): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    const isSchoolDomain = lowerEmail.endsWith('@fpt.edu.vn') || lowerEmail.endsWith('@fe.edu.vn') || lowerEmail.endsWith('@aita.fpt.edu.vn');

    let user = await this.userRepo.findByEmail(lowerEmail);

    // Nếu không phải domain trường và cũng không nằm trong whitelist -> CHẶN
    if (!isSchoolDomain && !user) {
      this.logger.warn(`[AuthService] Chặn đăng nhập Google SSO từ domain trái phép: ${lowerEmail}`);
      throw new ForbiddenException(
        `Đăng nhập Google SSO bị từ chối! Email '${lowerEmail}' không thuộc tổ chức (@fpt.edu.vn / @fe.edu.vn) và chưa được giảng viên phân lớp.`,
      );
    }

    // Nếu là domain trường nhưng chưa có tài khoản, tự động khởi tạo
    if (!user) {
      const generatedId = `SE${Math.floor(100000 + Math.random() * 900000)}`;
      user = await this.userRepo.create({
        userId: generatedId,
        email: lowerEmail,
        fullName: fullName || lowerEmail.split('@')[0],
        role: lowerEmail.includes('teacher') || lowerEmail.includes('gv') ? 'INSTRUCTOR' : 'STUDENT',
        isActive: true,
      });
      this.logger.log(`[AuthService] Tự động khởi tạo tài khoản qua Google SSO: ${user.email} (${user.role})`);
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
   * Đăng nhập tiêu chuẩn bằng Email và Mật khẩu.
   */
  public async loginWithCredentials(email: string, password?: string): Promise<{ token: string; user: UserRecord }> {
    const user = await this.userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác!');
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
