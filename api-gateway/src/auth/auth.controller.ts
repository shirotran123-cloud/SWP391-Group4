import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * API Yêu cầu gửi mã OTP về Gmail người dùng
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  public async requestOtp(
    @Body('email') email: string,
    @Body('password') password?: string,
  ) {
    if (!email || !email.trim()) {
      throw new BadRequestException('Vui lòng cung cấp địa chỉ Email!');
    }

    // Kiểm tra tài khoản GV đặc biệt — bypass OTP hoàn toàn
    if (password) {
      const bypass = await this.authService.loginSpecialInstructor(email, password);
      if (bypass) {
        return {
          statusCode: HttpStatus.OK,
          message: 'Đăng nhập trực tiếp (tài khoản đặc biệt) — không cần OTP.',
          data: {
            bypassOtp: true,
            token: bypass.token,
            user: bypass.user,
          },
        };
      }
    }

    const result = await this.authService.requestLoginOtp(email, password);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: result,
    };
  }

  /**
   * API Xác thực mã OTP và nhận token đăng nhập
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  public async verifyOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
  ) {
    if (!email || !otp) {
      throw new BadRequestException('Thiếu email hoặc mã OTP xác nhận!');
    }
    const result = await this.authService.verifyLoginOtp(email, otp);
    return {
      statusCode: HttpStatus.OK,
      message: 'Xác thực OTP thành công, đăng nhập hoàn tất!',
      data: result,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  public async googleSsoLogin(
    @Body('email') email?: string,
    @Body('fullName') fullName?: string,
    @Body('credential') credential?: string,
  ) {
    let resolvedEmail = email;
    let resolvedName = fullName;

    // Nếu gửi lên Google ID Token (credential từ Google Identity Services thật của trình duyệt)
    if (credential) {
      try {
        const parts = credential.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          resolvedEmail = payload.email;
          resolvedName = payload.name || payload.email.split('@')[0];
        }
      } catch (e) {
        // Fallback nếu parse lỗi
      }
    }

    if (!resolvedEmail) {
      throw new UnauthorizedException('Thiếu địa chỉ email Google SSO!');
    }
    const result = await this.authService.loginWithGoogle(resolvedEmail, resolvedName);
    return {
      statusCode: HttpStatus.OK,
      message: 'Xác thực Google SSO thành công.',
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async credentialLogin(
    @Body('email') email: string,
    @Body('password') password?: string,
  ) {
    if (!email) {
      throw new UnauthorizedException('Thiếu địa chỉ email đăng nhập!');
    }
    const result = await this.authService.loginWithCredentials(email, password);
    return {
      statusCode: HttpStatus.OK,
      message: 'Đăng nhập thành công.',
      data: result,
    };
  }

  @Get('me')
  public async getProfile(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Yêu cầu cung cấp Bearer JWT token trong Authorization header!');
    }
    const token = authHeader.substring(7);
    const decoded = this.authService.verifyJwt(token);
    return {
      statusCode: HttpStatus.OK,
      data: decoded,
    };
  }
}
