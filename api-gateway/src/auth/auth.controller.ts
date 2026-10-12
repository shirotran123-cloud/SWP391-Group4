import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  public async googleSsoLogin(
    @Body('email') email: string,
    @Body('fullName') fullName?: string,
  ) {
    if (!email) {
      throw new UnauthorizedException('Thiếu địa chỉ email Google SSO!');
    }
    const result = await this.authService.loginWithGoogle(email, fullName);
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
