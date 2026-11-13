import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Settings,
  Sparkles,
  UserX,
  UserCheck,
  User,
  Lock,
  Mail,
  GraduationCap,
  BookOpen,
  Shield,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { UserProfile } from '../types';
import { API_BASE_URL } from '../config/api';
import { GOOGLE_CLIENT_ID as DEFAULT_CLIENT_ID } from '../config';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const DEMO_ACCOUNTS = [
  {
    email: 'giangvien.edu@gmail.com',
    name: 'ThS. Giảng Viên AITA',
    shortLabel: 'Giảng viên',
    role: 'INSTRUCTOR',
    note: 'Đã cấu hình đề bài & rubric',
    strong: true,
  },
  {
    email: 'phaithayj@gmail.com',
    name: 'Nguyễn Hoàng Vinh',
    shortLabel: 'Sinh viên 1',
    role: 'STUDENT',
    note: 'Bài nộp sạch (Pass 100% testcase)',
    strong: true,
  },
  {
    email: 'linhcampochia@gmail.com',
    name: 'Linh Campochia',
    shortLabel: 'Sinh viên 2',
    role: 'STUDENT',
    note: 'Tài khoản thực nghiệm SE170002',
    strong: true,
  },
  {
    email: 'admin.aita@gmail.com',
    name: 'Quản Trị Viên AITA',
    shortLabel: 'Admin',
    role: 'ADMIN',
    note: 'Toàn quyền cấu hình & giám sát',
    strong: true,
  },
  {
    email: 'trungdt@fe.edu.vn',
    name: 'ThS. Đinh Thành Trung',
    shortLabel: 'GV Đinh Trung',
    role: 'INSTRUCTOR',
    note: 'Giảng Viên Bộ môn SE',
    strong: false,
  },
  {
    email: 'namlh@fe.edu.vn',
    name: 'TS. Lê Hoàng Nam',
    shortLabel: 'GV Hoàng Nam',
    role: 'INSTRUCTOR',
    note: 'Giảng Viên PRJ301 & PRF192',
    strong: false,
  },
  {
    email: 'mochibunnyyy123@gmail.com',
    name: 'Viktor Wilson',
    shortLabel: 'SV Viktor',
    role: 'STUDENT',
    note: 'Sinh Viên SE170003',
    strong: false,
  },
  {
    email: 'admin@aita.fpt.edu.vn',
    name: 'Quản Trị Viên AITA',
    shortLabel: 'Admin 001',
    role: 'ADMIN',
    note: 'Admin Quản Trị (ADMIN001)',
    strong: false,
  },
];

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
  const [showMoreDemo, setShowMoreDemo] = useState(false);

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
        'Hệ thống AITA sử dụng danh sách tài khoản do nhà trường cấp quyền (whitelist). Vui lòng dùng Google SSO hoặc chọn tài khoản Demo bên dưới.'
      );
      return;
    }

    if (passwordInput.trim()) {
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
        await verifyEmailWithBackend(cleanEmail, cleanEmail.split('@')[0]);
      } catch (err: any) {
        setErrorMsg('Không thể kết nối đến máy chủ AITA API Gateway: ' + err.message);
        setLoading(false);
      }
      return;
    }

    await verifyEmailWithBackend(cleanEmail, cleanEmail.split('@')[0]);
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

  const handleSaveConfig = (cId: string, rUri: string) => {
    const cleanClientId = cId.trim() || DEFAULT_CLIENT_ID;
    const cleanRedirectUri = rUri.trim() || window.location.origin;
    setClientId(cleanClientId);
    setRedirectUriConfig(cleanRedirectUri);
    localStorage.setItem('aita_google_client_id', cleanClientId);
    localStorage.setItem('aita_google_redirect_uri', cleanRedirectUri);
    setShowConfig(false);
  };

  const primaryDemos = DEMO_ACCOUNTS.slice(0, 4);
  const extraDemos = DEMO_ACCOUNTS.slice(4);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        padding: '28px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(960px 520px at 10% 0%, rgba(14, 66, 116, 0.10), transparent 62%), linear-gradient(135deg, #FAEBEF 0%, #FDF6F8 55%, #FAEBEF 100%)',
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

        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ + DEMO NHANH */}
        <div className="aita-auth-form">
          <div className="aita-form-corner-sphere" aria-hidden="true" />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0A1E36', letterSpacing: '-0.03em', margin: 0 }}>
                {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </h2>
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                title="Cấu hình Google OAuth"
                style={{
                  background: '#FAEBEF',
                  border: '1px solid rgba(14, 66, 116, 0.24)',
                  borderRadius: '8px',
                  padding: '6px 9px',
                  color: '#0E4274',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Settings size={13} /> SSO
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '22px', lineHeight: 1.5 }}>
              {authMode === 'login'
                ? 'Đăng nhập bằng email FPT / Google hoặc chọn nhanh tài khoản Demo.'
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
                  placeholder="Email hoặc tên đăng nhập (vd: giangvien.edu@gmail.com)"
                  className="aita-pill-input"
                />
              </div>

              <div className="aita-input-wrap">
                <Lock size={16} className="aita-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Mật khẩu (để trống nếu dùng demo email)"
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
                    setErrorMsg('Vui lòng liên hệ quản trị viên FPT / dùng nút Google SSO hoặc tài khoản Demo bên dưới.')
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
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
            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
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

            {/* KHU VỰC TÀI KHOẢN DEMO NHANH (LUÔN HIỂN THỊ) */}
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: '#FDF6F8',
                border: '1.5px solid rgba(14, 66, 116, 0.24)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0E4274', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} /> Tài khoản Demo nhanh
                </span>
                <button
                  type="button"
                  onClick={() => setShowMoreDemo(!showMoreDemo)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0E4274',
                    cursor: 'pointer',
                  }}
                >
                  {showMoreDemo ? 'Thu gọn' : 'Xem tất cả'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {primaryDemos.map((a) => {
                  const IconComp = a.role === 'INSTRUCTOR' ? BookOpen : a.role === 'ADMIN' ? Shield : GraduationCap;
                  return (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmailInput(a.email);
                        void verifyEmailWithBackend(a.email, a.name);
                      }}
                      title={`${a.email} — ${a.note}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1.5px solid rgba(14, 66, 116, 0.22)',
                        color: '#0A1E36',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '7px',
                          background: '#FAEBEF',
                          color: '#0E4274',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComp size={13} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0E4274', lineHeight: 1.2 }}>
                          {a.shortLabel}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.email}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {showMoreDemo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(14, 66, 116, 0.14)' }}>
                  {extraDemos.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmailInput(a.email);
                        void verifyEmailWithBackend(a.email, a.name);
                      }}
                      className="login-demo-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(14, 66, 116, 0.2)',
                        background: '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#0A1E36' }}>
                        <UserCheck size={13} color="#0E4274" /> {a.email}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>{a.note}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setEmailInput('chua_dang_ky@gmail.com');
                      void verifyEmailWithBackend('chua_dang_ky@gmail.com', 'Người Lạ');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      background: '#fef2f2',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#991b1b' }}>
                      <UserX size={13} color="#dc2626" /> chua_dang_ky@gmail.com
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 700 }}>Test chặn 401/403</span>
                  </button>
                </div>
              )}
            </div>

            {/* Khung cấu hình Client ID & Redirect URI */}
            {showConfig && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid rgba(14, 66, 116, 0.26)',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Google OAuth 2.0 Client ID:
                  </label>
                  <input
                    type="text"
                    defaultValue={clientId}
                    id="config-client-id"
                    className="login-input"
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    OAuth Redirect URI:
                  </label>
                  <input
                    type="text"
                    defaultValue={redirectUriConfig}
                    id="config-redirect-uri"
                    className="login-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const cIdInput = document.getElementById('config-client-id') as HTMLInputElement;
                    const rUriInput = document.getElementById('config-redirect-uri') as HTMLInputElement;
                    if (cIdInput && rUriInput) {
                      handleSaveConfig(cIdInput.value, rUriInput.value);
                    }
                  }}
                  className="login-btn-primary"
                  style={{ width: '100%' }}
                >
                  Lưu Cấu Hình
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
