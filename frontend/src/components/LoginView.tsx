import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  Terminal,
  Mail,
  KeyRound,
  RotateCw,
  ArrowLeft,
  Sparkles,
  Info,
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

// Danh mục tài khoản mẫu hợp lệ trong hệ thống
const PRESET_ACCOUNTS = [
  {
    email: 'trungse170000@fpt.edu.vn',
    name: 'Đinh Thành Trung',
    studentCode: 'SE170000',
    role: 'STUDENT' as const,
    roleLabel: 'Sinh Viên FPT',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    badgeColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
  },
  {
    email: 'trungdt@fe.edu.vn',
    name: 'ThS. Đinh Thành Trung',
    studentCode: 'GV001',
    role: 'INSTRUCTOR' as const,
    roleLabel: 'Giảng Viên FE',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    badgeColor: '#818cf8',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
  },
  {
    email: 'admin@aita.fpt.edu.vn',
    name: 'Quản Trị Viên Hệ Thống',
    studentCode: 'AD001',
    role: 'ADMIN' as const,
    roleLabel: 'Admin Khảo Thí',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    badgeColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
  },
  {
    email: 'vthaitrung2k6@gmail.com',
    name: 'Vũ Thái Trung',
    studentCode: 'SE712137',
    role: 'STUDENT' as const,
    roleLabel: 'Gmail Cá Nhân',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    badgeColor: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  // Trạng thái: 'EMAIL' (bước 1: nhập email) hoặc 'OTP' (bước 2: nhập mã 6 số)
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [emailInput, setEmailInput] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Đếm ngược 60s cho nút gửi lại OTP
  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Tự động focus vào ô OTP đầu tiên khi chuyển sang bước OTP
  useEffect(() => {
    if (step === 'OTP' && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // BƯỚC 1: YÊU CẦU GỬI MÃ OTP VỀ EMAIL
  const handleRequestOtp = async (emailToSend: string) => {
    const trimmed = emailToSend.trim().toLowerCase();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!trimmed) {
      setErrorMsg('Vui lòng nhập địa chỉ Gmail hoặc FPT Email!');
      return;
    }

    // Kiểm tra định dạng cơ bản
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
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Backend từ chối: Email không tồn tại hoặc lỗi khác
        const message = data.message || 'Yêu cầu gửi mã OTP thất bại!';
        setErrorMsg(message);
        setLoading(false);
        return;
      }

      // Gửi mã OTP thành công
      setTargetEmail(trimmed);
      setStep('OTP');
      setOtpDigits(['', '', '', '', '', '']);
      setCountdown(60);
      if (data.data?.debugOtp) {
        setDebugOtp(data.data.debugOtp);
      } else {
        setDebugOtp(null);
      }
      setSuccessMsg(`Mã xác thực đã được gửi đến ${trimmed}.`);
    } catch (err: any) {
      setErrorMsg(
        'Không thể kết nối tới Backend API Gateway (Port 3000). Vui lòng kiểm tra dịch vụ đã được khởi động chưa!'
      );
    } finally {
      setLoading(false);
    }
  };

  // BƯỚC 2: XÁC THỰC MÃ OTP 6 CHỮ SỐ
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const fullOtp = codeToVerify || otpDigits.join('');
    setErrorMsg(null);

    if (fullOtp.length !== 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã xác thực OTP!');
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
        const message = json.message || 'Mã xác thực OTP không chính xác!';
        setErrorMsg(message);
        setLoading(false);
        return;
      }

      // Xác thực thành công
      const data = json.data;
      if (data && data.token && data.user) {
        localStorage.setItem('aita_token', data.token);
        localStorage.setItem('aita_user', JSON.stringify(data.user));
        setSuccessMsg('Xác thực OTP thành công! Đang chuyển hướng...');
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 300);
      } else {
        setErrorMsg('Phản hồi từ máy chủ không hợp lệ!');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg('Lỗi kết nối khi xác thực OTP với máy chủ!');
      setLoading(false);
    }
  };

  // Xử lý khi gõ vào ô OTP
  const handleOtpDigitChange = (index: number, value: string) => {
    // Chỉ chấp nhận chữ số
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

    // Tự động focus sang ô tiếp theo
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Nếu đã nhập đủ 6 số, tự động trigger xác thực
    const combined = newDigits.join('');
    if (combined.length === 6 && !newDigits.includes('')) {
      void handleVerifyOtp(combined);
    }
  };

  // Xử lý phím Backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Xử lý Paste cả chuỗi 6 số
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
          maxWidth: '520px',
          padding: '40px 36px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.18)',
          position: 'relative',
          overflow: 'hidden',
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
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Terminal size={32} />
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              marginBottom: '6px',
            }}
          >
            AITA-INTELLIGENT
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
            Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động
          </p>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '16px',
                backgroundColor: 'rgba(66, 133, 244, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(66, 133, 244, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={13} />
              Xác Thực Hai Bước OTP Qua Gmail & Google Workspace
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
              fontSize: '12.5px',
              marginBottom: '20px',
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
              fontSize: '12.5px',
              marginBottom: '20px',
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, color: '#10b981' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BƯỚC 1: NHẬP GMAIL / FPT EMAIL ĐỂ YÊU CẦU MÃ OTP */}
        {/* ========================================================================= */}
        {step === 'EMAIL' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Nhập Địa Chỉ Gmail / FPT Email
              </label>
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
                  placeholder="ví dụ: trungse170000@fpt.edu.vn hoặc user@gmail.com"
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Mail size={18} color="#94a3b8" />
                </div>
              </div>
            </div>

            {/* Nút gửi mã OTP */}
            <button
              onClick={() => handleRequestOtp(emailInput)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  Đang Kiểm Tra & Gửi Mã OTP...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Gửi Mã Xác Thực OTP Đến Gmail
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Phân cách */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '28px 0 18px 0',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
              <span style={{ padding: '0 12px' }}>Hoặc Chọn Tài Khoản Khảo Thí Mẫu</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
            </div>

            {/* Danh sách tài khoản mẫu hợp lệ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => {
                    setEmailInput(acc.email);
                    void handleRequestOtp(acc.email);
                  }}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#ffffff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{acc.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{acc.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '10px',
                        color: acc.badgeColor,
                        backgroundColor: acc.badgeBg,
                      }}
                    >
                      {acc.roleLabel}
                    </span>
                    <ChevronRight size={16} color="#64748b" />
                  </div>
                </button>
              ))}
            </div>

            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '22px',
                lineHeight: '1.5',
              }}
            >
              🔒 Hệ thống bảo mật 2FA: Email không tồn tại trong danh mục sinh viên/giảng viên sẽ bị từ chối truy cập.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BƯỚC 2: NHẬP MÃ XÁC THỰC OTP 6 SỐ */}
        {/* ========================================================================= */}
        {step === 'OTP' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(99, 102, 241, 0.18)',
                  color: '#818cf8',
                  marginBottom: '10px',
                }}
              >
                <KeyRound size={24} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
                Xác Thực Mã Bảo Mật OTP
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: 0 }}>
                Mã xác thực 6 chữ số đã được gửi đến hộp thư:
              </p>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>{targetEmail}</span>
                <button
                  onClick={() => {
                    setStep('EMAIL');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    textDecoration: 'underline',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  (Đổi email)
                </button>
              </div>
            </div>

            {/* Banner hiển thị Demo OTP nếu chưa cấu hình SMTP App Password */}
            {debugOtp && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  marginBottom: '20px',
                  fontSize: '12.5px',
                  color: '#bae6fd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                  <Sparkles size={15} color="#38bdf8" />
                  <span>Môi Trường Thử Nghiệm / Đánh Giá:</span>
                </div>
                <div>
                  Mã OTP của bạn là:{' '}
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#ffffff',
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      letterSpacing: '2px',
                    }}
                  >
                    {debugOtp}
                  </span>
                  <button
                    onClick={() => {
                      const digits = debugOtp.split('');
                      setOtpDigits(digits);
                      void handleVerifyOtp(debugOtp);
                    }}
                    style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(56, 189, 248, 0.5)',
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    Điền nhanh & Xác nhận
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  * Để nhận email thật về hộp thư Gmail cá nhân, cấu hình SMTP_USER và SMTP_PASS trong file .env.
                </div>
              </div>
            )}

            {/* 6 Ô NHẬP MÃ OTP ĐỘC LẬP */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '22px',
              }}
            >
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
                    width: '48px',
                    height: '56px',
                    borderRadius: '12px',
                    border: digit
                      ? '2px solid #6366f1'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    background: digit ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                    color: '#ffffff',
                    fontSize: '24px',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxShadow: digit ? '0 0 15px rgba(99, 102, 241, 0.35)' : 'none',
                    transition: 'all 0.15s ease-in-out',
                  }}
                />
              ))}
            </div>

            {/* Nút xác nhận OTP */}
            <button
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpDigits.join('').length !== 6}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background:
                  otpDigits.join('').length === 6
                    ? 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
                    : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                cursor:
                  loading || otpDigits.join('').length !== 6 ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow:
                  otpDigits.join('').length === 6
                    ? '0 8px 20px rgba(16, 185, 129, 0.35)'
                    : 'none',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  Đang Xác Thực OTP...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Xác Nhận & Đăng Nhập Hệ Thống
                </>
              )}
            </button>

            {/* Các tùy chọn dưới: Gửi lại mã / Đổi Email */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '18px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '12px',
              }}
            >
              <button
                onClick={() => {
                  setStep('EMAIL');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={14} />
                Quay lại đổi Email
              </button>

              {countdown > 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>
                  Gửi lại mã sau (00:{countdown < 10 ? `0${countdown}` : countdown})
                </span>
              ) : (
                <button
                  onClick={() => handleRequestOtp(targetEmail)}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Gửi lại mã OTP mới
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chân trang thông tin kỹ thuật */}
        <div
          style={{
            marginTop: '28px',
            textAlign: 'center',
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
          <span>Google SSO & OTP Gateway</span>
        </div>
      </div>
    </div>
  );
};

