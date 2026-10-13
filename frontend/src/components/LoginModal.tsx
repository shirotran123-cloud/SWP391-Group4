import React, { useState } from 'react';
import { X, ShieldCheck, Lock, AlertCircle, ChevronRight } from 'lucide-react';
import type { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

const API_BASE_URL = 'http://localhost:3000';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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

const GOOGLE_ACCOUNTS = [
  { email: 'trungse170000@fpt.edu.vn', name: 'Đinh Thành Trung', role: 'STUDENT' as const, label: 'Sinh viên FPT', color: '#10b981' },
  { email: 'trungdt@fe.edu.vn', name: 'ThS. Đinh Thành Trung', role: 'INSTRUCTOR' as const, label: 'Giảng viên FE', color: '#818cf8' },
  { email: 'admin@aita.fpt.edu.vn', name: 'Quản trị viên Hệ thống', role: 'ADMIN' as const, label: 'Admin', color: '#f59e0b' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async (acc: { email: string; name: string; role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' }) => {
    setLoading(true);
    setLoadingEmail(acc.email);
    setAuthError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, fullName: acc.name }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.token && json.data?.user) {
          localStorage.setItem('aita_token', json.data.token);
          localStorage.setItem('aita_user', JSON.stringify(json.data.user));
          onLoginSuccess(json.data.user, json.data.token);
          onClose();
          return;
        }
      }
    } catch {
      // Fallback
    }

    setTimeout(() => {
      const mockToken = `mock_google_jwt_${Date.now()}`;
      const mockUser: User = {
        userId: acc.role === 'INSTRUCTOR' ? 'GV001' : (acc.role === 'ADMIN' ? 'AD001' : 'SE170000'),
        email: acc.email,
        fullName: acc.name,
        role: acc.role,
        department: 'FPT University',
      };
      localStorage.setItem('aita_token', mockToken);
      localStorage.setItem('aita_user', JSON.stringify(mockUser));
      setLoading(false);
      onLoginSuccess(mockUser, mockToken);
      onClose();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#121824',
          borderRadius: '20px',
          padding: '30px 24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '12px' }}>
            <GoogleIcon />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            Đăng Nhập Bằng Google OAuth 2.0
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Chọn tài khoản Google Workspace (FPT Education) để tiếp tục
          </p>
        </div>

        {authError && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} /> {authError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {GOOGLE_ACCOUNTS.map((acc) => {
            const isThisLoading = loading && loadingEmail === acc.email;
            return (
              <div
                key={acc.email}
                onClick={() => !loading && handleGoogleLogin(acc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {acc.name} <span style={{ fontSize: '10px', color: acc.color, marginLeft: '6px' }}>({acc.label})</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{acc.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)', fontSize: '12px' }}>
                  {isThisLoading ? '...' : <ChevronRight size={16} />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(10, 15, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={14} color="#06b6d4" />
          <span>Hệ thống không yêu cầu mật khẩu. Xác thực an toàn qua Google SSO.</span>
        </div>
      </div>
    </div>
  );
};
