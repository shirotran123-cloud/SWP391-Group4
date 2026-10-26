import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RotateCw,
  CheckCircle,
  Settings,
  Sparkles,
  UserX,
  UserCheck,
  Terminal,
  GitCompare,
  Scale,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}
import { API_BASE_URL, GOOGLE_CLIENT_ID as DEFAULT_CLIENT_ID } from '../config';

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
  const [directEmailInput, setDirectEmailInput] = useState<string>('linhcampochia@gmail.com');
  const [showConfig, setShowConfig] = useState(false);
  const [showTester, setShowTester] = useState(false);

  // Xử lý xác thực khi Google chuyển hướng về (OAuth 2.0 Redirect Callback)
  useEffect(() => {
    const handleGoogleCallback = async () => {
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

      if (idToken || accessToken) {
        setLoading(true);
        setSuccessMsg('Đang nhận diện tài khoản Google và xác thực phân quyền với AITA...');
        setErrorMsg(null);
        setBlockedEmail(null);

        try {
          let email = '';
          let fullName = '';

          if (idToken) {
            const base64Url = idToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const parsed = JSON.parse(jsonPayload);
            email = parsed.email;
            fullName = parsed.name || email.split('@')[0];
          } else if (accessToken) {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const profile = await userInfoRes.json();
            email = profile.email;
            fullName = profile.name || email.split('@')[0];
          }

          if (email) {
            window.history.replaceState(null, '', window.location.pathname);
            await verifyEmailWithBackend(email, fullName, idToken || undefined);
          }
        } catch (err: any) {
          setErrorMsg('Lỗi khi xử lý phản hồi từ Google OAuth: ' + err.message);
          setLoading(false);
        }
      }
    };

    void handleGoogleCallback();
  }, [onLoginSuccess]);

  // Gửi thông tin tài khoản Google về backend để kiểm tra trong CSDL và cấp quyền
  const verifyEmailWithBackend = async (email: string, fullName?: string, credential?: string) => {
    setLoading(true);
    setErrorMsg(null);
    setBlockedEmail(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, credential }),
      });

      const json = await res.json();

      // NẾU TÀI KHOẢN CHƯA CÓ TRÊN HỆ THỐNG -> CHẶN LẠI VÀ BÁO LỖI RÕ RÀNG
      if (!res.ok) {
        setBlockedEmail(email);
        setErrorMsg(
          json.message ||
            `Tài khoản Gmail '${email}' chưa có trên hệ thống AITA! Hệ thống từ chối cấp quyền truy cập.`
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

  // Điều hướng thẳng sang trang đăng nhập thật của Google (Google OAuth 2.0 Endpoint)
  const handleRedirectToGoogle = () => {
    setErrorMsg(null);
    setBlockedEmail(null);
    setSuccessMsg(null);
    setLoading(true);

    const redirectUri = redirectUriConfig.trim() || window.location.origin;
    const activeClientId = clientId.trim() || DEFAULT_CLIENT_ID;

    // URL OAuth 2.0 chuẩn của Google - chuyển hướng sang trang Google chính thức
    const googleOAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token%20id_token&` +
      `scope=openid%20email%20profile&` +
      `prompt=select_account&` +
      `nonce=${Date.now()}`;

    console.log('[Google OAuth] Điều hướng tới URL chính thức của Google:', googleOAuthUrl);
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
    <div className="login-shell">
      {/* CỘT TRÁI: ĐỊNH VỊ SẢN PHẨM */}
      <div className="login-brand">
        <div className="login-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '40px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'var(--blue-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--on-blue)',
              boxShadow: '0 6px 16px -6px rgba(37, 99, 235, 0.55)',
            }}
          >
            <ShieldCheck size={19} strokeWidth={2.2} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>AITA</span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '2px 7px',
              borderRadius: '5px',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-dim)',
            }}
          >
            FPT UNIVERSITY
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(30px, 3.1vw, 42px)',
            fontWeight: 700,
            lineHeight: 1.14,
            letterSpacing: '-0.038em',
            color: 'var(--text-main)',
            margin: 0,
            maxWidth: '15ch',
          }}
        >
          Chấm bài lập trình{' '}
          <span style={{ color: 'var(--blue-200)' }}>minh bạch và tự động.</span>
        </h1>

        <p style={{ marginTop: '20px', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--text-muted)', maxWidth: '46ch' }}>
          Hệ thống thực thi mã nguồn trong sandbox, đối soát đạo văn trên cây cú pháp trừu tượng và đánh giá
          chất lượng kiến trúc theo bộ tiêu chí SOLID.
        </p>

        <div className="login-features" style={{ marginTop: '34px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { icon: Terminal, title: 'Sandbox cách ly', desc: 'Chạy testcase trong Docker, giới hạn CPU và bộ nhớ.' },
            { icon: GitCompare, title: 'Đối soát AST', desc: 'Phát hiện đạo văn kể cả khi đã đổi tên biến, hàm.' },
            { icon: Scale, title: 'Khiếu nại có kiểm soát', desc: 'Mỗi bài nộp có quy trình phúc khảo minh bạch.' },
          ].map((f) => (
            <div key={f.title} className="login-feature">
              <span className="login-feature-icon">
                <f.icon size={14} strokeWidth={2.2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-soft)' }}>{f.title}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="login-metric-row">
          {[
            { v: '7', l: 'bước chấm tự động' },
            { v: '3', l: 'ngôn ngữ sandbox' },
            { v: '2', l: 'lượt phúc khảo tối đa' },
          ].map((m) => (
            <div key={m.l} className="login-metric">
              <span className="login-metric-value">{m.v}</span>
              <span className="login-metric-label">{m.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: THẺ ĐĂNG NHẬP */}
      <div className="login-card">
        <div style={{ marginBottom: '22px' }}>
          <span className="login-kicker">
            <ShieldCheck size={11} strokeWidth={2.4} />
            Nền tảng chấm bài
          </span>
          <h2 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.025em', margin: '12px 0 0' }}>
            Đăng nhập
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, marginTop: '7px' }}>
            Dùng tài khoản Google đã được nhà trường cấp quyền.
          </p>
        </div>

        {/* THÔNG BÁO CHẶN TÀI KHOẢN (NẾU CHƯA CÓ TRONG HỆ THỐNG) */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '11px',
              padding: '13px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--state-bad-bg)',
              border: '1px solid var(--state-bad-border)',
              color: 'var(--text-soft)',
              fontSize: '12.5px',
              marginBottom: '16px',
              textAlign: 'left',
              lineHeight: '1.55',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--state-bad)' }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--state-bad)', marginBottom: '3px', fontSize: '12.5px' }}>
                Tài khoản chưa được cấp quyền
              </div>
              <div>{errorMsg}</div>
              {blockedEmail && (
                <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                  Email bị từ chối: <strong style={{ color: 'var(--text-main)' }}>{blockedEmail}</strong>
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
              borderRadius: '10px',
              backgroundColor: 'var(--state-info-bg)',
              border: '1px solid var(--border-blue)',
              color: 'var(--blue-200)',
              fontSize: '12.5px',
              marginBottom: '18px',
              textAlign: 'left',
              lineHeight: 1.5,
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, color: 'var(--blue-300)' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* NÚT DUY NHẤT: ĐIỀU HƯỚNG SANG TRANG ĐĂNG NHẬP GOOGLE CHÍNH THỨC */}
        <div style={{ marginBottom: '14px' }}>
          <GoogleSignInButton
            onClick={handleRedirectToGoogle}
            loading={loading}
            label="Sign in with Google"
            height={46}
          />
        </div>

        <p
          style={{
            fontSize: '11.5px',
            color: 'var(--text-dim)',
            lineHeight: 1.6,
            margin: '0 0 18px 0',
            textAlign: 'center',
          }}
        >
          Chỉ tài khoản Gmail đã có trong cơ sở dữ liệu của trường mới được cấp quyền truy cập.
        </p>

        {/* CÔNG CỤ TRÌNH DIỄN: KIỂM TRA TÀI KHOẢN TRONG CSDL */}
        <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', justifyContent: 'center', gap: '16px', borderTop: '1px solid var(--border-soft)', paddingTop: '14px' }}>
          <button
            onClick={() => setShowTester(!showTester)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 500,
            }}
          >
            <Sparkles size={12} /> {showTester ? 'Ẩn kiểm tra CSDL' : 'Kiểm tra tài khoản (demo)'}
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Settings size={12} /> Cấu hình
          </button>
        </div>

        {/* Khung demo kiểm tra phản hồi từ Google và CSDL AITA */}
        {showTester && (
          <div className="login-panel" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--blue-200)', marginBottom: '9px', fontWeight: 700 }}>
              Thử nghiệm luồng xác thực Google SSO &amp; Kiểm tra CSDL:
            </div>

            {/* Ô nhập email bất kỳ để đăng nhập trực tiếp (Bypass redirect_uri_mismatch nếu Google Cloud chưa cập nhật) */}
            <div style={{ marginBottom: '11px', display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={directEmailInput}
                onChange={(e) => setDirectEmailInput(e.target.value)}
                placeholder="Nhập email Google SSO..."
                className="login-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (directEmailInput.trim()) {
                    verifyEmailWithBackend(directEmailInput.trim(), directEmailInput.split('@')[0]);
                  }
                }}
                className="login-btn-primary"
              >
                Đăng nhập ngay
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { email: 'linhcampochia@gmail.com', name: 'Linh Campochia', note: 'Tài khoản của bạn • Student', strong: true },
                { email: 'phaithayj@gmail.com', name: 'Vinh Nguyễn Hoàng', note: 'Hợp lệ • Student' },
                { email: 'mochibunnyyy123@gmail.com', name: 'Viktor Wilson', note: 'Hợp lệ • Student' },
                { email: 'linhcampochia@gmail.com', name: 'Linh Cam Po Chia', note: 'Đã cấp quyền • Giảng Viên', strong: true },
                { email: 'giangvien.edu@gmail.com', name: 'ThS. Giảng Viên AITA', note: 'Hợp lệ • Lecturer' },
                { email: 'admin@aita.fpt.edu.vn', name: 'Quản Trị Viên AITA', note: 'Hợp lệ • Admin Quản Trị', strong: true },
                { email: 'admin.aita@gmail.com', name: 'Quản Trị Viên AITA (Gmail)', note: 'Hợp lệ • Admin Gmail', strong: true },
              ].map((a, i) => (
                <button
                  key={a.email + i}
                  type="button"
                  onClick={() => verifyEmailWithBackend(a.email, a.name)}
                  className={'login-demo-btn' + (a.strong ? ' login-demo-btn-strong' : '')}
                >
                  <UserCheck size={14} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>{a.email}</strong> ({a.note})
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('chua_dang_ky@gmail.com', 'Người Lạ')}
                className="login-demo-btn login-demo-btn-muted"
              >
                <UserX size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>chua_dang_ky@gmail.com</strong> (Chưa có trong hệ thống • Bị chặn)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Khung cấu hình Client ID & Redirect URI */}
        {showConfig && (
          <div className="login-panel" style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                Google OAuth 2.0 Client ID:
              </label>
              <input
                type="text"
                defaultValue={clientId}
                id="config-client-id"
                placeholder="788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com"
                className="login-input"
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                OAuth Redirect URI (Phải trùng khớp 100% cấu hình trên Google Cloud Console):
              </label>
              <input
                type="text"
                defaultValue={redirectUriConfig}
                id="config-redirect-uri"
                placeholder="http://localhost:5173"
                className="login-input"
              />
              <span style={{ fontSize: '10.5px', color: 'var(--blue-200)', marginTop: '5px', display: 'block', lineHeight: 1.5 }}>
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
              className="login-btn-primary"
            >
              Lưu Cấu Hình
            </button>
          </div>
        )}

        {/* Chân trang thông tin kỹ thuật */}
        <div
          style={{
            paddingTop: '15px',
            borderTop: '1px solid var(--border-soft)',
            fontSize: '11px',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>SWP391 · Nhóm 4</span>
          <span style={{ color: 'var(--border-strong)' }}>•</span>
          <span>Google OAuth 2.0</span>
        </div>
      </div>
    </div>
  );
};
