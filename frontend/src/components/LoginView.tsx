import React, { useState, useEffect } from 'react';
import {
  Code2,
  ShieldAlert,
  KeyRound,
  ChevronRight,
  PlusCircle,
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { UserProfile } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// ─── Tài khoản lưu trên thiết bị (localStorage) ──────────────────────────────
interface SavedAccount {
  email: string;
  name: string;
  avatarLetter: string;
  avatarColor: string;
  lastUsed: number;
}

const STORAGE_KEY = 'aita_saved_accounts';
const AVATAR_COLORS = [
  '#4285F4', '#34A853', '#7B2FBE', '#EA4335',
  '#FBBC05', '#1a73e8', '#e91e63', '#00bcd4',
];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function loadAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedAccount[];
      if (parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [
    {
      email: 'giangvien.edu@gmail.com',
      name: 'ThS. Giảng Viên AITA',
      avatarLetter: 'G',
      avatarColor: '#4285F4',
      lastUsed: Date.now(),
    },
  ];
}

function saveAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

// ─────────────────────────────────────────────────────────────────────────────
type Step = 'picker' | 'enter-email' | 'password' | 'otp';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [step, setStep]                   = useState<Step>('picker');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<SavedAccount | null>(null);

  // form states
  const [inputEmail,     setInputEmail]     = useState('');
  const [password,       setPassword]       = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [otpCode,        setOtpCode]        = useState('');
  const [debugOtp,       setDebugOtp]       = useState<string | null>(null); // auto-filled khi dev

  // UI states
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);
  const [successMsg,     setSuccessMsg]     = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setSavedAccounts(loadAccounts());
  }, []);

  const clearMessages = () => { setErrorMsg(null); setSuccessMsg(null); };

  // ── Cooldown đếm ngược gửi lại OTP ────────────────────────────────────────
  const startCooldown = () => {
    setResendCooldown(60);
    const iv = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Chọn tài khoản đã lưu ─────────────────────────────────────────────────
  const handleSelectSaved = (acc: SavedAccount) => {
    setActiveAccount(acc);
    setPassword(''); setOtpCode(''); setDebugOtp(null);
    clearMessages(); setStep('password');
  };

  // ── "Sử dụng tài khoản khác" ──────────────────────────────────────────────
  const handleUseOther = () => {
    setInputEmail(''); clearMessages(); setStep('enter-email');
  };

  // ── Xác nhận email nhập tay ───────────────────────────────────────────────
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMsg('Địa chỉ email không hợp lệ.'); return;
    }
    // Nếu đã có trong danh sách → chuyển thẳng sang bước password
    const existing = savedAccounts.find(a => a.email === email);
    if (existing) { handleSelectSaved(existing); return; }

    const newAcc: SavedAccount = {
      email,
      name: email.split('@')[0],
      avatarLetter: email[0].toUpperCase(),
      avatarColor: randomColor(),
      lastUsed: Date.now(),
    };
    setActiveAccount(newAcc);
    setPassword(''); setOtpCode(''); setDebugOtp(null);
    clearMessages(); setStep('password');
  };

  // ── Xác nhận mật khẩu → gọi API request-otp ──────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setErrorMsg('Vui lòng nhập mật khẩu.'); return; }
    clearMessages(); setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeAccount!.email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Xác thực thất bại. Vui lòng thử lại!');
      }

      // ── Bypass OTP: tài khoản đặc biệt — đăng nhập ngay không qua OTP ──
      if (data.data?.bypassOtp && data.data?.token && data.data?.user) {
        const { token, user } = data.data;
        localStorage.setItem('aita_token', token);
        localStorage.setItem('aita_user', JSON.stringify(user));

        const acc = activeAccount!;
        const updated = [
          { ...acc, name: user.fullName || acc.name, lastUsed: Date.now() },
          ...savedAccounts.filter(a => a.email !== acc.email),
        ];
        setSavedAccounts(updated); saveAccounts(updated);

        const profile: UserProfile = {
          userId:    user.userId,
          email:     user.email,
          fullName:  user.fullName,
          role:      user.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : user.role === 'ADMIN' ? 'ADMIN' : 'STUDENT',
          avatarUrl: user.avatarUrl,
          department: user.role === 'INSTRUCTOR' ? 'Giảng viên - ĐH FPT' : 'Sinh viên - ĐH FPT',
        };
        onLoginSuccess(profile);
        return;
      }

      // ── Luồng bình thưṑng: server gửi OTP ──
      if (data.data?.debugOtp) {
        setOtpCode(data.data.debugOtp);
        setDebugOtp(data.data.debugOtp);
        setSuccessMsg(`[Dev] OTP: ${data.data.debugOtp} (tự động điền)`);
      } else {
        setSuccessMsg(data.message || `Đã gửi OTP đến ${activeAccount!.email}`);
      }

      startCooldown();
      setStep('otp');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  // ── Gửi lại OTP ───────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    clearMessages(); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeAccount!.email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể gửi lại mã!');
      if (data.data?.debugOtp) {
        setOtpCode(data.data.debugOtp);
        setDebugOtp(data.data.debugOtp);
        setSuccessMsg(`[Dev] OTP mới: ${data.data.debugOtp}`);
      } else {
        setSuccessMsg(`Mã mới đã gửi đến ${activeAccount!.email}`);
      }
      startCooldown();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  // ── Xác nhận OTP → gọi API verify-otp ────────────────────────────────────
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) { setErrorMsg('Vui lòng nhập đủ 6 chữ số OTP.'); return; }
    clearMessages(); setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeAccount!.email, otp: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Mã OTP không đúng hoặc đã hết hạn!');

      const { token, user } = data.data;
      localStorage.setItem('aita_token', token);
      localStorage.setItem('aita_user', JSON.stringify(user));

      // Lưu tài khoản vào localStorage picker
      const acc = activeAccount!;
      const updated = [
        { ...acc, name: user.fullName || acc.name, lastUsed: Date.now() },
        ...savedAccounts.filter(a => a.email !== acc.email),
      ];
      setSavedAccounts(updated);
      saveAccounts(updated);

      // Map UserRecord → UserProfile
      const profile: UserProfile = {
        userId:     user.userId,
        email:      user.email,
        fullName:   user.fullName,
        role:       user.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : user.role === 'ADMIN' ? 'ADMIN' : 'STUDENT',
        avatarUrl:  user.avatarUrl,
        department: user.role === 'INSTRUCTOR' ? 'Giảng viên - ĐH FPT' : 'Sinh viên - ĐH FPT',
      };
      onLoginSuccess(profile);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi xác thực OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Quay lại ─────────────────────────────────────────────────────────────
  const goBack = () => {
    clearMessages(); setDebugOtp(null);
    if (step === 'otp')         { setStep('password'); return; }
    if (step === 'password')    {
      const fromPicker = savedAccounts.some(a => a.email === activeAccount?.email);
      setStep(fromPicker ? 'picker' : 'enter-email'); return;
    }
    setStep('picker');
  };

  // ── Xoá tài khoản ────────────────────────────────────────────────────────
  const handleRemoveAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.email !== email);
    setSavedAccounts(updated); saveAccounts(updated);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Shared UI helpers
  // ─────────────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: '480px', borderRadius: '28px',
    backgroundColor: '#1e1f24', border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 30px 60px -10px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
    overflow: 'hidden',
  };

  const GoogleLogo = () => (
    <svg width="26" height="26" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );

  const Avatar = ({ acc, size = 40 }: { acc: SavedAccount; size?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: acc.avatarColor, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
    }}>
      {acc.avatarLetter}
    </div>
  );

  const ErrorBox = () => errorMsg ? (
    <div style={{
      marginBottom: '14px', padding: '11px 14px', borderRadius: '10px',
      backgroundColor: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
      color: '#f87171', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '8px',
    }}>
      <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>{errorMsg}</span>
    </div>
  ) : null;

  const SuccessBox = () => successMsg ? (
    <div style={{
      marginBottom: '14px', padding: '10px 14px', borderRadius: '10px',
      backgroundColor: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.25)',
      color: '#81c995', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span>✉️</span><span>{successMsg}</span>
    </div>
  ) : null;

  const BackBtn = () => (
    <button onClick={goBack} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6',
      padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '50%',
    }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    ><ArrowLeft size={20} /></button>
  );

  const Footer = () => (
    <div style={{
      padding: '13px 32px', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5f6368',
    }}>
      <span>Tiếng Việt ▾</span>
      <div style={{ display: 'flex', gap: '14px' }}>
        {['Trợ giúp', 'Quyền riêng tư', 'Điều khoản'].map(t => (
          <span key={t} style={{ cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#8ab4f8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5f6368')}>{t}</span>
        ))}
      </div>
    </div>
  );

  const PrimaryBtn = ({ children, disabled, onClick, type = 'button' }: {
    children: React.ReactNode; disabled?: boolean;
    onClick?: () => void; type?: 'button' | 'submit';
  }) => (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      padding: '12px 28px', borderRadius: '24px', border: 'none',
      background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#1a73e8,#1557b0)',
      color: disabled ? '#5f6368' : '#fff', fontSize: '14px', fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 14px rgba(26,115,232,0.4)',
      transition: 'all 0.15s',
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >{children}</button>
  );

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%,#141828 0%,#0a0d17 70%)',
      padding: '24px', fontFamily: "'Inter','Google Sans',sans-serif",
    }}>

      {/* ══ STEP 1: ACCOUNT PICKER ══════════════════════════════════════════ */}
      {step === 'picker' && (
        <div style={cardStyle}>
          <div style={{ padding: '32px 32px 16px' }}>
            <div style={{ marginBottom: '14px' }}><GoogleLogo /></div>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#e8eaed', marginBottom: '4px' }}>
              Chọn tài khoản
            </h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6' }}>
              để tiếp tục đến <strong style={{ color: '#bdc1c6' }}>AITA Grading System</strong>
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {savedAccounts.length === 0 && (
              <div style={{ padding: '20px 32px', color: '#5f6368', fontSize: '13px', textAlign: 'center' }}>
                Chưa có tài khoản nào. Nhấn "Sử dụng tài khoản khác" để thêm.
              </div>
            )}

            {savedAccounts.map(acc => (
              <div key={acc.email} onClick={() => handleSelectSaved(acc)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '13px 32px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Avatar acc={acc} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#e8eaed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.email}
                  </div>
                </div>
                <button onClick={e => handleRemoveAccount(acc.email, e)}
                  title="Xoá khỏi danh sách"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#5f6368', fontSize: '16px', padding: '4px 6px',
                    borderRadius: '4px', flexShrink: 0, lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#5f6368')}
                >✕</button>
                <ChevronRight size={16} color="#5f6368" style={{ flexShrink: 0 }} />
              </div>
            ))}

            {/* Sử dụng tài khoản khác */}
            <div onClick={handleUseOther}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 32px', cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '1.5px solid #5f6368', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <PlusCircle size={18} color="#9aa0a6" />
              </div>
              <span style={{ fontSize: '14px', color: '#e8eaed' }}>Sử dụng một tài khoản khác</span>
            </div>
          </div>

          <Footer />
        </div>
      )}

      {/* ══ STEP 2: NHẬP EMAIL (tài khoản khác) ════════════════════════════ */}
      {step === 'enter-email' && (
        <div style={cardStyle}>
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <BackBtn /><GoogleLogo />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#e8eaed', marginBottom: '6px' }}>Đăng nhập</h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6', marginBottom: '24px' }}>
              Tiếp tục đến <strong style={{ color: '#bdc1c6' }}>AITA Grading System</strong>
            </p>

            <ErrorBox />

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bdc1c6', marginBottom: '8px' }}>
                  Địa chỉ Email
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#5f6368' }}>
                    <Mail size={16} />
                  </div>
                  <input type="email" autoFocus
                    placeholder="vidu@gmail.com, @fpt.edu.vn, @fe.edu.vn"
                    value={inputEmail}
                    onChange={e => { setInputEmail(e.target.value); clearMessages(); }}
                    style={{
                      width: '100%', padding: '13px 14px 13px 42px', borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e8eaed', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(26,115,232,0.7)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PrimaryBtn type="submit">Tiếp theo</PrimaryBtn>
              </div>
            </form>
          </div>
          <Footer />
        </div>
      )}

      {/* ══ STEP 3: NHẬP MẬT KHẨU ══════════════════════════════════════════ */}
      {step === 'password' && activeAccount && (
        <div style={cardStyle}>
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <BackBtn /><GoogleLogo />
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#e8eaed', marginBottom: '6px' }}>Xin chào</h1>

            {/* Account chip */}
            <div onClick={goBack} title="Đổi tài khoản" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '5px 10px 5px 6px', borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              marginBottom: '22px', cursor: 'pointer',
            }}>
              <Avatar acc={activeAccount} size={22} />
              <span style={{ fontSize: '13px', color: '#bdc1c6' }}>{activeAccount.email}</span>
              <span style={{ fontSize: '11px', color: '#5f6368' }}>▾</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Avatar acc={activeAccount} size={72} />
            </div>
            <p style={{ textAlign: 'center', fontSize: '16px', color: '#e8eaed', fontWeight: 600, marginBottom: '22px' }}>
              {activeAccount.name}
            </p>

            <ErrorBox />

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bdc1c6', marginBottom: '8px' }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} autoFocus
                    placeholder="Nhập mật khẩu tài khoản Google"
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearMessages(); }}
                    style={{
                      width: '100%', padding: '13px 44px 13px 14px', borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e8eaed', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(26,115,232,0.7)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', padding: 0,
                  }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#5f6368', marginTop: '7px' }}>
                  Nếu là lần đầu đăng nhập, mật khẩu này sẽ được đặt cho tài khoản.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#8ab4f8', cursor: 'pointer' }}>Quên mật khẩu?</span>
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading ? 'Đang gửi OTP…' : 'Tiếp theo'}
                </PrimaryBtn>
              </div>
            </form>
          </div>
          <Footer />
        </div>
      )}

      {/* ══ STEP 4: NHẬP OTP ════════════════════════════════════════════════ */}
      {step === 'otp' && activeAccount && (
        <div style={cardStyle}>
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <BackBtn /><GoogleLogo />
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 400, color: '#e8eaed', marginBottom: '4px' }}>Xác minh 2 bước</h1>
            <p style={{ fontSize: '13px', color: '#9aa0a6' }}>Mã OTP đã gửi tới</p>
            <p style={{ fontSize: '13px', color: '#8ab4f8', fontWeight: 600, marginBottom: '20px' }}>
              {activeAccount.email}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Avatar acc={activeAccount} size={56} />
            </div>

            <SuccessBox />
            <ErrorBox />

            {/* Dev hint */}
            {debugOtp && (
              <div style={{
                marginBottom: '14px', padding: '9px 14px', borderRadius: '8px',
                backgroundColor: 'rgba(251,188,5,0.1)', border: '1px solid rgba(251,188,5,0.25)',
                color: '#fdd663', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>🔧 Dev mode — OTP đã tự điền:&nbsp;<strong style={{ letterSpacing: '3px' }}>{debugOtp}</strong></span>
              </div>
            )}

            <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#bdc1c6', marginBottom: '8px' }}>
                  Mã OTP 6 chữ số
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#5f6368' }}>
                    <KeyRound size={16} />
                  </div>
                  <input type="text" inputMode="numeric" maxLength={6}
                    autoFocus={!debugOtp}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); clearMessages(); }}
                    style={{
                      width: '100%', padding: '14px 14px 14px 42px', borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e8eaed', fontSize: '24px', letterSpacing: '10px', fontWeight: 700,
                      outline: 'none', textAlign: 'center', boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(26,115,232,0.7)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  style={{
                    background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    color: resendCooldown > 0 ? '#5f6368' : '#8ab4f8', fontSize: '13px', padding: 0,
                  }}>
                  {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại mã'}
                </button>
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading ? 'Đang xác thực…' : 'Xác nhận'}
                </PrimaryBtn>
              </div>
            </form>
          </div>
          <Footer />
        </div>
      )}

      {/* Brand */}
      <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.3 }}>
        <Code2 size={13} color="#e5e7eb" />
        <span style={{ fontSize: '11px', color: '#9aa0a6' }}>
          AITA Intelligent Grading System · FPT University
        </span>
      </div>
    </div>
  );
};
