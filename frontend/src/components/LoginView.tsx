import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Terminal,
  ExternalLink,
  RotateCw,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const API_BASE_URL = 'http://localhost:3000';

// Biểu tượng Google chuẩn nhận diện thương hiệu Google OAuth
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

  // Xử lý xác thực khi nhận được thông tin từ Popup Google OAuth
  const handleAuthPayload = async (payload: { email: string; fullName: string; credential?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(`Đã nhận thông tin Google từ: ${payload.email}. Đang xác thực với hệ thống...`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          fullName: payload.fullName,
          credential: payload.credential,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(
          json.message ||
            `Tài khoản '${payload.email}' chưa được phân quyền trong hệ thống AITA! Vui lòng liên hệ Quản trị viên.`
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
        }, 300);
      } else {
        setErrorMsg('Phản hồi từ máy chủ không hợp lệ!');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối tới Backend API Gateway (Port 3000). Vui lòng kiểm tra lại dịch vụ!');
      setLoading(false);
    }
  };

  // Lắng nghe sự kiện từ cửa sổ Google OAuth Popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
        const { email, fullName, credential } = event.data;
        if (email) {
          void handleAuthPayload({ email, fullName, credential });
        }
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'aita_google_oauth_response' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          localStorage.removeItem('aita_google_oauth_response');
          if (data && data.email) {
            void handleAuthPayload({ email: data.email, fullName: data.fullName, credential: data.credential });
          }
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Mở cửa sổ / Tab Google OAuth để người dùng đăng nhập trên trang của Google
  const handleOpenGoogleOAuth = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    // Nếu đã cấu hình Google Cloud Client ID thật
    if (googleClientId) {
      const redirectUri = window.location.origin;
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        googleClientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token%20id_token&scope=email%20profile%20openid&prompt=select_account`;
      window.location.href = oauthUrl;
      return;
    }

    // Mở popup tab Google OAuth Account Chooser (chuẩn giao diện Google như ảnh người dùng yêu cầu)
    const width = 480;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '/google-oauth.html',
      'GoogleAccountChooser',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (popup) {
      popup.focus();
    } else {
      // Trường hợp trình duyệt chặn popup, mở trong tab mới
      window.open('/google-oauth.html', '_blank');
    }
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
              Cổng Đăng Nhập Google SSO Ủy Quyền
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

        {/* Hộp hành động Đăng nhập với Google duy nhất */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={handleOpenGoogleOAuth}
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
                Đang Kết Nối Google SSO...
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
            margin: '0 0 20px 0',
          }}
        >
          Nhấp nút trên để mở tab chọn tài khoản Google của bạn.<br />
          Hệ thống hỗ trợ tài khoản FPT (<strong>@fpt.edu.vn</strong>, <strong>@fe.edu.vn</strong>) và <strong>@gmail.com</strong>.
        </p>

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
          <span>OAuth 2.0 Identity Gateway</span>
        </div>
      </div>
    </div>
  );
};
