import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle, Sparkles, Award, Scale } from 'lucide-react';
import type { GradingStep, AIRating, PlagiarismMatch, ScoreBreakdown } from '../types';
import { SolidRadarChart } from './SolidRadarChart';
import { MonacoDiffViewer } from './MonacoDiffViewer';
import { AppealModal } from './AppealModal';

interface LiveGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
  studentName: string;
  steps: GradingStep[];
  isCompleted: boolean;
  aiRating?: AIRating;
  plagiarismMatch?: PlagiarismMatch;
  sourceCode: string;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  maxScore?: number;
  executionTimeMs?: number;
}

export const LiveGradingModal: React.FC<LiveGradingModalProps> = ({
  isOpen,
  onClose,
  submissionId,
  studentName,
  steps,
  isCompleted,
  aiRating,
  plagiarismMatch,
  sourceCode,
  score,
  scoreBreakdown,
  maxScore = 10,
  executionTimeMs,
}) => {
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCompleted && !isAppealModalOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isCompleted, isAppealModalOpen, onClose]);

  if (!isOpen) return null;

  const completedCount = steps.filter((s) => s.status === 'passed' || s.status === 'failed').length;
  // `steps` can legitimately be empty (before the first grading event arrives), and `0 / 0 * 100`
  // is NaN, which used to render the literal text "NaN%" in the progress label and set the bar
  // width to `NaN%`. Guard the denominator.
  const progressPercent = steps.length === 0 ? 0 : Math.round((completedCount / steps.length) * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                ID: #{submissionId.substring(0, 8)}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sinh viên: <strong>{studentName}</strong></span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              {isCompleted ? '🎉 Kết Quả Đánh Giá Mã Nguồn & Nhận Xét AI' : '⚡ Đang Chấm Bài Tự Động (Cập Nhật Thời Gian Thực)'}
            </h2>
            {isCompleted && score !== undefined && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', padding: '4px 12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 800, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                    🎯 Tổng Điểm: {score} / {maxScore}
                  </span>
                  {executionTimeMs !== undefined && (
                    <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      Thời gian: {executionTimeMs}ms
                    </span>
                  )}
                </div>

                {/* Thanh Barem Chuẩn Hóa Học Thuật AITA */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    🧪 TC1: {(scoreBreakdown?.testcase1 ?? 0).toFixed(1)} / 4.0đ
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    🧪 TC2: {(scoreBreakdown?.testcase2 ?? 0).toFixed(1)} / 3.0đ
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ✨ Mã Nguồn Sạch: {(scoreBreakdown?.cleanCode ?? 0).toFixed(1)} / 2.0đ
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    📐 SOLID: {(scoreBreakdown?.solid ?? 0).toFixed(1)} / 1.0đ
                  </span>
                </div>
              </div>
            )}
          </div>

          {isCompleted && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsAppealModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Scale size={16} /> Khiếu Nại Điểm
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Hoàn thành & Đóng (Esc)
              </button>
            </div>
          )}
        </div>


        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            <span>Tiến trình đánh giá</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: isCompleted ? 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)' : 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {steps.map((step) => {
            const isPassed = step.status === 'passed';
            const isFailed = step.status === 'failed';
            const isInProgress = step.status === 'in_progress';

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: isInProgress
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isInProgress
                    ? '1px solid rgba(99, 102, 241, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {isPassed && <CheckCircle2 size={20} color="var(--accent-emerald)" />}
                  {isFailed && <XCircle size={20} color="var(--accent-rose)" />}
                  {isInProgress && <Loader2 size={20} color="var(--accent-primary)" className="animate-spin" />}
                  {step.status === 'pending' && <Clock size={20} color="var(--text-dim)" />}

                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: isInProgress ? '#ffffff' : 'var(--text-main)' }}>
                      {step.label}
                    </h4>
                    {step.detail && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  {isPassed && <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>ĐẠT</span>}
                  {isFailed && <span style={{ fontSize: '12px', color: 'var(--accent-rose)', fontWeight: 600 }}>KHÔNG ĐẠT</span>}
                  {isInProgress && <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>ĐANG XỬ LÝ...</span>}
                </div>
              </div>
            );
          })}
        </div>

        {isCompleted && aiRating && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', alignSelf: 'flex-start' }}>
                <Award size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Đánh Giá 5 Trục SOLID (Trợ Lý AI)</h3>
              </div>
              <SolidRadarChart rating={aiRating} />
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Nhận Xét & Đánh Giá Từ Trợ Lý AI</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '16px', flexGrow: 1 }}>
                "{aiRating.explanation}"
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Cảnh báo Mùi Mã Nguồn ({aiRating.codeSmells.length}):</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {aiRating.codeSmells.map((smell, index) => (
                  <div key={index} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '12px', display: 'flex', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600 }}>Dòng {smell.line || 15}:</span>
                    <span style={{ color: '#d1d5db' }}>
                      {/* `rule` is the short name of the violation (e.g. "Single Responsibility
                          Principle"). It was accepted by the AIRating type and returned by the
                          API but never rendered, so the card showed only the prose explanation
                          and the student could not tell which principle was broken. */}
                      {smell.rule && (
                        <strong style={{ color: '#fbbf24' }}>{smell.rule}: </strong>
                      )}
                      {smell.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isCompleted && aiRating && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Sparkles size={20} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                💡 Gợi Ý Sư Phạm AI (Định Hướng Kiến Trúc & SOLID)
              </h4>
              <p style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.5', margin: 0 }}>
                {aiRating.codeSmells && aiRating.codeSmells.length > 0 ? (
                  <span>
                    <strong>Phát hiện vi phạm: </strong>
                    {aiRating.codeSmells[0].description} (tại dòng {aiRating.codeSmells[0].line}). Hãy thử viết lại các phương thức để tuân thủ <strong>nguyên lý Đơn Trách Nhiệm (SRP)</strong>.
                  </span>
                ) : (
                  <span>
                    ✨ <strong>Đánh giá kiến trúc xuất sắc:</strong> Mã nguồn không phát hiện mùi mã nguồn nào, phân tách trách nhiệm giữa các lớp và mô-đun rõ ràng, tuân thủ tốt <strong>nguyên lý Đơn Trách Nhiệm (SRP)</strong>.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <MonacoDiffViewer
            studentName={studentName}
            sourceCode={sourceCode}
            plagiarismMatch={plagiarismMatch}
          />
        )}

        <AppealModal
          isOpen={isAppealModalOpen}
          onClose={() => setIsAppealModalOpen(false)}
          submissionId={submissionId}
          studentId={studentName}
          currentScore={score}
        />
      </div>
    </div>
  );
};

