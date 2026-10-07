import { CheckCircle2, Clock, Loader2, XCircle, Sparkles, Award } from 'lucide-react';
import type { GradingStep, AIRating, PlagiarismMatch } from '../types';
import { SolidRadarChart } from './SolidRadarChart';
import { MonacoDiffViewer } from './MonacoDiffViewer';

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
}) => {
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
              {isCompleted ? '⚡ Kết Quả Chấm Bài & AI Review' : '🔄 Đang Chấm Bài Real-Time (Socket.IO)'}
            </h2>
          </div>

          {isCompleted && (
            <button
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
              Hoàn thành & Đóng
            </button>
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
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: step.status === 'in_progress' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                border: `1px solid ${step.status === 'in_progress' ? 'var(--accent-primary)' : step.status === 'passed' ? 'rgba(16, 185, 129, 0.3)' : step.status === 'failed' ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.3s ease',
              }}
            >
              {step.status === 'passed' && <CheckCircle2 size={20} color="var(--accent-emerald)" />}
              {step.status === 'failed' && <XCircle size={20} color="var(--accent-rose)" />}
              {step.status === 'in_progress' && <Loader2 size={20} color="var(--accent-primary)" className="pulse-animation" />}
              {step.status === 'pending' && <Clock size={20} color="var(--text-dim)" />}

              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: step.status === 'pending' ? 'var(--text-dim)' : '#ffffff' }}>
                  {step.label}
                </div>
                {step.detail && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {isCompleted && aiRating && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Award size={18} color="var(--accent-secondary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Đánh Giá Kiến Trúc SOLID</h3>
              </div>
              <SolidRadarChart rating={aiRating} />
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Clean Code Score</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{aiRating.cleanCodeScore}/10</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SOLID Average</span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                    {((aiRating.solidScore.s + aiRating.solidScore.o + aiRating.solidScore.l + aiRating.solidScore.i + aiRating.solidScore.d) / 5).toFixed(1)}/10
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Nhận Xét Từ AI Assistant</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '16px', flexGrow: 1 }}>
                "{aiRating.explanation}"
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Cảnh báo Code Smells ({aiRating.codeSmells.length}):</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {aiRating.codeSmells.map((smell, index) => (
                  <div key={index} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '12px', display: 'flex', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600 }}>L34:</span>
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
                💡 Socratic Hint Explainer (Exception Path Handling)
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
      </div>
    </div>
  );
};
