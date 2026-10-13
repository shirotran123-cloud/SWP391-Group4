import React, { useState } from 'react';
import type { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

const API_BASE_URL = 'http://localhost:3000';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Tài khoản demo có sẵn trong hệ thống (seeded)
const DEMO_ACCOUNTS = [
  { email: 'admin@aita.fpt.edu.vn',          label: 'Admin',      role: 'ADMIN',      color: '#f59e0b', icon: '⚙️' },
  { email: 'trungdt.teacher@aita.fpt.edu.vn', label: 'Giảng viên', role: 'INSTRUCTOR', color: '#818cf8', icon: '📚' },
  { email: 'trungdt.student@aita.fpt.edu.vn', label: 'Sinh viên',  role: 'STUDENT',    color: '#10b981', icon: '🎓' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; otp?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  // Đăng nhập nhanh không cần OTP (dùng endpoint /auth/login trực tiếp)
  const handleQuickLogin = async (demoEmail: string) => {
    setQuickLoading(demoEmail);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thất bại!');
      const { token, user } = data.data;
      localStorage.setItem('aita_token', token);
      localStorage.setItem('aita_user', JSON.stringify(user));
      onLoginSuccess(user, token);
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setQuickLoading(null);
    }
  };

  if (!isOpen) return null;

  const handleStartCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Bước 1: Xác thực form & Gửi yêu cầu mã OTP tới Gmail
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Vui lòng nhập Email / Gmail';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Địa chỉ email không đúng định dạng';
    }

    if (!password.trim()) {
      newErrors.password = 'Vui lòng nhập Mật khẩu';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setAuthError(null);
      return;
    }

    setErrors({});
    setAuthError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Không thể gửi mã xác nhận. Vui lòng thử lại!');
      }

      setStep('OTP');
      if (data.data?.debugOtp) {
        setOtp(data.data.debugOtp);
        setSuccessMsg(`Đã tạo mã OTP cho ${trimmedEmail}: [${data.data.debugOtp}] (Tự động điền)`);
      } else {
        setSuccessMsg(data.message || `Đã gửi mã xác nhận tới ${trimmedEmail}`);
      }
      handleStartCooldown();
    } catch (err: any) {
      setAuthError(err.message || 'Lỗi kết nối tới máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Không thể gửi lại mã!');
      }
      setSuccessMsg(`Mã xác nhận mới đã được gửi tới ${email.trim()}`);
      handleStartCooldown();
    } catch (err: any) {
      setAuthError(err.message || 'Lỗi kết nối tới máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác nhận OTP và Hoàn tất đăng nhập
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedOtp = otp.trim();

    if (!trimmedOtp) {
      setErrors({ otp: 'Vui lòng nhập mã OTP gồm 6 chữ số' });
      return;
    }

    if (trimmedOtp.length !== 6) {
      setErrors({ otp: 'Mã OTP phải có đúng 6 chữ số' });
      return;
    }

    setErrors({});
    setAuthError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: trimmedOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Mã xác nhận không đúng hoặc đã hết hạn!');
      }

      const { token, user } = data.data;
      localStorage.setItem('aita_token', token);
      localStorage.setItem('aita_user', JSON.stringify(user));
      onLoginSuccess(user, token);
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Lỗi xác thực mã OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
        overflow: 'hidden',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Glow Orbs background */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '15%',
          width: '320px',
          height: '320px',
          backgroundColor: 'rgba(99, 102, 241, 0.22)',
          borderRadius: '50%',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '25%',
          right: '15%',
          width: '320px',
          height: '320px',
          backgroundColor: 'rgba(6, 182, 212, 0.18)',
          borderRadius: '50%',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(51, 65, 85, 0.75)',
          borderRadius: '24px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'all 0.2s',
          }}
        >
          ✕
        </button>

        {/* Header với icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '16px',
            background: step === 'CREDENTIALS' ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' : 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px auto', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
          }}>
            {step === 'CREDENTIALS' ? (
              <svg style={{ width: '26px', height: '26px', color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg style={{ width: '26px', height: '26px', color: '#ffffff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            {step === 'CREDENTIALS' ? 'Đăng nhập AITA' : 'Xác thực mã Gmail'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            {step === 'CREDENTIALS' ? 'Nhập tài khoản để nhận mã OTP qua Gmail' : `Mã OTP đã gửi đến: ${email}`}
          </p>
        </div>

        {/* ── QUICK LOGIN PANEL (chỉ hiện ở bước CREDENTIALS) ── */}
        {step === 'CREDENTIALS' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>⚡ ĐĂNG NHẬP NHANH (Demo)</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={quickLoading !== null}
                  onClick={() => handleQuickLogin(acc.email)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: quickLoading === acc.email ? `${acc.color}33` : `${acc.color}11`,
                    border: `1px solid ${acc.color}44`,
                    borderRadius: 12, cursor: quickLoading !== null ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all 0.18s',
                    opacity: quickLoading !== null && quickLoading !== acc.email ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{acc.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: acc.color }}>{acc.label}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{acc.email}</div>
                  </div>
                  {quickLoading === acc.email ? (
                    <span style={{ fontSize: 12, color: acc.color }}>Đang vào...</span>
                  ) : (
                    <span style={{ fontSize: 12, color: acc.color, fontWeight: 600 }}>Vào ngay →</span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 4 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>HOẶC ĐĂNG NHẬP BẰNG OTP</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>
        )}

        {/* Thông báo thông tin / thành công */}
        {successMsg && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✉️</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thông báo lỗi */}
        {authError && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
            }}
          >
            <svg style={{ width: '18px', height: '18px', color: '#fb7185', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        {/* BƯỚC 1: NHẬP EMAIL & MẬT KHẨU */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleRequestOtp} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Gmail / Email <span style={{ color: '#818cf8' }}>*</span>
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="vidu@gmail.com hoặc fpt.edu.vn"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${errors.email ? '#f43f5e' : 'rgba(51, 65, 85, 0.85)'}`,
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {errors.email && (
                <p style={{ fontSize: '12px', color: '#fb7185', margin: '4px 0 0 0' }}>
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>
                  Mật khẩu <span style={{ color: '#818cf8' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="Nhập mật khẩu..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${errors.password ? '#f43f5e' : 'rgba(51, 65, 85, 0.85)'}`,
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {errors.password && (
                <p style={{ fontSize: '12px', color: '#fb7185', margin: '4px 0 0 0' }}>
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s',
                marginTop: '8px',
              }}
            >
              {loading ? 'Đang gửi mã...' : 'Nhận mã xác nhận Gmail ➜'}
            </button>
          </form>
        )}

        {/* BƯỚC 2: NHẬP MÃ OTP GỬI VỀ GMAIL */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                MÃ XÁC NHẬN GỒM 6 CHỮ SỐ
              </label>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  if (errors.otp) setErrors((prev) => ({ ...prev, otp: undefined }));
                }}
                placeholder="• • • • • •"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${errors.otp ? '#f43f5e' : '#38bdf8'}`,
                  borderRadius: '12px',
                  color: '#38bdf8',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  letterSpacing: '10px',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {errors.otp && (
                <p style={{ fontSize: '12px', color: '#fb7185', textAlign: 'center', margin: '6px 0 0 0' }}>
                  {errors.otp}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <button
                type="button"
                onClick={() => {
                  setStep('CREDENTIALS');
                  setOtp('');
                  setAuthError(null);
                  setSuccessMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                ← Đổi email khác
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendOtp}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? '#64748b' : '#38bdf8',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại mã'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s',
                marginTop: '6px',
              }}
            >
              {loading ? 'Đang xác thực...' : 'Xác thực & Đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
