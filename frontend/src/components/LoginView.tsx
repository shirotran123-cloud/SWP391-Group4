import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Terminal,
  ExternalLink,
  RotateCw,
  CheckCircle,
  Settings,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const API_BASE_URL = 'http://localhost:3000';

// Client ID mặc định từ hệ thống trường hoặc từ biến môi trường VITE_GOOGLE_CLIENT_ID
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('aita_google_client_id') || DEFAULT_CLIENT_ID;
  });
  const [showConfig, setShowConfig] = useState(false);

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
        setSuccessMsg('Đang nhận diện tài khoản Google và xác thực với AITA...');

        try {
          let email = '';
          let fullName = '';

          if (idToken) {
            // Giải mã JWT payload từ Google id_token
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
            // Lấy thông tin người dùng từ Google UserInfo API
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const profile = await userInfoRes.json();
            email = profile.email;
            fullName = profile.name || email.split('@')[0];
          }

          if (email) {
            // Xóa hash trên thanh địa chỉ để URL sạch sẽ
            window.history.replaceState(null, '', window.location.pathname);

            // Gửi lên Backend API Gateway để cấp quyền JWT AITA
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, fullName, credential: idToken }),
            });

            const json = await res.json();

            if (!res.ok) {
              setErrorMsg(
                json.message ||
                  `Tài khoản '${email}' chưa được phân quyền trong hệ thống AITA! Vui lòng liên hệ Quản trị viên.`
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
              }, 300);
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
    setSuccessMsg(null);
    setLoading(true);

    const redirectUri = window.location.origin;
    const activeClientId = clientId.trim() || DEFAULT_CLIENT_ID;

    // URL chuyển hướng chính thức của Google OAuth 2.0
    const googleOAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token%20id_token&` +
      `scope=openid%20email%20profile&` +
      `prompt=select_account&` +
      `nonce=${Date.now()}`;

    console.log('[Google OAuth] Điều hướng tới URL chính thức của Google:', googleOAuthUrl);

    // Chuyển hướng trình duyệt sang trang đăng nhập chính thức của Google
    window.location.href = googleOAuthUrl;
  };

  const handleSaveClientId = (val: string) => {
    setClientId(val);
    localStorage.setItem('aita_google_client_id', val);
    setShowConfig(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 15%, #1e1b4b 0%, #070a13 75%)',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '42px 36px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.18)',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Glow trang trí phía trên 4 màu Google */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            height: '4px',
            background: 'linear-gradient(90deg, #4285F4 0%, #34A853 35%, #FBBC05 70%, #EA4335 100%)',
            borderRadius: '0 0 8px 8px',
          }}
        />

        {/* Logo và Tiêu đề hệ thống */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              color: '#ffffff',
              marginBottom: '18px',
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Terminal size={34} />
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              marginBottom: '8px',
            }}
          >
            AITA-INTELLIGENT
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: '1.5', margin: 0 }}>
            Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động
          </p>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
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

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '24px',
              textAlign: 'left',
              lineHeight: '1.4',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
            <div>{errorMsg}</div>
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
              marginBottom: '24px',
              textAlign: 'left',
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, color: '#10b981' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* NÚT DUY NHẤT: CHUYỂN HƯỚNG SANG TRANG GOOGLE */}
        <div style={{ marginBottom: '20px' }}>
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
            color: 'var(--text-muted)',
            lineHeight: '1.6',
            margin: '0 0 16px 0',
          }}
        >
          Nhấp nút trên để chuyển hướng sang trang đăng nhập chính thức của Google (<code style={{ color: '#a8c7fa' }}>accounts.google.com</code>).
        </p>

        {/* Nút tuỳ chỉnh Client ID nếu cần */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              textDecoration: 'underline',
            }}
          >
            <Settings size={12} /> Cấu hình Google Client ID ({clientId ? 'Đã thiết lập' : 'Mặc định'})
          </button>
        </div>

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
          <span>Official Google OAuth 2.0 Redirect</span>
        </div>
      </div>
    </div>
  );
};
