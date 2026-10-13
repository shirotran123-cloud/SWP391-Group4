import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, Send, Scale, ShieldAlert, Award } from 'lucide-react';
import type { Appeal } from '../types';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId?: string;
  studentId: string;
  currentScore?: number;
  apiBaseUrl?: string;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  isOpen,
  onClose,
  submissionId = '',
  studentId,
  currentScore,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [subIdInput, setSubIdInput] = useState(submissionId);
  const [reason, setReason] = useState('');
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (submissionId) {
        setSubIdInput(submissionId);
        void fetchAppeals(submissionId);
      } else if (subIdInput) {
        void fetchAppeals(subIdInput);
      }
    }
  }, [isOpen, submissionId]);

  const fetchAppeals = async (targetId?: string) => {
    const sid = (targetId ?? subIdInput).trim();
    if (!sid) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals?submissionId=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const json = await res.json();
        setAppeals(json.data || []);
      }
    } catch {
      // Fallback local sample nếu server chưa bật
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const appealsCount = appeals.length;
  const maxAppeals = 2; // Quy tắc BR-05
  const canSubmit = appealsCount < maxAppeals;

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubId = subIdInput.trim();
    if (!finalSubId) {
      setErrorMessage('Vui lòng nhập mã bài nộp (Submission ID) cần phúc khảo.');
      return;
    }
    if (reason.trim().length < 10) {
      setErrorMessage('Vui lòng nhập lý do khiếu nại cụ thể (tối thiểu 10 ký tự)');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: finalSubId,
          studentId: studentId || 'SE170000',
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gửi đơn khiếu nại thất bại');
      }

      setSuccessMessage('Đơn phúc khảo đã được gửi thành công! Giảng viên sẽ xem xét trong vòng 48h.');
      setReason('');
      void fetchAppeals(finalSubId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối tới máy chủ API Gateway');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Appeal['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
            <CheckCircle size={14} /> ĐÃ CHẤP THUẬN
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontSize: '12px', fontWeight: 700 }}>
            <X size={14} /> ĐÃ TỪ CHỐI
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={14} /> ĐANG PHÚC TRA
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={14} /> CHỜ GIẢNG VIÊN DUYỆT
          </span>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Scale size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Đơn Khiếu Nại & Phúc Khảo Điểm (UC-06)
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Quy chuẩn IEEE Std 830-1998 & Quy tắc phúc khảo BR-05
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Mã bài nộp (Submission ID) *
            </label>
            <input
              type="text"
              placeholder="VD: SUB-1728... hoặc mã bài nộp"
              value={subIdInput}
              onChange={(e) => {
                setSubIdInput(e.target.value);
                setErrorMessage(null);
              }}
              onBlur={() => {
                if (subIdInput.trim()) void fetchAppeals(subIdInput.trim());
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                color: '#818cf8',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Điểm hiện tại</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={18} /> {currentScore !== undefined ? `${currentScore} / 10.0` : 'Xem trong bài nộp'}
            </div>
          </div>
        </div>

        {/* BR-05 Policy Banner */}
        <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '20px', fontSize: '13px', color: '#c7d2fe', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8' }}>
            <ShieldAlert size={16} /> Quy định phúc khảo (Quy tắc BR-05):
          </div>
          <div>• Thời hạn khiếu nại: Trong vòng <strong>48 giờ</strong> sau khi công bố kết quả.</div>
          <div>• Hạn mức tối đa: <strong>{maxAppeals} lần/bài nộp</strong>. Hiện tại bạn đã sử dụng: <strong>{appealsCount}/{maxAppeals} lượt</strong>.</div>
        </div>

        {/* Existing Appeals List */}
        {appeals.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
              Lịch sử các lần phúc khảo ({appeals.length}):
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {appeals.map((app, idx) => (
                <div
                  key={app.appealId || idx}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                      Lần {idx + 1}: {app.appealId}
                    </span>
                    {getStatusBadge(app.status)}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
                    <strong>Lý do sinh viên:</strong> {app.reason}
                  </p>
                  {app.resolutionNote && (
                    <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '12px', color: '#a5b4fc' }}>
                      <strong>Phản hồi của Giảng viên ({app.reviewerId || 'GV'}):</strong> {app.resolutionNote}
                      {app.adjustedScore !== undefined && (
                        <div style={{ marginTop: '4px', fontWeight: 700, color: '#10b981' }}>
                          🎯 Điểm điều chỉnh: {app.adjustedScore}/10.0
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Appeal Form */}
        {canSubmit ? (
          <form onSubmit={handleSubmitAppeal}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                Lý do khiếu nại (Lần {appealsCount + 1}/{maxAppeals}):
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Trình bày chi tiết lý do bạn cho rằng điểm số chưa chính xác (Ví dụ: testcase biên, vi phạm SRP, hoặc giải thuật tối ưu)..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', textAlign: 'right' }}>
                {reason.length}/1000 ký tự (tối thiểu 10)
              </div>
            </div>

            {errorMessage && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <CheckCircle size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || reason.trim().length < 10}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: reason.trim().length >= 10
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: reason.trim().length >= 10 && !submitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: reason.trim().length >= 10 ? '0 10px 25px -5px rgba(99, 102, 241, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={16} /> {submitting ? 'Đang gửi đơn...' : 'Gửi Đơn Phúc Khảo'}
            </button>
          </form>
        ) : (
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', textAlign: 'center', fontSize: '14px' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Đã đạt giới hạn khiếu nại (2/2 lần)</div>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Bài nộp này đã sử dụng đủ 2 lần phúc khảo theo quy định BR-05. Quyết định của Giảng viên là quyết định cuối cùng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
