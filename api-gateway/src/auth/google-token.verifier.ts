import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Verifies Google ID tokens (the `credential` returned by Google Identity Services).
 *
 * Why this exists: the gateway previously trusted whatever `email` the client posted to
 * `/api/v1/auth/google`. Anyone could call that endpoint with
 * `{"email":"admin@aita.fpt.edu.vn"}` and receive a valid admin JWT — no Google account
 * and no password required. The token is now validated properly:
 *
 *   1. the signature is checked against Google's published RS256 public keys (JWKS);
 *   2. `aud` must equal our own OAuth client ID, so a token minted for another app is
 *      rejected;
 *   3. `iss` must be accounts.google.com or https://accounts.google.com;
 *   4. `exp`/`iat` must be within a small clock-skew window;
 *   5. `email_verified` must be true.
 *
 * The JWKS is cached for an hour, and unknown key IDs force a refresh so that a Google
 * key rotation heals automatically instead of locking everyone out.
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly logger = new Logger(GoogleTokenVerifier.name);
  private static readonly JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
  private static readonly ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
  private static readonly CLOCK_SKEW_SECONDS = 300;

  private jwksCache: { keys: any[]; fetchedAt: number } | null = null;

  /** True when GOOGLE_CLIENT_ID is configured, i.e. real verification is possible. */
  public isConfigured(): boolean {
    return !!this.getClientId();
  }

  private getClientId(): string {
    return (process.env.GOOGLE_CLIENT_ID || '').trim();
  }

  private async fetchJwks(forceRefresh = false): Promise<any[]> {
    const now = Date.now();
    if (!forceRefresh && this.jwksCache && now - this.jwksCache.fetchedAt < 3600_000) {
      return this.jwksCache.keys;
    }

    const res = await fetch(GoogleTokenVerifier.JWKS_URL);
    if (!res.ok) {
      throw new UnauthorizedException(
        `Không tải được khoá công khai của Google (HTTP ${res.status}).`,
      );
    }
    const body: any = await res.json();
    const keys: any[] = Array.isArray(body?.keys) ? body.keys : [];
    if (keys.length === 0) {
      throw new UnauthorizedException('Google không trả về khoá công khai nào.');
    }
    this.jwksCache = { keys, fetchedAt: now };
    return keys;
  }

  /**
   * Returns the verified profile, or throws UnauthorizedException.
   * Never trust the returned data without having called this first.
   */
  public async verify(idToken: string): Promise<{ email: string; name?: string; picture?: string }> {
    const clientId = this.getClientId();
    if (!clientId) {
      // Refuse rather than silently falling back to trusting the client payload.
      throw new UnauthorizedException(
        'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID nên không thể xác minh Google ID token.',
      );
    }

    const parts = (idToken || '').split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Google ID token không đúng định dạng JWT.');
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
      throw new UnauthorizedException('Không đọc được nội dung Google ID token.');
    }

    if (header.alg !== 'RS256') {
      // Rejecting `none`/HS256 here blocks the classic algorithm-confusion attack.
      throw new UnauthorizedException(`Thuật toán token không được hỗ trợ: ${header.alg}`);
    }

    let keys = await this.fetchJwks();
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      // Google rotated its keys — refresh once before giving up.
      keys = await this.fetchJwks(true);
      jwk = keys.find((k) => k.kid === header.kid);
    }
    if (!jwk) {
      throw new UnauthorizedException('Không tìm thấy khoá công khai phù hợp với token.');
    }

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signedData = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf-8');
    const signature = Buffer.from(parts[2], 'base64url');

    const signatureValid = crypto.verify(
      'RSA-SHA256',
      signedData,
      publicKey,
      signature,
    );
    if (!signatureValid) {
      this.logger.warn('[GoogleTokenVerifier] Chữ ký ID token KHÔNG hợp lệ.');
      throw new UnauthorizedException('Chữ ký Google ID token không hợp lệ.');
    }

    // audience: the token must have been issued for OUR client id
    if (payload.aud !== clientId) {
      this.logger.warn(
        `[GoogleTokenVerifier] aud không khớp: nhận '${payload.aud}', mong đợi '${clientId}'.`,
      );
      throw new UnauthorizedException('Google ID token được cấp cho ứng dụng khác.');
    }

    if (!GoogleTokenVerifier.ISSUERS.includes(payload.iss)) {
      throw new UnauthorizedException(`Nhà phát hành token không hợp lệ: ${payload.iss}`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < nowSec - GoogleTokenVerifier.CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException('Google ID token đã hết hạn.');
    }
    if (typeof payload.iat === 'number' && payload.iat > nowSec + GoogleTokenVerifier.CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException('Google ID token có thời điểm phát hành không hợp lệ.');
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedException('Email Google chưa được xác minh.');
    }
    if (!payload.email) {
      throw new UnauthorizedException('Google ID token không chứa địa chỉ email.');
    }

    return { email: payload.email, name: payload.name, picture: payload.picture };
  }
}
