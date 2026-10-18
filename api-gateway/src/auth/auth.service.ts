import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
  password?: string; // Lưu tạm để tạo user mới sau khi OTP verified
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret =
    process.env.JWT_SECRET || 'aita_super_secret_jwt_key_swp391_2026';

  // Lưu OTP trong bộ nhớ (In-memory) với thời gian hết hạn 5 phút
  private readonly otpCache = new Map<string, OtpEntry>();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly mailService: MailService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // JWT helpers
  // ─────────────────────────────────────────────────────────────────────────

  public signJwt(
    payload: Omit<JwtPayload, 'exp' | 'iat'>,
    expiresInSeconds = 86400,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

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
    const payload: JwtPayload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8'),
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new UnauthorizedException('Token đã hết hạn!');
    }
    return payload;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Password hashing helpers (Node.js crypto.scrypt — không cần bcrypt)
  // ─────────────────────────────────────────────────────────────────────────

  private async hashPassword(plain: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await new Promise<string>((resolve, reject) => {
      crypto.scrypt(plain, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
    return hash;
  }

  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    return new Promise<boolean>((resolve, reject) => {
      crypto.scrypt(plain, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        try {
          // Constant-time comparison — chống timing attack
          resolve(
            crypto.timingSafeEqual(
              Buffer.from(hash, 'hex'),
              Buffer.from(derivedKey.toString('hex'), 'hex'),
            ),
          );
        } catch {
          resolve(false);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REMOVED: "special instructor" OTP bypass
  //
  // This used to short-circuit authentication for a single hard-coded address with the
  // password `123456`, skipping OTP entirely and silently promoting the account to
  // INSTRUCTOR. That is a backdoor: anyone reading the repository could sign in as a
  // lecturer. Privilege and authentication now follow the normal path for every account.
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Bước 1: Xác thực mật khẩu → Gửi OTP
  //
  // Logic:
  //  • User có tài khoản + có passwordHash  → bắt buộc mật khẩu đúng
  //  • User có tài khoản + chưa có password → đây là lần đầu đặt mật khẩu
  //  • User mới hoàn toàn                   → ghi nhận mật khẩu, tạo tài khoản sau OTP
  //  → Sai mật khẩu = 401 UnauthorizedException, OTP KHÔNG được gửi
  // ─────────────────────────────────────────────────────────────────────────

  public async requestLoginOtp(
    email: string,
    password?: string,
  ): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const lowerEmail = email.toLowerCase().trim();

    // Mật khẩu bắt buộc
    if (!password || !password.trim()) {
      throw new UnauthorizedException('Vui lòng nhập mật khẩu để tiếp tục.');
    }

    const existingUser = await this.userRepo.findByEmail(lowerEmail);

    // BẮT BUỘC KIỂM TRA: Tài khoản phải tồn tại trên hệ thống
    if (!existingUser) {
      this.logger.warn(`[AuthService] Chặn đăng nhập: Tài khoản '${lowerEmail}' chưa có trên hệ thống AITA!`);
      throw new UnauthorizedException(
        `Tài khoản '${lowerEmail}' chưa có trên hệ thống AITA! Vui lòng liên hệ Giảng viên hoặc Quản trị viên để được cấp quyền.`,
      );
    }

    if (!existingUser.isActive) {
      this.logger.warn(`[AuthService] Chặn đăng nhập: Tài khoản '${lowerEmail}' đã bị khóa.`);
      throw new ForbiddenException(
        `Tài khoản '${lowerEmail}' đã bị khóa hoặc chưa được kích hoạt trong hệ thống.`,
      );
    }

    if (existingUser.passwordHash) {
      const isValid = await this.verifyPassword(
        password.trim(),
        existingUser.passwordHash,
      );
      if (!isValid) {
        this.logger.warn(`[AuthService] Sai mật khẩu: ${lowerEmail}`);
        throw new UnauthorizedException(
          'Mật khẩu không chính xác. Vui lòng thử lại!',
        );
      }
      this.logger.log(`[AuthService] Mật khẩu xác thực OK: ${lowerEmail}`);
    } else {
      const hashed = await this.hashPassword(password.trim());
      await this.userRepo.update(existingUser.userId, { passwordHash: hashed });
      this.logger.log(
        `[AuthService] Đặt mật khẩu lần đầu cho tài khoản: ${lowerEmail}`,
      );
    }

    // Sinh OTP 6 số và gửi email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

    this.otpCache.set(lowerEmail, { otp, expiresAt, password: password.trim() });

    await this.mailService.sendOtpEmail(lowerEmail, otp);

    return {
      success: true,
      message: `Mã OTP đã được gửi về hòm thư ${lowerEmail}. Vui lòng kiểm tra email để lấy mã xác nhận đăng nhập.`,
      // Chế độ MOCK (chưa cấu hình SMTP): trả mã về cho client để không chặn luồng demo/kiểm thử.
      // Khi SMTP đã cấu hình, debugOtp LUÔN là undefined nên mã không bao giờ lộ ra ngoài.
      debugOtp: this.mailService.isMock() ? otp : undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bước 2: Xác thực OTP → Hoàn tất đăng nhập
  // ─────────────────────────────────────────────────────────────────────────

  public async verifyLoginOtp(
    email: string,
    otp: string,
  ): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    const entry = this.otpCache.get(lowerEmail);

    if (!entry) {
      throw new BadRequestException(
        'Chưa có mã xác nhận nào được yêu cầu cho email này, hoặc mã đã bị hủy!',
      );
    }

    if (Date.now() > entry.expiresAt) {
      this.otpCache.delete(lowerEmail);
      throw new BadRequestException(
        'Mã xác nhận OTP đã hết hạn! Vui lòng yêu cầu mã mới.',
      );
    }

    if (entry.otp !== otp.trim()) {
      throw new BadRequestException('Mã xác nhận OTP không chính xác!');
    }

    this.otpCache.delete(lowerEmail);

    const user = await this.userRepo.findByEmail(lowerEmail);
    if (!user) {
      this.logger.warn(`[AuthService] Chặn hoàn tất OTP: Tài khoản '${lowerEmail}' không tồn tại trong hệ thống.`);
      throw new UnauthorizedException(
        `Tài khoản '${lowerEmail}' chưa có trên hệ thống AITA! Vui lòng liên hệ Quản trị viên để được cấp quyền.`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        `Tài khoản '${lowerEmail}' đã bị khóa hoặc chưa được kích hoạt trong hệ thống.`,
      );
    }

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user: this.toPublicUser(user) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Google SSO (UC-01) - Kiểm tra nghiêm ngặt tài khoản trong hệ thống
  // ─────────────────────────────────────────────────────────────────────────

  public async loginWithGoogle(
    email: string,
    _fullName?: string,
  ): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    const isAllowedDomain =
      lowerEmail.endsWith('@fpt.edu.vn') ||
      lowerEmail.endsWith('@fe.edu.vn') ||
      lowerEmail.endsWith('@aita.fpt.edu.vn') ||
      lowerEmail.endsWith('@gmail.com');

    if (!isAllowedDomain) {
      this.logger.warn(
        `[AuthService] Chặn Google SSO domain trái phép: ${lowerEmail}`,
      );
      throw new ForbiddenException(
        `Email '${lowerEmail}' không thuộc domain hoặc tổ chức được cấp phép.`,
      );
    }

    // KIỂM TRA BẮT BUỘC: Tài khoản Gmail phải có sẵn trong hệ thống users_store
    const user = await this.userRepo.findByEmail(lowerEmail);
    if (!user) {
      this.logger.warn(
        `[AuthService] CHẶN ĐĂNG NHẬP: Tài khoản Gmail '${lowerEmail}' chưa có trên hệ thống AITA!`,
      );
      throw new UnauthorizedException(
        `Tài khoản Gmail '${lowerEmail}' chưa có trên hệ thống AITA! Vui lòng liên hệ Giảng viên hoặc Quản trị viên để được cấp quyền truy cập.`,
      );
    }

    if (!user.isActive) {
      this.logger.warn(
        `[AuthService] CHẶN ĐĂNG NHẬP: Tài khoản '${lowerEmail}' đã bị khóa/vô hiệu hóa.`,
      );
      throw new ForbiddenException(
        `Tài khoản '${lowerEmail}' đã bị khóa hoặc chưa được kích hoạt trong hệ thống.`,
      );
    }

    this.logger.log(`[AuthService] Đăng nhập Google thành công: ${user.email} (${user.role})`);

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user: this.toPublicUser(user) };
  }

  /**
   * Strips credentials before a user record leaves the service.
   *
   * `loginWithGoogle`/`loginWithCredentials` previously returned the raw `UserRecord`,
   * which includes `passwordHash`. That leaked the scrypt salt+digest of every account to
   * any caller who could complete a login — enough to mount an offline brute force.
   */
  private toPublicUser(user: UserRecord): UserRecord {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe as UserRecord;
  }

  /**
   * Password sign-in.
   *
   * SECURITY: this used to ignore the password entirely (`_password`) and hand out a JWT
   * to anyone who knew an email address — `POST /api/v1/auth/login {"email":"admin@..."}`
   * returned an ADMIN token with no credential at all. The password is now REQUIRED and
   * verified against the stored scrypt hash.
   */
  public async loginWithCredentials(
    email: string,
    password?: string,
  ): Promise<{ token: string; user: UserRecord }> {
    const lowerEmail = email.toLowerCase().trim();
    if (!password || !password.trim()) {
      throw new UnauthorizedException('Vui lòng nhập mật khẩu để tiếp tục.');
    }

    const user = await this.userRepo.findByEmail(lowerEmail);
    if (!user) {
      this.logger.warn(`[AuthService] Chặn credentials: Tài khoản '${lowerEmail}' chưa có trên hệ thống.`);
      throw new UnauthorizedException(
        `Tài khoản '${lowerEmail}' chưa có trên hệ thống AITA! Vui lòng liên hệ Quản trị viên.`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        `Tài khoản '${lowerEmail}' đã bị khóa hoặc chưa được kích hoạt trong hệ thống.`,
      );
    }

    if (!user.passwordHash) {
      // No local password yet: the account must set one through the OTP flow first.
      throw new UnauthorizedException(
        `Tài khoản '${lowerEmail}' chưa thiết lập mật khẩu. Vui lòng đăng nhập bằng Google hoặc dùng luồng OTP để đặt mật khẩu.`,
      );
    }

    const isValid = await this.verifyPassword(password.trim(), user.passwordHash);
    if (!isValid) {
      this.logger.warn(`[AuthService] Sai mật khẩu cho tài khoản '${lowerEmail}'.`);
      throw new UnauthorizedException('Mật khẩu không chính xác. Vui lòng thử lại!');
    }

    const token = this.signJwt({
      userId: user.userId,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return { token, user: this.toPublicUser(user) };
  }
}
