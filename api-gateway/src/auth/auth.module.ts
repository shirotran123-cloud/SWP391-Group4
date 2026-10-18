import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailService } from './mail.service';
import { GoogleTokenVerifier } from './google-token.verifier';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService, GoogleTokenVerifier],
  exports: [AuthService, MailService, GoogleTokenVerifier],
})
export class AuthModule {}
