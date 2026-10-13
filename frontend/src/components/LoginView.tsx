import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RotateCw,
  CheckCircle,
  Settings,
  Search,
  UserX,
  UserCheck,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const API_BASE_URL = 'http://localhost:3000';

// Client ID mặc định từ hệ thống hoặc cấu hình
const DEFAULT_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '652923540545-ofcv5tmdn8kjiqfbnl2qf39fi6vdutfq.apps.googleusercontent.com';

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
    return localStorage.getItem('aita_google_client_id') || DEFAULT_CLIENT_ID;
  });
  const [showConfig, setShowConfig] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    status: 'FOUND' | 'NOT_FOUND' | null;
    message?: string;
    user?: any;
  }>({ status: null });
  const [lookupLoading, setLookupLoading] = useState(false);

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

            // Gửi lên Backend API Gateway để kiểm tra tài khoản và cấp quyền
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, fullName, credential: idToken }),
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
          }
        } catch (err: any) {
          setErrorMsg('Lỗi khi xử lý phản hồi từ Google OAuth: ' + err.message);
          setLoading(false);
        }
      }
    };

    void handleGoogleCallback();
  }, [onLoginSuccess]);

  // Điều hướng thẳng sang trang đăng nhập thật của Google (Google OAuth 2.0 Endpoint)
  const handleRedirectToGoogle = () => {
    setErrorMsg(null);
    setBlockedEmail(null);
    setSuccessMsg(null);
    setLoading(true);

    const redirectUri = window.location.origin;
    const activeClientId = clientId.trim() || DEFAULT_CLIENT_ID;

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

  const handleSaveClientId = (val: string) => {
    setClientId(val);
    localStorage.setItem('aita_google_client_id', val);
    setShowConfig(false);
  };

  // Tra cứu thử nghiệm quyền Gmail trước khi đăng nhập
  const handleCheckEmailStatus = async () => {
    const trimmed = lookupEmail.trim().toLowerCase();
    if (!trimmed) return;
    setLookupLoading(true);
    setLookupResult({ status: null });

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (res.ok && data.data?.user) {
        setLookupResult({
          status: 'FOUND',
          user: data.data.user,
          message: `Tài khoản '${trimmed}' HỢP LỆ! Họ tên: ${data.data.user.fullName} (${data.data.user.role}).`,
        });
      } else {
        setLookupResult({
          status: 'NOT_FOUND',
          message:
            data.message ||
            `Tài khoản Gmail '${trimmed}' KHÔNG CÓ TRÊN HỆ THỐNG! Sẽ bị hệ thống CHẶN khi đăng nhập.`,
        });
      }
    } catch (err: any) {
      setLookupResult({
        status: 'NOT_FOUND',
        message: 'Lỗi kết nối kiểm tra: ' + err.message,
      });
    } finally {
      setLookupLoading(false);
    }
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
          maxWidth: '480px',
          background: 'rgba(17, 24, 39, 0.75)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.1)',
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
              fontSize: '25px',
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
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '13.5px', lineHeight: '1.5', margin: 0 }}>
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

        {/* NÚT DUY NHẤT: CHUYỂN HƯỚNG SANG TRANG GOOGLE CHÍNH THỨC */}
        <div style={{ marginBottom: '18px' }}>
          <button
            onClick={handleRedirectToGoogle}
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
                Đang Chuyển Hướng Tới Google...
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Đăng nhập bằng Google</span>
                <ExternalLink size={16} color="#94a3b8" style={{ marginLeft: '4px' }} />
              </>
            )}
          </button>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: '1.6',
            margin: '0 0 16px 0',
          }}
        >
          Nhấp nút trên để điều hướng sang trang đăng nhập chính thức của Google (<code style={{ color: '#a8c7fa' }}>accounts.google.com</code>).<br />
          <span style={{ color: '#fbbf24', fontSize: '11.5px' }}>
            * Chỉ tài khoản Gmail đã có trong hệ thống mới được cấp quyền truy cập.
          </span>
        </p>

        {/* CÔNG CỤ TRA CỨU KIỂM TRA QUYỀN GMAIL (DÀNH CHO TEST & THUYẾT TRÌNH) */}
        <div style={{ textAlign: 'center', marginBottom: '14px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => setShowLookup(!showLookup)}
            style={{
              background: 'none',
              border: 'none',
              color: '#a5b4fc',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
          >
            <Search size={13} /> {showLookup ? 'Ẩn kiểm tra CSDL' : '🔍 Kiểm tra tài khoản trong CSDL'}
          </button>

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

        {/* Khung tra cứu CSDL trực quan */}
        {showLookup && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <label style={{ fontSize: '11.5px', color: '#c7d2fe', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Nhập Gmail để kiểm tra quyền hệ thống:
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="vd: phaithayj@gmail.com hoặc unlisted@gmail.com"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleCheckEmailStatus}
                disabled={lookupLoading}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: lookupLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {lookupLoading ? <RotateCw size={12} className="animate-spin" /> : 'Kiểm tra'}
              </button>
            </div>

            {/* Nút điền nhanh để demo */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Demo mẫu:</span>
              <button
                type="button"
                onClick={() => setLookupEmail('phaithayj@gmail.com')}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  background: 'rgba(52, 211, 153, 0.1)',
                  color: '#6ee7b7',
                  cursor: 'pointer',
                }}
              >
                phaithayj@gmail.com (Hợp lệ)
              </button>
              <button
                type="button"
                onClick={() => setLookupEmail('chua_dang_ky@gmail.com')}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  background: 'rgba(248, 113, 113, 0.1)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                }}
              >
                chua_dang_ky@gmail.com (Bị chặn)
              </button>
            </div>

            {lookupResult.status === 'FOUND' && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserCheck size={16} style={{ flexShrink: 0 }} />
                <span>{lookupResult.message}</span>
              </div>
            )}

            {lookupResult.status === 'NOT_FOUND' && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserX size={16} style={{ flexShrink: 0 }} />
                <span>{lookupResult.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Khung cấu hình Client ID */}
        {showConfig && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              marginBottom: '18px',
              textAlign: 'left',
            }}
          >
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Google OAuth 2.0 Client ID:
            </label>
            <input
              type="text"
              defaultValue={clientId}
              id="config-client-id"
              placeholder="ví dụ: 652923540545-...apps.googleusercontent.com"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                fontSize: '12px',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('config-client-id') as HTMLInputElement;
                if (input) handleSaveClientId(input.value);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Lưu cấu hình
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
          <span>Strict Whitelist Authentication</span>
        </div>
      </div>
    </div>
  );
};
