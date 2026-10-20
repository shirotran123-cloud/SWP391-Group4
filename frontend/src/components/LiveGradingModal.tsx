import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle, Sparkles, Scale, Trophy, FlaskConical, CornerUpRight } from 'lucide-react';
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

const breakdownItems = [
  { key: 'testcase1' as const, label: 'Testcase 1', max: 4.0, icon: FlaskConical },
  { key: 'testcase2' as const, label: 'Testcase 2', max: 3.0, icon: FlaskConical },
  { key: 'cleanCode' as const, label: 'Clean code', max: 2.0, icon: Sparkles },
  { key: 'solid' as const, label: 'SOLID', max: 1.0, icon: CornerUpRight },
];

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
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card fade-up"
        style={{ width: '100%', maxWidth: '880px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
      >
        {/* ĐẦU TRANG */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '22px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span className="chip chip-mono chip-neutral">#{submissionId.substring(0, 8)}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {studentName}
              </span>
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {isCompleted ? 'Kết quả đánh giá mã nguồn' : 'Đang chấm bài tự động'}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '3px' }}>
              {isCompleted
                ? 'Tổng hợp từ sandbox thực thi, phân tích AST và đánh giá SOLID.'
                : 'Kết quả từng bước được đẩy về trực tiếp qua Socket.IO.'}
            </p>
          </div>

          {isCompleted && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAppealModalOpen(true)}>
                <Scale size={14} /> Khiếu nại
              </button>
              <button type="button" className="btn btn-invert btn-sm" onClick={onClose}>
                Đóng
              </button>
            </div>
          )}
        </div>

        {/* ĐIỂM TỔNG + BAREM */}
        {isCompleted && score !== undefined && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(150px, 190px) 1fr',
              gap: '20px',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'rgba(11, 18, 32, 0.02)',
              marginBottom: '24px',
            }}
          >
            <div style={{ borderRight: '1px solid var(--border-soft)', paddingRight: '18px' }}>
              <p className="eyebrow">Điểm tổng</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>/ {maxScore}</span>
              </div>
              {executionTimeMs !== undefined && (
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={11} /> {executionTimeMs}ms thực thi
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {breakdownItems.map((item) => {
                const value = scoreBreakdown?.[item.key] ?? 0;
                const pct = Math.max(0, Math.min(100, (value / item.max) * 100));
                const Icon = item.icon;
                return (
                  <div key={item.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Icon size={11} /> {item.label}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>
                        {value.toFixed(1)}/{item.max.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ height: '3px', borderRadius: '2px', backgroundColor: 'rgba(11, 18, 32, 0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--blue-500)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TIẾN TRÌNH */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="eyebrow">Tiến trình chấm</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: isCompleted ? 'var(--blue-300)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {completedCount}/{steps.length} · {progressPercent}%
            </span>
          </div>
          <div style={{ height: '4px', backgroundColor: 'rgba(11, 18, 32, 0.04)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: isCompleted ? 'var(--blue-400)' : 'var(--blue-600)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', marginBottom: '26px' }}>
          {steps.map((step, index) => {
            const isPassed = step.status === 'passed';
            const isFailed = step.status === 'failed';
            const isInProgress = step.status === 'in_progress';
            const isPending = step.status === 'pending';

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '12px 15px',
                  backgroundColor: isInProgress ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                  borderBottom: index === steps.length - 1 ? 'none' : '1px solid var(--border-soft)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isPassed || isFailed || isInProgress ? 'rgba(11, 18, 32, 0.03)' : 'transparent',
                    }}
                  >
                    {isPassed && <CheckCircle2 size={13} color="var(--blue-400)" strokeWidth={2.4} />}
                    {isFailed && <XCircle size={13} color="#ffffff" strokeWidth={2.4} />}
                    {isInProgress && <Loader2 size={13} color="var(--blue-500)" className="animate-spin" strokeWidth={2.4} />}
                    {isPending && <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{index + 1}</span>}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '13px', fontWeight: isInProgress ? 600 : 500, color: isPending ? 'var(--text-dim)' : 'var(--text-main)' }}>
                      {step.label}
                    </h4>
                    {step.detail && (
                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '1px' }}>{step.detail}</p>
                    )}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isPassed ? 'var(--blue-300)' : isFailed ? 'var(--text-main)' : isInProgress ? 'var(--blue-400)' : 'var(--text-faint)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isPassed ? 'Đạt' : isFailed ? 'Không đạt' : isInProgress ? 'Đang xử lý' : null}
                </span>
              </div>
            );
          })}
        </div>

        {/* ĐÁNH GIÁ CHI TIẾT */}
        {isCompleted && aiRating && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="glass-panel panel-flush" style={{ padding: '18px' }}>
              <div className="section-title" style={{ marginBottom: '10px' }}>
                <Trophy size={15} color="var(--blue-400)" />
                Đánh giá 5 trục SOLID
              </div>
              <SolidRadarChart rating={aiRating} />
            </div>

            <div className="glass-panel panel-flush" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
              <div className="section-title" style={{ marginBottom: '10px' }}>
                <Sparkles size={15} color="var(--blue-400)" />
                Nhận xét của trợ lý
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '14px', flexGrow: 1 }}>
                {aiRating.explanation}
              </p>

              <h4 style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Cảnh báo code smell
                <span className="chip chip-neutral chip-mono">{aiRating.codeSmells.length}</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '128px', overflowY: 'auto' }}>
                {aiRating.codeSmells.map((smell, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '7px 9px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(11, 18, 32, 0.025)',
                      borderLeft: '2px solid var(--blue-500)',
                      fontSize: '11.5px',
                      display: 'flex',
                      gap: '7px',
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue-300)', flexShrink: 0 }}>L{smell.line || 15}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{smell.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isCompleted && aiRating && (
          <div
            style={{
              padding: '15px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-blue)',
              backgroundColor: 'rgba(59, 130, 246, 0.06)',
              display: 'flex',
              gap: '11px',
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={15} color="var(--blue-400)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--blue-300)', marginBottom: '3px' }}>
                Gợi ý cải thiện kiến trúc
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                {aiRating.codeSmells && aiRating.codeSmells.length > 0 ? (
                  <span>
                    Dòng {aiRating.codeSmells[0].line}: {aiRating.codeSmells[0].description} Nên tách nhỏ phương thức để tuân thủ{' '}
                    <strong style={{ color: 'var(--text-soft)' }}>Single Responsibility Principle</strong>.
                  </span>
                ) : (
                  <span>
                    Không phát hiện code smell. Cách phân tách trách nhiệm giữa các lớp đang tuân thủ tốt nguyên lý{' '}
                    <strong style={{ color: 'var(--text-soft)' }}>Single Responsibility Principle</strong>.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <MonacoDiffViewer studentName={studentName} sourceCode={sourceCode} plagiarismMatch={plagiarismMatch} />
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

export default LiveGradingModal;
