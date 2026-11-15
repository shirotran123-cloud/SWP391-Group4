import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  User,
  Lock,
  Mail,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { UserProfile } from '../types';
import { API_BASE_URL } from '../config/api';
import { GOOGLE_CLIENT_ID as DEFAULT_CLIENT_ID } from '../config';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [fullNameInput, setFullNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [clientId] = useState<string>(() => {
    const saved = localStorage.getItem('aita_google_client_id');
    if (!saved || saved.startsWith('652923540545')) {
      return DEFAULT_CLIENT_ID;
    }
    return saved;
  });
  const [redirectUriConfig] = useState<string>(() => {
    return localStorage.getItem('aita_google_redirect_uri') || window.location.origin;
  });

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
        setSuccessMsg(`Đăng nhập thành công! Xin chào ${json.data.user.fullName}.`);
        setTimeout(() => {
          onLoginSuccess(json.data.user);
        }, 350);
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ AITA API Gateway: ' + err.message);
      setLoading(false);
    }
  };

  // Xử lý submit form Đăng nhập / Đăng ký
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setErrorMsg('Vui lòng nhập email hoặc tên đăng nhập.');
      return;
    }

    if (authMode === 'register') {
      setBlockedEmail(cleanEmail);
      setSuccessMsg(null);
      setErrorMsg(
        'Hệ thống AITA sử dụng danh sách tài khoản do nhà trường cấp quyền (whitelist). Vui lòng đăng nhập bằng Google SSO hoặc liên hệ giảng viên/quản trị viên.'
      );
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu hoặc sử dụng nút Đăng nhập với Google SSO.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setBlockedEmail(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: passwordInput }),
      });
      const json = await res.json();
      if (res.ok && json.data?.token && json.data?.user) {
        localStorage.setItem('aita_token', json.data.token);
        localStorage.setItem('aita_user', JSON.stringify(json.data.user));
        setSuccessMsg(`Đăng nhập thành công! Xin chào ${json.data.user.fullName}.`);
        setTimeout(() => onLoginSuccess(json.data.user), 350);
        return;
      }
      setBlockedEmail(cleanEmail);
      setErrorMsg(json.message || 'Email hoặc mật khẩu không chính xác.');
      setLoading(false);
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

    const googleOAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token%20id_token&` +
      `scope=openid%20email%20profile&` +
      `prompt=select_account&` +
      `nonce=${Date.now()}`;

    window.location.href = googleOAuthUrl;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        padding: '28px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      {/* KHUNG SPLIT-SCREEN ĐĂNG NHẬP / ĐĂNG KÝ */}
      <div className="aita-auth-container">
        {/* CỘT TRÁI: WELCOME HERO + SPHERES + LOGO */}
        <div className="aita-auth-hero">
          <div className="aita-hero-blob" aria-hidden="true" />
          <div className="aita-hero-sphere aita-sphere-lg" aria-hidden="true" />
          <div className="aita-hero-sphere aita-sphere-sm" aria-hidden="true" />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            {/* Header Logo trong suốt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.96)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  boxShadow: '0 8px 22px -6px rgba(5, 24, 46, 0.45)',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/aita-logo.png"
                  alt="AITA Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  AITA
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#FAEBEF', letterSpacing: '0.1em', opacity: 0.92 }}>
                  FPT UNIVERSITY
                </div>
              </div>
            </div>

            {/* Nội dung WELCOME */}
            <div style={{ margin: '44px 0 36px' }}>
              <div
                style={{
                  fontSize: 'clamp(32px, 3.6vw, 44px)',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                  lineHeight: 1.08,
                  textTransform: 'uppercase',
                }}
              >
                WELCOME
              </div>
              <div
                style={{
                  marginTop: '10px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  color: '#FAEBEF',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                AITA INTELLIGENT GRADING
              </div>
              <p
                style={{
                  marginTop: '16px',
                  fontSize: '13.5px',
                  lineHeight: 1.7,
                  color: 'rgba(250, 235, 239, 0.9)',
                  maxWidth: '36ch',
                }}
              >
                Hệ thống chấm điểm mã nguồn tự động trong Docker Sandbox, đối soát đạo văn AST Winnowing và đánh giá Clean Code / SOLID minh bạch.
              </p>
            </div>

            {/* Chỉ số tóm tắt nhỏ */}
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid rgba(250, 235, 239, 0.22)' }}>
              {[
                { val: '512MB', lbl: 'Docker Sandbox' },
                { val: 'AST', lbl: 'Winnowing' },
                { val: 'SOLID', lbl: 'GenAI Review' },
              ].map((item) => (
                <div key={item.lbl}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>{item.val}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(250, 235, 239, 0.8)' }}>{item.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="aita-auth-form">
          <div className="aita-form-corner-sphere" aria-hidden="true" />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ marginBottom: '6px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0A1E36', letterSpacing: '-0.03em', margin: 0 }}>
                {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '22px', lineHeight: 1.5 }}>
              {authMode === 'login'
                ? 'Đăng nhập bằng tài khoản FPT / Google SSO của bạn.'
                : 'Tạo yêu cầu tài khoản mới thuộc whitelist của trường.'}
            </p>

            {/* Thông báo lỗi / chặn */}
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '11px 13px',
                  borderRadius: '11px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#7f1d1d',
                  fontSize: '12px',
                  marginBottom: '14px',
                  lineHeight: 1.5,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px', color: '#b91c1c' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '2px' }}>
                    Thông báo xác thực
                  </div>
                  <div>{errorMsg}</div>
                  {blockedEmail && (
                    <div style={{ marginTop: '4px', fontSize: '11px' }}>
                      Email: <strong>{blockedEmail}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Thông báo thành công */}
            {successMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '11px 13px',
                  borderRadius: '11px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#14532d',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                }}
              >
                <CheckCircle size={16} style={{ flexShrink: 0, color: '#15803d' }} />
                <div>{successMsg}</div>
              </div>
            )}

            {/* FORM INPUTS */}
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {authMode === 'register' && (
                <div className="aita-input-wrap">
                  <User size={16} className="aita-input-icon" />
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="Họ và tên sinh viên / giảng viên"
                    className="aita-pill-input"
                  />
                </div>
              )}

              <div className="aita-input-wrap">
                <Mail size={16} className="aita-input-icon" />
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email hoặc tên đăng nhập"
                  className="aita-pill-input"
                />
              </div>

              <div className="aita-input-wrap">
                <Lock size={16} className="aita-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Mật khẩu"
                  className="aita-pill-input"
                  style={{ paddingRight: '58px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#0E4274',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? 'ẨN' : 'HIỆN'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: '#0E4274', width: '14px', height: '14px' }}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setErrorMsg('Vui lòng liên hệ quản trị viên FPT hoặc sử dụng nút Đăng nhập với Google SSO.')
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0E4274',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0E4274 0%, #175794 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px -6px rgba(14, 66, 116, 0.5)',
                  marginTop: '4px',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
              </button>
            </form>

            {/* Divider "Hoặc" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(14, 66, 116, 0.16)' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)' }}>Hoặc</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(14, 66, 116, 0.16)' }} />
            </div>

            {/* Google SSO Button */}
            <GoogleSignInButton
              onClick={handleRedirectToGoogle}
              loading={loading}
              label="Đăng nhập với Google SSO"
              height={44}
            />

            {/* Chuyển đổi Đăng nhập / Đăng ký */}
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <>
                  Chưa có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg(null);
                    }}
                    style={{ background: 'none', border: 'none', color: '#0E4274', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Đăng ký ngay
                  </button>
                </>
              ) : (
                <>
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                    }}
                    style={{ background: 'none', border: 'none', color: '#0E4274', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Đăng nhập
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
