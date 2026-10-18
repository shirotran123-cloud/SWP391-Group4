import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  RotateCw,
  CheckCircle,
  Settings,
  KeyRound,
  LogIn,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const API_BASE_URL = 'http://localhost:3000';

// Client ID mặc định từ hệ thống hoặc cấu hình
const DEFAULT_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com';

/**
 * Seeded accounts for quick sign-in during demos.
 *
 * These are NOT a bypass: clicking one performs a real `POST /api/v1/auth/login` with the
 * shared demo password below, and the server verifies the scrypt hash exactly as it does
 * for a typed password. Every account must be active in the database or the login fails.
 *
 * An earlier version of this screen posted a bare email to `/auth/google` and was granted a
 * token without any credential — that is why the server now refuses email-only sign-in.
 */
const DEMO_PASSWORD = 'Aita@2026';

interface DemoAccount {
  role: 'ADMIN' | 'HOD' | 'LECTURER' | 'STUDENT';
  email: string;
  name: string;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'ADMIN', email: 'admin@aita.fpt.edu.vn', name: 'Quản Trị Viên AITA', color: '#f59e0b' },
  { role: 'ADMIN', email: 'admin.aita@gmail.com', name: 'Quản Trị Viên (Gmail)', color: '#f59e0b' },
  { role: 'HOD', email: 'hod@fe.edu.vn', name: 'Trưởng Bộ Môn CNPM', color: '#a855f7' },
  { role: 'HOD', email: 'hod.se@gmail.com', name: 'Trưởng Bộ Môn (Gmail)', color: '#a855f7' },
  { role: 'LECTURER', email: 'trungdt@fe.edu.vn', name: 'ThS. Đinh Thành Trung', color: '#3b82f6' },
  { role: 'LECTURER', email: 'giangvien.edu@gmail.com', name: 'ThS. Giảng Viên AITA', color: '#3b82f6' },
  { role: 'LECTURER', email: 'vinhnh@fe.edu.vn', name: 'ThS. Nguyễn Hoàng Vinh', color: '#3b82f6' },
  { role: 'STUDENT', email: 'trungse170000@fpt.edu.vn', name: 'Đinh Thành Trung', color: '#10b981' },
  { role: 'STUDENT', email: 'nguyentt@fpt.edu.vn', name: 'Trần Thanh Nguyên', color: '#10b981' },
  { role: 'STUDENT', email: 'vinhtt@fpt.edu.vn', name: 'Nguyễn Hoàng Vinh', color: '#10b981' },
  { role: 'STUDENT', email: 'trungvt@fpt.edu.vn', name: 'Văn Thái Trung', color: '#10b981' },
  { role: 'STUDENT', email: 'tientc@fpt.edu.vn', name: 'Trần Công Tiến', color: '#10b981' },
  { role: 'STUDENT', email: 'sinhvien.test@fpt.edu.vn', name: 'Sinh viên Kiểm Thử', color: '#10b981' },
];

const GoogleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(() => {
    const saved = localStorage.getItem('aita_google_client_id');
    if (!saved || saved.startsWith('652923540545')) {
      return DEFAULT_CLIENT_ID;
    }
    return saved;
  });
  const [redirectUriConfig, setRedirectUriConfig] = useState<string>(() => {
    return localStorage.getItem('aita_google_redirect_uri') || window.location.origin;
  });
  const [showConfig, setShowConfig] = useState(false);

  // Xử lý xác thực khi Google chuyển hướng về (OAuth 2.0 Redirect Callback)
  useEffect(() => {
    const handleGoogleCallback = async () => {
      // Google reports some failures (redirect_uri_mismatch, invalid_client) on its own
      // error page, but when the flow is rejected the reason can also come back in the
      // query string or hash. Surface it instead of failing silently.
      const query = new URLSearchParams(window.location.search);
      const queryError = query.get('error');
      if (queryError) {
        const desc = query.get('error_description') || '';
        setErrorMsg(
          `Google từ chối yêu cầu đăng nhập (${queryError}). ${desc}`.trim() +
            (queryError === 'redirect_uri_mismatch'
              ? ` Hãy thêm "${window.location.origin}" vào Authorized JavaScript origins và Authorized redirect URIs trong Google Cloud Console.`
              : ''),
        );
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      const hash = window.location.hash;
      if (!hash) return;

      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      const error = params.get('error');

      if (error) {
        setErrorMsg(`Google OAuth trả về lỗi: ${error}`);
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      if (idToken) {
        // Redirect-flow fallback: hand the raw ID token to the backend, which verifies
        // the signature. The client never decides who the user is.
        setLoading(true);
        setSuccessMsg('Đang xác thực tài khoản Google với AITA...');
        setErrorMsg(null);
        setBlockedEmail(null);
        try {
          window.history.replaceState(null, '', window.location.pathname);
          await verifyEmailWithBackend(idToken);
        } catch (err: any) {
          setErrorMsg('Lỗi khi xử lý phản hồi từ Google OAuth: ' + err.message);
          setLoading(false);
        }
      } else if (accessToken) {
        // Access-token-only responses cannot be verified as an identity proof server-side,
        // so ask the user to use the popup button instead of silently trusting userinfo.
        setErrorMsg(
          'Google chỉ trả về access token. Vui lòng dùng nút "Đăng nhập bằng Google" để nhận ID token đã được xác minh.',
        );
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    void handleGoogleCallback();
  }, [onLoginSuccess]);

  // Gửi Google ID token (credential) về backend để xác minh chữ ký và cấp quyền.
  //
  // `credential` is REQUIRED: the backend verifies the signature, audience and expiry and
  // derives the email from the verified claims. It no longer accepts a bare email, because
  // that let anyone sign in as any account by typing an address.
  const verifyEmailWithBackend = async (credential: string) => {
    setLoading(true);
    setErrorMsg(null);
    setBlockedEmail(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const json = await res.json();

      // TÀI KHOẢN CHƯA CÓ TRÊN HỆ THỐNG -> CHẶN LẠI VÀ BÁO LỖI RÕ RÀNG
      // The email is no longer known client-side (the server reads it from the verified
      // token), so the message comes from the API.
      if (!res.ok) {
        setErrorMsg(
          json.message ||
            'Không thể xác thực tài khoản Google với hệ thống AITA. Vui lòng liên hệ Quản trị viên.'
        );
        setSuccessMsg(null);
        setLoading(false);
        return;
      }

      if (json.data && json.data.token && json.data.user) {
        localStorage.setItem('aita_token', json.data.token);
        localStorage.setItem('aita_user', JSON.stringify(json.data.user));
        setSuccessMsg(`Đăng nhập Google thành công! Xin chào ${json.data.user.fullName}.`);
        setTimeout(() => {
          onLoginSuccess(json.data.user);
        }, 400);
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ AITA API Gateway: ' + err.message);
      setLoading(false);
    }
  };

  /**
   * Quick sign-in for a seeded demo account.
   *
   * This is a real authentication request: the shared demo password is submitted to
   * `POST /api/v1/auth/login` and verified server-side against the stored scrypt hash.
   * Unlike the removed panel, holding this list grants nothing on its own — a deactivated
   * or missing account still fails.
   */
  const handleQuickLogin = async (account: DemoAccount) => {
    setLoading(true);
    setErrorMsg(null);
    setBlockedEmail(null);
    setSuccessMsg(`Đang đăng nhập với quyền ${account.role}...`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: DEMO_PASSWORD }),
      });
      const json = await res.json();

      if (!res.ok) {
        let detail = json.message || `HTTP ${res.status}`;
        if (Array.isArray(detail)) detail = detail.join('; ');
        setSuccessMsg(null);
        setErrorMsg(`Không đăng nhập được ${account.email}: ${detail}`);
        setLoading(false);
        return;
      }

      localStorage.setItem('aita_token', json.data.token);
      localStorage.setItem('aita_user', JSON.stringify(json.data.user));
      setSuccessMsg(
        `Đăng nhập thành công với quyền ${json.data.user.role}! Xin chào ${json.data.user.fullName}.`,
      );
      setTimeout(() => {
        onLoginSuccess(json.data.user);
      }, 300);
    } catch (err: any) {
      setSuccessMsg(null);
      setErrorMsg('Không thể kết nối đến máy chủ AITA API Gateway: ' + err.message);
      setLoading(false);
    }
  };

  /**
   * Starts sign-in with Google Identity Services (GIS).
   *
   * GIS renders Google's own account chooser and returns a signed ID token to a callback
   * in this page. Because nothing redirects, no `redirect_uri` is involved and
   * `redirect_uri_mismatch` cannot occur — which is what previously forced the app onto
   * one specific port. The ID token is still verified server-side.
   */
  const handleGoogleIdentitySignIn = () => {
    setErrorMsg(null);
    setBlockedEmail(null);
    setSuccessMsg(null);

    const activeClientId = clientId.trim() || DEFAULT_CLIENT_ID;
    const gsi = (window as any).google?.accounts?.id;

    if (!gsi) {
      setErrorMsg(
        'Chưa tải được thư viện Google Identity Services. Kiểm tra kết nối mạng rồi tải lại trang.',
      );
      return;
    }

    try {
      gsi.initialize({
        client_id: activeClientId,
        callback: (response: { credential?: string }) => {
          if (response?.credential) {
            void verifyEmailWithBackend(response.credential);
          } else {
            setErrorMsg('Google không trả về ID token. Vui lòng thử lại.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      // Shows the account chooser; the callback above receives the credential.
      gsi.prompt((notification: any) => {
        const reason =
          (typeof notification?.getNotDisplayedReason === 'function' &&
            notification.getNotDisplayedReason()) ||
          (typeof notification?.getSkippedReason === 'function' &&
            notification.getSkippedReason()) ||
          '';

        // `unregistered_origin` means this exact origin is missing from the OAuth client's
        // "Authorized JavaScript origins" list. Say precisely what to add instead of a
        // generic failure, because only the project owner can change that setting.
        if (reason === 'unregistered_origin') {
          setErrorMsg(
            `Google chưa cho phép origin "${window.location.origin}". ` +
              `Vào Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID ` +
              `"${activeClientId.slice(0, 24)}…" và thêm "${window.location.origin}" vào cả ` +
              `"Authorized JavaScript origins" lẫn "Authorized redirect URIs".`,
          );
          return;
        }

        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          setErrorMsg(
            `Google không hiển thị được hộp đăng nhập (lý do: ${reason || 'không xác định'}). ` +
              `Hãy cho phép popup cho trang này, hoặc dùng nút "Đăng nhập bằng Google (chuyển trang)" bên dưới.`,
          );
        }
      });
    } catch (err: any) {
      setErrorMsg('Không khởi tạo được Google Sign-In: ' + err.message);
    }
  };

  // Fallback cho môi trường không chạy được popup: dùng luồng redirect cổ điển.
  // Luồng này CẦN `redirect_uri` được đăng ký trong Google Cloud Console.
  const handleRedirectToGoogle = () => {
    setErrorMsg(null);
    setBlockedEmail(null);
    setSuccessMsg(null);
    setLoading(true);

    const redirectUri = redirectUriConfig.trim() || window.location.origin;
    const activeClientId = clientId.trim() || DEFAULT_CLIENT_ID;

    const googleOAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=id_token&` +
      `scope=openid%20email%20profile&` +
      `prompt=select_account&` +
      `nonce=${Date.now()}`;

    console.log('[Google OAuth] Redirect flow (cần redirect_uri đã đăng ký):', googleOAuthUrl);
    window.location.href = googleOAuthUrl;
  };

  const handleSaveConfig = (cId: string, rUri: string) => {
    const cleanClientId = cId.trim() || DEFAULT_CLIENT_ID;
    const cleanRedirectUri = rUri.trim() || window.location.origin;
    setClientId(cleanClientId);
    setRedirectUriConfig(cleanRedirectUri);
    localStorage.setItem('aita_google_client_id', cleanClientId);
    localStorage.setItem('aita_google_redirect_uri', cleanRedirectUri);
    setShowConfig(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 50% 20%, #1e1b4b 0%, #090d16 65%, #030712 100%)',
        padding: '24px',
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(24px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.12)',
          padding: '40px 32px',
          textAlign: 'center',
          color: '#f3f4f6',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo & Tiêu đề */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              marginBottom: '16px',
            }}
          >
            <ShieldCheck size={36} color="#818cf8" />
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              margin: '0 0 8px 0',
              background: 'linear-gradient(to right, #ffffff, #c7d2fe)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AITA-INTELLIGENT
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: '1.5', margin: 0 }}>
            Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động
          </p>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '4px 14px',
                borderRadius: '16px',
                backgroundColor: 'rgba(66, 133, 244, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(66, 133, 244, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={14} />
              Cổng Đăng Nhập Google OAuth 2.0 (SSO)
            </span>
          </div>
        </div>

        {/* THÔNG BÁO CHẶN TÀI KHOẢN (NẾU CHƯA CÓ TRONG HỆ THỐNG) */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
              lineHeight: '1.5',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '4px', fontSize: '13.5px' }}>
                ⛔ TRUY CẬP BỊ CHẶN: TÀI KHOẢN CHƯA ĐƯỢC PHÂN QUYỀN
              </div>
              <div>{errorMsg}</div>
              {blockedEmail && (
                <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#fca5a5', opacity: 0.85 }}>
                  Email bị từ chối: <strong style={{ color: '#fff' }}>{blockedEmail}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thông báo thành công nếu có */}
        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, color: '#10b981' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* NÚT CHÍNH: ĐĂNG NHẬP BẰNG GOOGLE (Google Identity Services — popup, không cần redirect_uri) */}
        <div style={{ marginBottom: '18px' }}>
          <button
            onClick={handleGoogleIdentitySignIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(66, 133, 244, 0.15)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.borderColor = 'rgba(66, 133, 244, 0.6)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? (
              <>
                <RotateCw size={20} className="animate-spin" />
                Đang xác thực với Google...
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Đăng nhập bằng Google</span>
              </>
            )}
          </button>
        </div>

        {/* The email/password + OTP sign-in was removed at the client's request;
            Google SSO is the primary entry point, with the quick accounts below as an
            alternative for demos. */}

        <p
          style={{
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: '1.6',
            margin: '0 0 12px 0',
          }}
        >
          Hộp thoại chọn tài khoản của Google (<code style={{ color: '#a8c7fa' }}>accounts.google.com</code>) sẽ mở ra để xác thực.<br />
          <span style={{ color: '#fbbf24', fontSize: '11.5px' }}>
            * Chỉ tài khoản Gmail đã có trong hệ thống CSDL mới được cấp quyền truy cập.
          </span>
        </p>

        {/* ĐĂNG NHẬP NHANH BẰNG TÀI KHOẢN MẪU (xác thực thật bằng mật khẩu ở server) */}
        <div
          style={{
            marginBottom: '16px',
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '11.5px',
              color: '#cbd5e1',
              fontWeight: 600,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <KeyRound size={13} color="#38bdf8" />
            Đăng nhập nhanh bằng tài khoản mẫu
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
            Mật khẩu dùng chung:{' '}
            <code style={{ color: '#fbbf24' }}>{DEMO_PASSWORD}</code> · bấm để đăng nhập ngay
          </div>

          {(['ADMIN', 'HOD', 'LECTURER', 'STUDENT'] as const).map((role) => (
            <div key={role} style={{ marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '10.5px',
                  color: DEMO_ACCOUNTS.find((a) => a.role === role)?.color,
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  marginBottom: '5px',
                }}
              >
                {role}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {DEMO_ACCOUNTS.filter((a) => a.role === role).map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    disabled={loading}
                    title={`Đăng nhập với ${acc.email}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#e2e8f0',
                      fontSize: '11.5px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <LogIn size={12} color={acc.color} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        color: '#7dd3fc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {acc.email}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8', flexShrink: 0 }}>
                      {acc.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Fallback for environments where popups are blocked. This path uses a redirect,
            so the origin must also be listed under the client's Authorized redirect URIs. */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <button
            onClick={handleRedirectToGoogle}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(165, 180, 252, 0.75)',
              fontSize: '11.5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            Popup bị chặn? Đăng nhập bằng Google (chuyển trang)
          </button>
        </div>

        {/* The "check account in DB" demo panel was removed: it signed the user in by
            POSTing a bare email to /api/v1/auth/google, so anyone could become any
            account (including ADMIN) without a Google account and without a password.
            The API now requires a signature-verified Google ID token, so that panel
            could no longer work anyway. */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'underline',
            }}
          >
            <Settings size={12} /> Cấu hình Client ID
          </button>
        </div>

        {/* Khung cấu hình Client ID & Redirect URI */}
        {showConfig && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Google OAuth 2.0 Client ID:
              </label>
              <input
                type="text"
                defaultValue={clientId}
                id="config-client-id"
                placeholder="788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                OAuth Redirect URI (Phải trùng khớp 100% cấu hình trên Google Cloud Console):
              </label>
              <input
                type="text"
                defaultValue={redirectUriConfig}
                id="config-redirect-uri"
                placeholder="http://localhost:5173"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '10.5px', color: '#fbbf24', marginTop: '4px', display: 'block' }}>
                * Mẹo: Thử đổi giữa http://localhost:5173 hoặc http://localhost:5173/ nếu gặp lỗi redirect_uri_mismatch.
              </span>
            </div>

            <button
              onClick={() => {
                const cIdInput = document.getElementById('config-client-id') as HTMLInputElement;
                const rUriInput = document.getElementById('config-redirect-uri') as HTMLInputElement;
                if (cIdInput && rUriInput) {
                  handleSaveConfig(cIdInput.value, rUriInput.value);
                }
              }}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Lưu Cấu Hình
            </button>
          </div>
        )}

        {/* Chân trang thông tin kỹ thuật */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>SWP391 Assessment 2 • Nhóm 4</span>
          <span>•</span>
          <span>Official Google OAuth 2.0 Redirect</span>
        </div>
      </div>
    </div>
  );
};
