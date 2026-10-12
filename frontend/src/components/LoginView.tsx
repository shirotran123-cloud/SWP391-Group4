import React, { useState } from 'react';
import {
  GraduationCap,
  UserCheck,
  Mail,
  Lock,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Code2,
} from 'lucide-react';
import type { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [authMethod, setAuthMethod] = useState<'quick' | 'email' | 'otp'>('quick');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Giảng viên mẫu
  const mockLecturer: UserProfile = {
    userId: 'GV001',
    email: 'trungdt@fe.edu.vn',
    fullName: 'ThS. Đinh Thành Trung',
    role: 'INSTRUCTOR',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    department: 'Kỹ Thuật Phần Mềm - Đại Học FPT',
  };

  // Sinh viên mẫu
  const mockStudent: UserProfile = {
    userId: 'SE170000',
    email: 'trungse170000@fpt.edu.vn',
    fullName: 'Đinh Thành Trung',
    role: 'STUDENT',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    department: 'Khoa CNTT - Kỹ Thuật Phần Mềm',
  };

  const handleQuickLogin = (role: 'INSTRUCTOR' | 'STUDENT') => {
    setLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      setLoading(false);
      if (role === 'INSTRUCTOR') {
        onLoginSuccess(mockLecturer);
      } else {
        onLoginSuccess(mockStudent);
      }
    }, 400);
  };

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email) {
      setErrorMsg('Vui lòng nhập địa chỉ Email trường (@fpt.edu.vn hoặc @fe.edu.vn)');
      return;
    }

    const isFptDomain = email.endsWith('@fpt.edu.vn') || email.endsWith('@fe.edu.vn');
    if (!isFptDomain) {
      setErrorMsg('Lỗi tên miền: Chỉ chấp nhận tài khoản sinh viên (@fpt.edu.vn) hoặc cán bộ giảng viên (@fe.edu.vn)!');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const isLecturer = email.includes('@fe.edu.vn') || email.toLowerCase().startsWith('gv');
      const user: UserProfile = {
        userId: isLecturer ? 'GV001' : 'SE170000',
        email,
        fullName: isLecturer ? 'ThS. Đinh Thành Trung (Giảng viên)' : 'Đinh Thành Trung (Sinh viên)',
        role: isLecturer ? 'INSTRUCTOR' : 'STUDENT',
        avatarUrl: isLecturer ? mockLecturer.avatarUrl : mockStudent.avatarUrl,
        department: isLecturer ? 'Kỹ Thuật Phần Mềm - FE' : 'Khoa CNTT - FPT University',
      };
      onLoginSuccess(user);
    }, 500);
  };

  const handleSendOtp = () => {
    if (!email || (!email.endsWith('@fpt.edu.vn') && !email.endsWith('@fe.edu.vn'))) {
      setErrorMsg('Vui lòng nhập Email FPT hợp lệ trước khi nhận mã OTP');
      return;
    }
    setErrorMsg(null);
    setOtpSent(true);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã OTP đã gửi qua Gmail');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const isLecturer = email.includes('@fe.edu.vn');
      const user: UserProfile = {
        userId: isLecturer ? 'GV001' : 'SE170000',
        email,
        fullName: isLecturer ? 'ThS. Đinh Thành Trung (Giảng viên)' : 'Đinh Thành Trung (Sinh viên)',
        role: isLecturer ? 'INSTRUCTOR' : 'STUDENT',
        avatarUrl: isLecturer ? mockLecturer.avatarUrl : mockStudent.avatarUrl,
        department: isLecturer ? 'Bộ môn SWP391 - ĐH FPT' : 'Khoa CNTT - ĐH FPT',
      };
      onLoginSuccess(user);
    }, 500);
  };

  const handleGoogleSso = () => {
    setLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      setLoading(false);
      // Mặc định SSO cho Giảng viên trong phiên demo
      onLoginSuccess(mockLecturer);
    }, 600);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0a0f1d 70%)',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '36px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.2)',
        }}
      >
        {/* Logo và Tiêu đề */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 10px 20px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Code2 size={34} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
            Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Nền tảng Tự động Hóa Chấm bài, Kiểm định Đạo văn AST & Phân tích Clean Code / SOLID
          </p>
          <div style={{ marginTop: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: 600,
              }}
            >
              🔒 Yêu cầu bắt buộc xác thực tài khoản để truy cập
            </span>
          </div>
        </div>

        {/* Lựa chọn phương thức đăng nhập */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMethod('quick');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: authMethod === 'quick' ? 'var(--accent-primary)' : 'transparent',
              color: authMethod === 'quick' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ⚡ Đăng Nhập 1-Chạm (Bảo Vệ)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('email');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: authMethod === 'email' ? 'var(--accent-primary)' : 'transparent',
              color: authMethod === 'email' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            📧 Email / Mật Khẩu
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('otp');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: authMethod === 'otp' ? 'var(--accent-primary)' : 'transparent',
              color: authMethod === 'otp' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            🔑 Gmail OTP
          </button>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#f43f5e',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldAlert size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* NỘI DUNG 1: ĐĂNG NHẬP 1-CHẠM DEMO */}
        {authMethod === 'quick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Dành riêng cho Hội đồng chấm thi & Giảng viên kiểm tra nhanh toàn bộ tính năng phân quyền:
            </p>

            {/* Thẻ Giảng Viên */}
            <div
              onClick={() => !loading && handleQuickLogin('INSTRUCTOR')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px',
                borderRadius: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1.5px solid rgba(99, 102, 241, 0.4)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.22)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <GraduationCap size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                      Đăng Nhập Với Vai Trò Giảng Viên
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.3)',
                        color: '#c7d2fe',
                        fontWeight: 700,
                      }}
                    >
                      GV001
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ThS. Đinh Thành Trung • trungdt@fe.edu.vn
                  </p>
                  <p style={{ fontSize: '11px', color: '#06b6d4', marginTop: '3px' }}>
                    ✦ Quản lý lớp, tạo đề thi AI, import Excel ACID, duyệt đạo văn
                  </p>
                </div>
              </div>
              <ArrowRight size={20} color="#818cf8" />
            </div>

            {/* Thẻ Sinh Viên */}
            <div
              onClick={() => !loading && handleQuickLogin('STUDENT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.18)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                  }}
                >
                  <UserCheck size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                      Đăng Nhập Với Vai Trò Sinh Viên
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.25)',
                        color: '#a7f3d0',
                        fontWeight: 700,
                      }}
                    >
                      SE170000
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Đinh Thành Trung • trungse170000@fpt.edu.vn
                  </p>
                  <p style={{ fontSize: '11px', color: '#10b981', marginTop: '3px' }}>
                    ✦ Nộp file .zip mã nguồn, kiểm tra SHA-256, xem điểm Real-Time
                  </p>
                </div>
              </div>
              <ArrowRight size={20} color="#34d399" />
            </div>
          </div>
        )}

        {/* NỘI DUNG 2: ĐĂNG NHẬP EMAIL / MẬT KHẨU */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailPasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' }}>
                Email Học Đường FPT / FE
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="ví dụ: giangvien@fe.edu.vn hoặc sinhvien@fpt.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' }}>
                Mật Khẩu Hệ Thống
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.5)',
              }}
            >
              {loading ? 'Đang xác thực thông tin...' : 'Đăng Nhập Vào Hệ Thống'}
            </button>
          </form>
        )}

        {/* NỘI DUNG 3: GMAIL OTP */}
        {authMethod === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' }}>
                Địa chỉ Gmail Nhận Mã OTP
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="Địa chỉ email @fpt.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--accent-primary)',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#c7d2fe',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {otpSent ? 'Gửi lại mã' : 'Gửi mã OTP'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' }}>
                  Mã Xác Thực OTP 6 Chữ Số
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <KeyRound size={18} />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Nhập 6 số mã OTP đã gửi đến hộp thư"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '16px',
                      letterSpacing: '4px',
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !otpSent}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: otpSent
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: otpSent && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'Đang kiểm tra mã OTP...' : 'Xác Thực & Đăng Nhập'}
            </button>
          </form>
        )}

        {/* Nút Đăng nhập Google SSO */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={handleGoogleSso}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
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
            Đăng Nhập Bằng Google Workspace FPT (@fpt.edu.vn / @fe.edu.vn)
          </button>
        </div>

        {/* Chân trang bảo mật */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
            Hệ thống tuân thủ Quy chuẩn Liêm chính Học thuật ĐH FPT (QĐ số 412/QĐ-ĐHFPT).
            <br />
            Mã nguồn bài nộp sẽ được lưu trữ và kiểm định đối sánh chéo với kho mã nguồn nội bộ.
          </p>
        </div>
      </div>
    </div>
  );
};
