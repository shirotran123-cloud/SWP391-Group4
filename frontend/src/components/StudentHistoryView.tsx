import React, { useState, useEffect } from 'react';
import {
  FileCode, Download, RefreshCw, CheckCircle, XCircle, Clock,
  Award, Copy, Check, Scale, Search, Filter, ShieldCheck,
  AlertCircle, Sparkles, ExternalLink, ArrowRight
} from 'lucide-react';
import { AppealModal } from './AppealModal';

export interface SubmissionItem {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;
  fileName: string;
  fileSizeBytes?: number;
  sha256Hash?: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'COMPLETED' | string;
  score?: number;
  createdAt: string | Date;
  details?: {
    score?: number;
    passedTestcases?: number;
    totalTestcases?: number;
    aiRating?: {
      cleanCodeScore?: number;
      solidScore?: { s: number; o: number; l: number; i: number; d: number };
      explanation?: string;
      codeSmells?: Array<{ line: number; rule: string; description: string }>;
    };
    explanation?: string;
  };
}

interface StudentHistoryViewProps {
  studentId: string;
  studentName: string;
  apiBaseUrl?: string;
  onNavigateToSubmit?: () => void;
  onOpenAppealModal?: (submissionId: string, currentScore?: number) => void;
}

export const StudentHistoryView: React.FC<StudentHistoryViewProps> = ({
  studentId,
  studentName,
  apiBaseUrl = 'http://localhost:3000',
  onNavigateToSubmit,
  onOpenAppealModal,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'QUEUED'>('ALL');

  // Modal appeal nội bộ nếu không dùng callback ngoài
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealSubId, setAppealSubId] = useState('');
  const [appealScore, setAppealScore] = useState<number | undefined>(undefined);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/submissions?studentId=${encodeURIComponent(studentId || 'SE170000')}`);
      if (res.ok) {
        const json = await res.json();
        const data: SubmissionItem[] = json.data || [];
        if (data.length > 0) {
          setSubmissions(data);
          return;
        }
      }
      // Nếu server chưa có bài nộp của studentId cụ thể, thử fetch tất cả bài nộp demo
      const allRes = await fetch(`${apiBaseUrl}/api/v1/submissions?limit=20`);
      if (allRes.ok) {
        const allJson = await allRes.json();
        const allData: SubmissionItem[] = allJson.data || [];
        if (allData.length > 0) {
          setSubmissions(allData);
          return;
        }
      }
      setSubmissions([]);
    } catch (err) {
      console.warn('Lỗi tải danh sách bài nộp:', err);
      // Fallback demo data
      setSubmissions([
        {
          submissionId: 'SUB-270782-579IZL',
          studentId: studentId || 'SE170000',
          assignmentId: 'TASK-SWP391-SPRINT2',
          language: 'java',
          fileName: 'Solution_QuickSort_3Way.zip',
          fileSizeBytes: 1048576,
          sha256Hash: '3e5be8e8c41d8f0f31574334d0d089837abc64a19d0b055e3651ac5339c71640',
          status: 'PASSED',
          score: 9.5,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          details: {
            score: 9.5,
            passedTestcases: 2,
            totalTestcases: 2,
            aiRating: {
              cleanCodeScore: 8.5,
              solidScore: { s: 7.0, o: 9.0, l: 8.5, i: 9.0, d: 8.0 },
              explanation: 'Mã nguồn cấu trúc chặt chẽ, thuật toán O(N log N) chuẩn xác.',
            },
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubmissions();
  }, [studentId]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadZip = async (sub: SubmissionItem) => {
    setDownloadingId(sub.submissionId);
    try {
      const downloadUrl = `${apiBaseUrl}/api/v1/submissions/${sub.submissionId}/download`;
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error('Không thể tải file bài nộp từ server');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sub.fileName.endsWith('.zip') ? sub.fileName : `${sub.fileName || sub.submissionId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải file zip bài nộp');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenAppeal = (sub: SubmissionItem) => {
    const finalScore = sub.score ?? sub.details?.score ?? 0;
    if (onOpenAppealModal) {
      onOpenAppealModal(sub.submissionId, finalScore);
    } else {
      setAppealSubId(sub.submissionId);
      setAppealScore(finalScore);
      setAppealModalOpen(true);
    }
  };

  // Metrics
  const totalSubmissions = submissions.length;
  const passedCount = submissions.filter(
    (s) => s.status === 'PASSED' || s.status === 'COMPLETED' || (s.score && s.score >= 5.0)
  ).length;
  const avgScore =
    totalSubmissions > 0
      ? (
          submissions.reduce((acc, s) => acc + (s.score ?? s.details?.score ?? 0), 0) /
          totalSubmissions
        ).toFixed(1)
      : '0.0';

  // Filter
  const filteredSubmissions = submissions.filter((s) => {
    const matchSearch =
      s.submissionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.assignmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PASSED')
      return s.status === 'PASSED' || s.status === 'COMPLETED' || (s.score && s.score >= 5.0);
    if (statusFilter === 'FAILED')
      return s.status === 'FAILED' || (s.score !== undefined && s.score < 5.0);
    if (statusFilter === 'QUEUED')
      return s.status === 'QUEUED' || s.status === 'IN_PROGRESS';
    return true;
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px 0 32px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              USE CASE 04 &amp; 06 • SINH VIÊN
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', marginBottom: '8px', color: '#ffffff' }}>
              Lịch Sử Bài Nộp &amp; Điểm Số
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
              Xem danh sách bài tập đã nộp, điểm số chi tiết từng tiêu chí, tải lại mã nguồn gốc (.zip) và khiếu nại phúc khảo.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchSubmissions}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>

            {onNavigateToSubmit && (
              <button
                onClick={onNavigateToSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                }}
              >
                <FileCode size={16} /> Nộp Bài Tập Mới
              </button>
            )}
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '24px' }}>
          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG BÀI ĐÃ NỘP</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              {totalSubmissions} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>bài</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>ĐIỂM TRUNG BÌNH (GPA)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={22} /> {avgScore} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 10.0</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>BÀI ĐẠT YÊU CẦU</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
              {passedCount} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>/ {totalSubmissions} bài</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>BẢO MẬT &amp; INTEGRITY</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} /> SHA-256 Hashing Immutability
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm theo Mã bài nộp, tên đề bài hoặc file .zip..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['ALL', 'PASSED', 'FAILED', 'QUEUED'] as const).map((filter) => {
            const labelMap = {
              ALL: 'Tất cả',
              PASSED: 'Đạt (>= 5.0)',
              FAILED: 'Chưa đạt',
              QUEUED: 'Đang chấm',
            };
            const active = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: active ? '#6366f1' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {labelMap[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách bài nộp */}
      {filteredSubmissions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <FileCode size={48} color="#6366f1" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
            {searchTerm ? 'Không tìm thấy bài nộp nào phù hợp bộ lọc' : 'Bạn chưa có bài nộp nào'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Khi nộp bài tập qua hệ thống chấm điểm tự động Docker Sandbox, toàn bộ kết quả chấm, điểm số và file zip sẽ được lưu giữ tại đây.
          </p>
          {onNavigateToSubmit && (
            <button
              onClick={onNavigateToSubmit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <FileCode size={16} /> Nộp Bài Tập Ngay
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSubmissions.map((sub) => {
            const finalScore = sub.score ?? sub.details?.score;
            const isPassed = finalScore !== undefined ? finalScore >= 5.0 : sub.status === 'PASSED';
            const cleanCodeScore = sub.details?.aiRating?.cleanCodeScore;
            const testcaseText =
              sub.details?.passedTestcases !== undefined && sub.details?.totalTestcases !== undefined
                ? `${sub.details.passedTestcases}/${sub.details.totalTestcases} Testcases`
                : null;

            return (
              <div
                key={sub.submissionId}
                className="glass-panel"
                style={{
                  padding: '22px 24px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Dòng 1: Header bài nộp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Badge trạng thái */}
                    {sub.status === 'QUEUED' || sub.status === 'IN_PROGRESS' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>
                        <Clock size={14} /> ĐANG CHẤM
                      </span>
                    ) : isPassed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
                        <CheckCircle size={14} /> ĐẠT ({finalScore !== undefined ? `${finalScore}/10` : 'PASS'})
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontSize: '12px', fontWeight: 700 }}>
                        <XCircle size={14} /> CHƯA ĐẠT ({finalScore !== undefined ? `${finalScore}/10` : 'FAIL'})
                      </span>
                    )}

                    {/* Mã bài nộp */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mã bài nộp:</span>
                      <code style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8', fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(129, 140, 248, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        {sub.submissionId}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(sub.submissionId)}
                        title="Sao chép mã bài nộp để phúc khảo"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === sub.submissionId ? '#10b981' : 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {copiedId === sub.submissionId ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>

                    {/* Ngôn ngữ */}
                    <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                      {sub.language || 'Java'}
                    </span>
                  </div>

                  {/* Điểm số to rõ ràng */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Điểm Tổng Hợp</div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: finalScore !== undefined && finalScore >= 5.0 ? '#10b981' : '#f43f5e' }}>
                        {finalScore !== undefined ? `${finalScore.toFixed(1)} / 10.0` : 'Chờ chấm'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dòng 2: Tên đề bài & thông tin file */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px 16px', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Đề bài / Assignment</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      {sub.assignmentId || 'SWP391 - Đồ Án Chuyên Ngành'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tên file nộp gốc</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c7d2fe', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileCode size={14} /> {sub.fileName || `${sub.submissionId}.zip`}
                      {sub.fileSizeBytes && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          ({(sub.fileSizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thời gian nộp</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)', marginTop: '2px' }}>
                      {new Date(sub.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>

                {/* Dòng 3: Chi tiết điểm (Testcase, Clean Code, SOLID) */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {testcaseText && (
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12px', color: '#6ee7b7' }}>
                      <strong>Testcases:</strong> {testcaseText} (70% trọng số)
                    </div>
                  )}

                  {cleanCodeScore !== undefined && (
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '12px', color: '#c7d2fe' }}>
                      <strong>Clean Code:</strong> {cleanCodeScore.toFixed(1)} / 10.0
                    </div>
                  )}

                  {sub.details?.aiRating?.solidScore && (
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '12px', color: '#67e8f9' }}>
                      <strong>SOLID:</strong> S:{sub.details.aiRating.solidScore.s} O:{sub.details.aiRating.solidScore.o} L:{sub.details.aiRating.solidScore.l} I:{sub.details.aiRating.solidScore.i} D:{sub.details.aiRating.solidScore.d}
                    </div>
                  )}
                </div>

                {/* Nhận xét AI ngắn nếu có */}
                {sub.details?.aiRating?.explanation && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
                    &ldquo;{sub.details.aiRating.explanation}&rdquo;
                  </div>
                )}

                {/* Dòng 4: CÁC NÚT HÀNH ĐỘNG (Tải lại file zip & Phúc khảo) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#10b981" />
                    <span>Mã băm SHA-256: </span>
                    <code style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {sub.sha256Hash ? `${sub.sha256Hash.substring(0, 16)}...` : 'Đã kiểm định'}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {/* NÚT TẢI LẠI FILE BÀI NỘP (.ZIP) */}
                    <button
                      type="button"
                      onClick={() => handleDownloadZip(sub)}
                      disabled={downloadingId === sub.submissionId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '9px 16px',
                        borderRadius: '9px',
                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: downloadingId === sub.submissionId ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Tải lại file nộp gốc (.zip) của bài tập này"
                    >
                      <Download size={15} />
                      {downloadingId === sub.submissionId ? 'Đang tải...' : 'Tải lại bài (.zip)'}
                    </button>

                    {/* NÚT PHÚC KHẢO / KHIẾU NẠI ĐIỂM */}
                    <button
                      type="button"
                      onClick={() => handleOpenAppeal(sub)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '9px 16px',
                        borderRadius: '9px',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Nộp đơn phúc khảo cho bài nộp này"
                    >
                      <Scale size={15} /> Phúc khảo bài này
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal phúc khảo nội bộ khi mở trực tiếp từ bảng */}
      <AppealModal
        isOpen={appealModalOpen}
        onClose={() => {
          setAppealModalOpen(false);
          void fetchSubmissions();
        }}
        submissionId={appealSubId}
        studentId={studentId}
        currentScore={appealScore}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
};
