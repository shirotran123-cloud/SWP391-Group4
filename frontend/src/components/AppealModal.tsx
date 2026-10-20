import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, Send, Scale, ShieldAlert, Award, Lock, Sparkles, FileText } from 'lucide-react';
import type { Appeal } from '../types';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId?: string;
  studentId: string;
  currentScore?: number;
  apiBaseUrl?: string;
  onAppealSuccess?: () => void;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  isOpen,
  onClose,
  submissionId = '',
  studentId,
  currentScore,
  apiBaseUrl = 'http://localhost:3000',
  onAppealSuccess,
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
        const data: Appeal[] = json.data || [];
        // Sắp xếp Lần 1 trước, Lần 2 sau theo thời gian tạo
        data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setAppeals(data);
      }
    } catch {
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const appealsCount = appeals.length;
  const maxAppeals = 2; // Quy tắc BR-05: Tối đa 2 lần cho MỖI bài nộp độc lập
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

      setSuccessMessage(`Đơn phúc khảo lần ${appealsCount + 1}/2 đã được gửi thành công! Giảng viên phụ trách sẽ xem xét trong vòng 48h.`);
      setReason('');
      void fetchAppeals(finalSubId);
      if (onAppealSuccess) {
        onAppealSuccess();
      }
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-ok-bg)', color: 'var(--state-ok)', fontSize: '12px', fontWeight: 700 }}>
            <CheckCircle size={14} /> ĐÃ CHẤP THUẬN
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-bad-bg)', color: 'var(--state-bad)', fontSize: '12px', fontWeight: 700 }}>
            <X size={14} /> ĐÃ TỪ CHỐI
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-info-bg)', color: 'var(--state-info)', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={14} /> ĐANG PHÚC TRA
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-warn-bg)', color: 'var(--state-warn)', fontSize: '12px', fontWeight: 700 }}>
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
        backgroundColor: 'rgba(11, 18, 32, 0.45)',
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
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#f7f9fc',
          border: '1px solid rgba(11, 18, 32, 0.08)',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-300)' }}>
              <Scale size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Đơn Khiếu Nại &amp; Phúc Khảo Điểm (UC-06)
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Quy chuẩn IEEE Std 830-1998 &amp; Quy tắc BR-05 (Tối đa 2 lần khiếu nại / mỗi bài nộp)
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.025)', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Mã bài nộp (Submission ID) *
              </label>
              {Boolean(submissionId) && (
                <span style={{ fontSize: '11px', color: 'var(--blue-300)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={11} /> Cố định theo bài
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="VD: SUB-1728... hoặc mã bài nộp"
              value={subIdInput}
              readOnly={Boolean(submissionId)}
              onChange={(e) => {
                setSubIdInput(e.target.value);
                setErrorMessage(null);
              }}
              onBlur={() => {
                if (subIdInput.trim()) void fetchAppeals(subIdInput.trim());
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                backgroundColor: submissionId ? 'rgba(11, 18, 32, 0.025)' : 'rgba(11, 18, 32, 0.04)',
                border: '1px solid rgba(37, 99, 235, 0.18)',
                color: 'var(--blue-300)',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: submissionId ? 'default' : 'text',
              }}
            />
          </div>
          <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.025)', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Điểm hiện tại</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--blue-300)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={18} /> {currentScore !== undefined ? `${currentScore.toFixed(1)} / 10.0` : 'Xem trong bài nộp'}
            </div>
          </div>
        </div>

        {/* BR-05 Policy Banner - Làm rõ quy tắc 2 lần/bài nộp độc lập */}
        <div style={{ padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.16)', marginBottom: '20px', fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-300)', fontSize: '14px' }}>
            <ShieldAlert size={18} /> Quy định phúc khảo điểm (Quy tắc BR-05):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div>
              • <strong>Hạn mức quy định:</strong> Tối đa <strong>2 lần khiếu nại cho RIÊNG bài nộp này</strong>.
              <span style={{ color: 'var(--blue-200)', fontStyle: 'italic', marginLeft: '4px' }}>
                (Mỗi bài tập / bài nộp đều có 2 lượt độc lập, KHÔNG giới hạn tổng toàn bộ khóa học).
              </span>
            </div>
            <div>
              • <strong>Thời hạn khiếu nại:</strong> Trong vòng <strong>48 giờ</strong> kể từ thời điểm công bố kết quả chấm.
            </div>
            <div>
              • <strong>Lượt sử dụng của bài này:</strong>{' '}
              <strong style={{ color: appealsCount >= maxAppeals ? 'var(--text-main)' : '#2563eb', fontSize: '14px' }}>
                {appealsCount}/{maxAppeals} lượt
              </strong>
              {appealsCount >= maxAppeals ? (
                <span style={{ color: 'var(--text-main)', marginLeft: '6px' }}>(Đã hết lượt phúc khảo cho bài nộp này)</span>
              ) : (
                <span style={{ color: 'var(--blue-200)', marginLeft: '6px' }}>(Còn lại {maxAppeals - appealsCount} lượt khiếu nại cho bài này)</span>
              )}
            </div>
          </div>
        </div>

        {/* Existing Appeals List */}
        {appeals.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scale size={16} color="#2563eb" /> Lịch sử phúc khảo của bài nộp này ({appeals.length}/{maxAppeals}):
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {appeals.map((app, idx) => (
                <div
                  key={app.appealId || idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(11, 18, 32, 0.03)',
                    border: '1px solid rgba(11, 18, 32, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue-200)', backgroundColor: 'rgba(59, 130, 246, 0.09)', padding: '2px 8px', borderRadius: '6px' }}>
                        Lần {idx + 1}/2
                      </span>
                      <code style={{ fontSize: '12px', color: '#33415a' }}>{app.appealId}</code>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        ({new Date(app.createdAt).toLocaleString('vi-VN')})
                      </span>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>

                  <p style={{ fontSize: '13px', color: '#33415a', margin: 0, lineHeight: 1.5, backgroundColor: 'rgba(11, 18, 32, 0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                    <strong style={{ color: '#4d5c76' }}>Lý do khiếu nại của bạn:</strong> &ldquo;{app.reason}&rdquo;
                  </p>

                  {app.status === 'ACCEPTED' && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.07)', border: '1px solid rgba(37, 99, 235, 0.12)', fontSize: '12px', color: 'var(--blue-200)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--blue-200)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={14} /> Phản hồi từ Giảng viên ({app.reviewerId || 'Giảng viên chấm'}):
                      </div>
                      <div>{app.resolutionNote || 'Đã đồng ý điều chỉnh điểm.'}</div>
                      {app.adjustedScore !== undefined && (
                        <div style={{ marginTop: '6px', fontWeight: 600, color: 'var(--blue-300)', fontSize: '13px' }}>
                          Điểm số chính thức sau phúc khảo: {app.adjustedScore} / 10.0
                          {app.resolvedAt && (
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '8px' }}>
                              (Duyệt ngày: {new Date(app.resolvedAt).toLocaleString('vi-VN')})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {app.status === 'REJECTED' && (
                    <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(11, 18, 32, 0.05)', border: '1px solid rgba(11, 18, 32, 0.09)', fontSize: '12px', color: 'var(--text-main)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                        ✕Phản hồi từ Giảng viên ({app.reviewerId || 'Giảng viên chấm'}):
                      </div>
                      <div>{app.resolutionNote || 'Không chấp thuận khiếu nại. Điểm số giữ nguyên.'}</div>
                      {app.resolvedAt && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Ngày phản hồi: {new Date(app.resolvedAt).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                  )}

                  {(app.status === 'PENDING' || app.status === 'IN_REVIEW') && (
                    <div style={{ fontSize: '12px', color: '#1e40af', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} /> Đang trong danh sách chờ Giảng viên xem xét và phúc tra.
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
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                Lý do khiếu nại (Lần {appealsCount + 1}/{maxAppeals} của bài nộp này):
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
                  backgroundColor: '#f7f9fc',
                  border: '1px solid rgba(11, 18, 32, 0.08)',
                  color: 'var(--text-main)',
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
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.1)', color: 'var(--text-main)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.14)', color: 'var(--blue-300)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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
                  ? 'var(--blue-600)'
                  : 'rgba(11, 18, 32, 0.05)',
                color: reason.trim().length >= 10 ? 'var(--on-blue)' : 'var(--text-main)',
                fontSize: '15px',
                fontWeight: 700,
                cursor: reason.trim().length >= 10 && !submitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: reason.trim().length >= 10 ? '0 10px 25px -5px rgba(59, 130, 246, 0.28)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={16} /> {submitting ? 'Đang gửi đơn...' : `Gửi Đơn Phúc Khảo (Lần ${appealsCount + 1}/${maxAppeals})`}
            </button>
          </form>
        ) : (
          <div style={{ padding: '18px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.1)', color: 'var(--text-main)', textAlign: 'center', fontSize: '14px' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>Đã đạt giới hạn phúc khảo của bài nộp này (2/2 lần)</div>
            <p style={{ fontSize: '13px', margin: '0 0 6px 0', color: 'var(--text-main)', lineHeight: 1.5 }}>
              Bài nộp này đã sử dụng đủ 2 lần phúc khảo theo quy tắc BR-05. Quyết định của Giảng viên là quyết định cuối cùng.
            </p>
            <p style={{ fontSize: '12px', margin: 0, color: '#33415a' }}>
              Lưu ý: Hạn mức này chỉ áp dụng riêng cho mã bài nộp này. Các bài tập khác của bạn vẫn có 2 lượt phúc khảo độc lập bình thường.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
