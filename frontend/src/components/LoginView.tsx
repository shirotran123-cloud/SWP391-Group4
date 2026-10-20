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

const API_BASE_URL = 'http://localhost:3000';

// Client ID mặc định từ hệ thống hoặc cấu hình
const DEFAULT_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com';

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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 460px)',
        alignItems: 'center',
        gap: '64px',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--ink-900)',
        padding: '48px 56px',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans)',
      }}
      className="login-shell"
    >
      {/* CỘT TRÁI: ĐỊNH VỊ SẢN PHẨM */}
      <div style={{ maxWidth: '520px' }} className="login-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'var(--blue-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--on-blue)',
            }}
          >
            <ShieldCheck size={17} strokeWidth={2.2} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>AITA</span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-dim)',
            }}
          >
            FPT UNIVERSITY
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(28px, 3vw, 38px)',
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: '-0.035em',
            color: 'var(--text-main)',
            margin: 0,
          }}
        >
          Chấm bài lập trình
          <br />
          <span style={{ color: 'var(--blue-200)' }}>minh bạch và tự động.</span>
        </h1>

        <p style={{ marginTop: '18px', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-muted)', maxWidth: '440px' }}>
          Hệ thống thực thi mã nguồn trong sandbox, đối soát đạo văn trên cây cú pháp trừu tượng và đánh giá chất
          lượng kiến trúc theo bộ tiêu chí SOLID.
        </p>

        <div style={{ marginTop: '34px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { icon: Terminal, title: 'Sandbox cách ly', desc: 'Chạy testcase trong Docker, giới hạn CPU và bộ nhớ.' },
            { icon: GitCompare, title: 'Đối soát AST', desc: 'Phát hiện đạo văn kể cả khi đã đổi tên biến, hàm.' },
            { icon: Scale, title: 'Khiếu nại có kiểm soát', desc: 'Mỗi bài nộp có quy trình phúc khảo minh bạch.' },
          ].map((f) => (
            <div key={f.title} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--blue-200)',
                }}
              >
                <f.icon size={13} strokeWidth={2.2} />
              </span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)' }}>{f.title}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: THẺ ĐĂNG NHẬP */}
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--ink-800)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px 28px',
          color: 'var(--text-main)',
          boxSizing: 'border-box',
          justifySelf: 'end',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Đăng nhập
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '12.5px', lineHeight: 1.55, marginTop: '5px' }}>
            Dùng tài khoản Google đã được nhà trường cấp quyền.
          </p>
        </div>

        {/* THÔNG BÁO CHẶN TÀI KHOẢN (NẾU CHƯA CÓ TRONG HỆ THỐNG) */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-soft)',
              fontSize: '12.5px',
              marginBottom: '18px',
              textAlign: 'left',
              lineHeight: '1.55',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', fontSize: '12.5px' }}>
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
              borderRadius: '12px',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              color: 'var(--blue-200)',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, color: 'var(--blue-300)' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* NÚT DUY NHẤT: ĐIỀU HƯỚNG SANG TRANG ĐĂNG NHẬP GOOGLE CHÍNH THỨC */}
        <div style={{ marginBottom: '16px' }}>
          <GoogleSignInButton
            onClick={handleRedirectToGoogle}
            loading={loading}
            label="Sign in with Google"
            height={44}
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
        <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', justifyContent: 'center', gap: '14px', borderTop: '1px solid var(--border-soft)', paddingTop: '14px' }}>
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
          <div
            style={{
              background: '#f7f9fc',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(37, 99, 235, 0.14)',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#1e40af', marginBottom: '8px', fontWeight: 600 }}>
              Thử nghiệm luồng xác thực Google SSO & Kiểm tra CSDL:
            </div>

            {/* Ô nhập email bất kỳ để đăng nhập trực tiếp (Bypass redirect_uri_mismatch nếu Google Cloud chưa cập nhật) */}
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={directEmailInput}
                onChange={(e) => setDirectEmailInput(e.target.value)}
                placeholder="Nhập email Google SSO..."
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(11, 18, 32, 0.05)',
                  border: '1px solid rgba(11, 18, 32, 0.1)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (directEmailInput.trim()) {
                    verifyEmailWithBackend(directEmailInput.trim(), directEmailInput.split('@')[0]);
                  }
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Đăng nhập ngay
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                onClick={() => verifyEmailWithBackend('linhcampochia@gmail.com', 'Linh Campochia')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.24)',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--blue-200)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <UserCheck size={14} />
                <span><strong>linhcampochia@gmail.com</strong> (Tài khoản của bạn • Student)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('phaithayj@gmail.com', 'Vinh Nguyễn Hoàng')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  background: 'rgba(37, 99, 235, 0.07)',
                  color: 'var(--blue-200)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={14} />
                <span><strong>phaithayj@gmail.com</strong> (Hợp lệ • Student)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('mochibunnyyy123@gmail.com', 'Viktor Wilson')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  background: 'rgba(37, 99, 235, 0.07)',
                  color: 'var(--blue-200)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={14} />
                <span><strong>mochibunnyyy123@gmail.com</strong> (Hợp lệ • Student)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('linhcampochia@gmail.com', 'Linh Cam Po Chia (Giảng Viên)')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.24)',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--blue-200)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <UserCheck size={14} />
                <span><strong>linhcampochia@gmail.com</strong> (Đã cấp quyền • Giảng Viên)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('giangvien.edu@gmail.com', 'ThS. Giảng Viên AITA')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  background: 'rgba(37, 99, 235, 0.07)',
                  color: '#1e40af',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={14} />
                <span><strong>giangvien.edu@gmail.com</strong> (Hợp lệ • Lecturer)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('admin@aita.fpt.edu.vn', 'Quản Trị Viên AITA')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.24)',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: '#1e40af',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <UserCheck size={14} />
                <span><strong>admin@aita.fpt.edu.vn</strong> (Hợp lệ • Admin Quản Trị)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('admin.aita@gmail.com', 'Quản Trị Viên AITA (Gmail)')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.24)',
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: '#1e40af',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <UserCheck size={14} />
                <span><strong>admin.aita@gmail.com</strong> (Hợp lệ • Admin Gmail)</span>
              </button>

              <button
                type="button"
                onClick={() => verifyEmailWithBackend('chua_dang_ky@gmail.com', 'Người Lạ')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(11, 18, 32, 0.13)',
                  background: 'rgba(11, 18, 32, 0.05)',
                  color: 'var(--text-main)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserX size={14} />
                <span><strong>chua_dang_ky@gmail.com</strong> (Chưa có trong hệ thống • Bị chặn)</span>
              </button>
            </div>
          </div>
        )}

        {/* Khung cấu hình Client ID & Redirect URI */}
        {showConfig && (
          <div
            style={{
              background: '#f7f9fc',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(11, 18, 32, 0.1)',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#4d5c76', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
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
                  background: 'rgba(11, 18, 32, 0.06)',
                  border: '1px solid rgba(11, 18, 32, 0.1)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#4d5c76', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
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
                  background: 'rgba(11, 18, 32, 0.06)',
                  border: '1px solid rgba(11, 18, 32, 0.1)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '10.5px', color: '#1e40af', marginTop: '4px', display: 'block' }}>
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
                background: '#2563eb',
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
            paddingTop: '16px',
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
