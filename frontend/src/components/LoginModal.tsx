import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  Mail,
  RotateCw,
  CheckCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
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

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean>(true);
  const [countdown, setCountdown] = useState(60);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    if (step === 'OTP' && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  if (!isOpen) return null;

  const handleRequestOtp = async (emailToSend: string, passwordToSend?: string) => {
    const trimmed = emailToSend.trim().toLowerCase();
    const password = (passwordToSend ?? passwordInput).trim();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!trimmed) {
      setErrorMsg('Vui lòng nhập địa chỉ Gmail hoặc FPT Email!');
      return;
    }

    // Backend bắt buộc mật khẩu: /api/v1/auth/request-otp trả 401 nếu thiếu.
    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu để tiếp tục.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg('Địa chỉ email không đúng định dạng!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || 'Yêu cầu gửi mã OTP thất bại!');
        setLoading(false);
        return;
      }

      // Tài khoản GV đặc biệt: backend bỏ qua OTP và trả token trực tiếp.
      if (data.data?.bypassOtp && data.data?.token && data.data?.user) {
        localStorage.setItem('aita_token', data.data.token);
        localStorage.setItem('aita_user', JSON.stringify(data.data.user));
        setSuccessMsg('Đăng nhập thành công!');
        setTimeout(() => {
          onLoginSuccess(data.data.user, data.data.token);
          onClose();
        }, 250);
        return;
      }

      setTargetEmail(trimmed);
      setStep('OTP');
      setOtpDigits(['', '', '', '', '', '']);
      setCountdown(60);
      // Khi chưa cấu hình SMTP, backend chạy chế độ MOCK và trả mã qua debugOtp.
      setDebugOtp(data.data?.debugOtp || null);
      setSmtpConfigured(Boolean(data.data?.debugOtp));
      setSuccessMsg(
        data.data?.debugOtp
          ? 'Máy chủ chưa cấu hình SMTP nên mã OTP được hiển thị ngay bên dưới (chế độ MOCK).'
          : `Mã xác thực OTP đã được gửi đến ${trimmed}.`
      );
    } catch {
      setErrorMsg('Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const fullOtp = codeToVerify || otpDigits.join('');
    setErrorMsg(null);

    if (fullOtp.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã xác thực!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: fullOtp,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.message || 'Mã xác thực OTP không chính xác!');
        setLoading(false);
        return;
      }

      const data = json.data;
      if (data && data.token && data.user) {
        localStorage.setItem('aita_token', data.token);
        localStorage.setItem('aita_user', JSON.stringify(data.user));
        setSuccessMsg('Xác thực thành công!');
        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
          onClose();
        }, 250);
      } else {
        setErrorMsg('Phản hồi từ máy chủ không hợp lệ!');
        setLoading(false);
      }
    } catch {
      setErrorMsg('Lỗi kết nối khi xác thực OTP!');
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    const digit = cleanVal.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    const combined = newDigits.join('');
    if (combined.length === 6 && !newDigits.includes('')) {
      void handleVerifyOtp(combined);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (pasted.length >= 6) {
      const sixDigits = pasted.slice(0, 6).split('');
      setOtpDigits(sixDigits);
      otpInputRefs.current[5]?.focus();
      void handleVerifyOtp(sixDigits.join(''));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '32px 28px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          position: 'relative',
        }}
      >
        <button
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
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '16px',
              backgroundColor: 'rgba(66, 133, 244, 0.15)',
              color: '#60a5fa',
              marginBottom: '10px',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
            Xác Thực OTP Google SSO
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: 0 }}>
            {step === 'EMAIL'
              ? 'Nhập Gmail / FPT Email để nhận mã OTP xác thực'
              : `Mã OTP đã gửi tới ${targetEmail}`}
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#6ee7b7',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            <CheckCircle size={15} style={{ flexShrink: 0, color: '#10b981' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {step === 'EMAIL' ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRequestOtp(emailInput);
                    }
                  }}
                  placeholder="Nhập email (@fpt.edu.vn, @fe.edu.vn, @gmail.com)..."
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <Mail size={16} color="#94a3b8" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRequestOtp(emailInput);
                    }
                  }}
                  placeholder="Mật khẩu (bắt buộc theo chính sách xác thực)..."
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <ShieldCheck size={16} color="#94a3b8" />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                Lần đăng nhập đầu tiên: mật khẩu bạn nhập sẽ được đặt làm mật khẩu tài khoản.
                Các lần sau phải nhập đúng mật khẩu đó.
              </div>
            </div>

            <button
              onClick={() => handleRequestOtp(emailInput)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <RotateCw size={16} className="animate-spin" />
                  Đang Gửi OTP...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Gửi Mã Xác Thực OTP Đến Gmail
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* The hard-coded "quick sample accounts" list was removed: it advertised
                accounts that may not exist in the database and let anyone log in with a
                shared default password. Users now type their own credentials. */}
          </div>
        ) : (
          <div>
            {debugOtp ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#bae6fd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Sparkles size={14} color="#38bdf8" />
                  <span>Mã OTP (chế độ MOCK do chưa cấu hình SMTP): <strong style={{ color: '#fff', fontSize: '15px', letterSpacing: '2px' }}>{debugOtp}</strong></span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(148, 163, 184, 0.10)',
                  border: '1px solid rgba(148, 163, 184, 0.30)',
                  marginBottom: '16px',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                Mã OTP đã được gửi tới email. Nếu chưa nhận được, hãy kiểm tra hộp thư spam,
                hoặc xem mã trong terminal của API Gateway.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '18px' }}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpInputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  style={{
                    width: '42px',
                    height: '50px',
                    borderRadius: '10px',
                    border: digit ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.2)',
                    background: digit ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                    color: '#ffffff',
                    fontSize: '22px',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpDigits.join('').length !== 6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background:
                  otpDigits.join('').length === 6
                    ? 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
                    : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: loading || otpDigits.join('').length !== 6 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Đang Xác Thực...' : 'Xác Nhận & Đăng Nhập'}
            </button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '14px',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}
            >
              <button
                onClick={() => setStep('EMAIL')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={13} /> Đổi email
              </button>
              {countdown > 0 ? (
                <span>Gửi lại sau ({countdown}s)</span>
              ) : (
                <button
                  onClick={() => handleRequestOtp(targetEmail)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Gửi lại mã
                </button>              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

