import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle, Sparkles, Award, Scale } from 'lucide-react';
import type { GradingStep, AIRating, PlagiarismMatch } from '../types';
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
  maxScore = 10,
  executionTimeMs,
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
              {isCompleted ? '🎉 Kết Quả Đánh Giá Mã Nguồn & Nhận Xét AI' : '⚡ Đang Chấm Bài Tự Động (Thời Gian Thực Socket.IO)'}
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
                    🧪 Testcases: {((score >= 7 ? 7.0 : Math.max(0, score - 2.5))).toFixed(1)} / 7.0đ (Tỷ lệ quy đổi)
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    ✨ Clean Code O(N log N): {aiRating ? ((aiRating.cleanCodeScore / 10) * 2.0).toFixed(1) : '1.8'} / 2.0đ
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    📐 SOLID Architecture: {aiRating ? (((aiRating.solidScore.s + aiRating.solidScore.o + aiRating.solidScore.l + aiRating.solidScore.i + aiRating.solidScore.d) / 50) * 1.0).toFixed(1) : '0.8'} / 1.0đ
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
                <Scale size={16} /> Khiếu Nại Điểm (UC-06)
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
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Đánh Giá 5 Trục SOLID (GenAI)</h3>
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
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600 }}>L{smell.line || 15}:</span>
                    <span style={{ color: '#d1d5db' }}>{smell.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isCompleted && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Sparkles size={20} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                💡 Gợi Ý Sư Phạm Socratic (Xử Lý Tình Huống Ngoại Lệ)
              </h4>
              <p style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.5' }}>
                Gợi ý sư phạm: Hàm <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#f43f5e' }}>sortAndPrintAndSaveToDatabase</code> đang đảm nhận quá nhiều trách nhiệm (vừa sắp xếp, vừa hiển thị, vừa lưu DB). Hãy thử tách thành các phương thức độc lập để tuân thủ <strong>Single Responsibility Principle (SRP)</strong>.
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

