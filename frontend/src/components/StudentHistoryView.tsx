import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import React, { useState, useEffect } from 'react';
import {
  FileCode, Download, RefreshCw, CheckCircle, XCircle, Clock,
  Award, Copy, Check, Scale, Search, Filter, ShieldCheck,
  AlertCircle, Sparkles, ExternalLink, ArrowRight, MessageSquare
} from 'lucide-react';
import { AppealModal } from './AppealModal';
import { FileTypeIcon } from './FileTypeIcon';
import type { Appeal } from '../types';
import { API_BASE_URL } from '../config/api';

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
    testcaseResults?: Array<{ testcaseIndex: number; status: 'PASSED' | 'FAILED'; timeMs: number }>;
    executionTimeMs?: number;
    aiRating?: {
      cleanCodeScore?: number;
      solidScore?: { s: number; o: number; l: number; i: number; d: number };
      explanation?: string;
      codeSmells?: Array<{ line: number; rule: string; description: string }>;
    };
    explanation?: string;
    sourceCode?: string;
    scoreBreakdown?: any;
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
  apiBaseUrl = API_BASE_URL,
  onNavigateToSubmit,
  onOpenAppealModal,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [appealsBySubmission, setAppealsBySubmission] = useState<Record<string, Appeal[]>>({});
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'QUEUED'>('ALL');

  // Modal xem chi tiet bai nop & danh gia AI
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailSubmission, setSelectedDetailSubmission] = useState<SubmissionDetailData | null>(null);

  const handleOpenDetailModal = (sub: SubmissionItem) => {
    setSelectedDetailSubmission({
      submissionId: sub.submissionId,
      studentId: sub.studentId,
      studentName: studentName,
      assignmentId: sub.assignmentId,
      assignmentTitle: sub.assignmentId,
      fileName: sub.fileName,
      language: sub.language,
      submittedAt: sub.createdAt,
      score: sub.score ?? sub.details?.score,
      scoreBreakdown: sub.details?.scoreBreakdown,
      passedTestcases: sub.details?.passedTestcases,
      totalTestcases: sub.details?.totalTestcases,
      testCaseResults: sub.details?.testcaseResults,
      executionTimeMs: (sub.details as any)?.executionTimeMs,
      sha256: sub.sha256Hash,
      sourceCode: sub.details?.sourceCode,
      aiRating: sub.details?.aiRating as any,
    });
    setDetailModalOpen(true);
  };

  // Modal appeal nội bộ
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealSubId, setAppealSubId] = useState('');
  const [appealScore, setAppealScore] = useState<number | undefined>(undefined);

  const fetchAppeals = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals?studentId=${encodeURIComponent(studentId || 'SE170000')}`);
      let allAppeals: Appeal[] = [];
      if (res.ok) {
        const json = await res.json();
        allAppeals = json.data || [];
      }
      if (allAppeals.length === 0) {
        const fallbackRes = await fetch(`${apiBaseUrl}/api/v1/appeals`);
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          allAppeals = fallbackJson.data || [];
        }
      }

      const map: Record<string, Appeal[]> = {};
      for (const app of allAppeals) {
        if (!map[app.submissionId]) {
          map[app.submissionId] = [];
        }
        map[app.submissionId].push(app);
      }
      for (const k in map) {
        map[k].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      setAppealsBySubmission(map);
    } catch (err) {
      console.warn('Lỗi tải danh sách phúc khảo:', err);
    }
  };

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
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchSubmissions(), fetchAppeals()]);
  };

  useEffect(() => {
    void refreshAll();
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
    const subAppeals = appealsBySubmission[sub.submissionId] || [];
    const acceptedApp = subAppeals.slice().reverse().find((a) => a.status === 'ACCEPTED' && a.adjustedScore !== undefined);
    const finalScore = acceptedApp?.adjustedScore ?? sub.score ?? sub.details?.score ?? 0;

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
  const passedCount = submissions.filter((s) => {
    const subAppeals = appealsBySubmission[s.submissionId] || [];
    const acceptedApp = subAppeals.slice().reverse().find((a) => a.status === 'ACCEPTED' && a.adjustedScore !== undefined);
    const effScore = acceptedApp?.adjustedScore ?? s.score ?? s.details?.score;
    return s.status === 'PASSED' || s.status === 'COMPLETED' || (effScore !== undefined && effScore >= 5.0);
  }).length;

  // Filter
  const filteredSubmissions = submissions.filter((s) => {
    const matchSearch =
      s.submissionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.assignmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    const subAppeals = appealsBySubmission[s.submissionId] || [];
    const acceptedApp = subAppeals.slice().reverse().find((a) => a.status === 'ACCEPTED' && a.adjustedScore !== undefined);
    const effScore = acceptedApp?.adjustedScore ?? s.score ?? s.details?.score;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PASSED')
      return s.status === 'PASSED' || s.status === 'COMPLETED' || (effScore !== undefined && effScore >= 5.0);
    if (statusFilter === 'FAILED')
      return s.status === 'FAILED' || (effScore !== undefined && effScore < 5.0);
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--blue-200)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              USE CASE 04 &amp; 06 • SINH VIÊN
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 600, marginTop: '4px', marginBottom: '8px', color: 'var(--text-main)' }}>
              Lịch Sử Bài Nộp &amp; Điểm Số
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
              Xem danh sách bài tập đã nộp, điểm số chi tiết từng tiêu chí, tải lại mã nguồn gốc (.zip) và quản lý khiếu nại phúc khảo theo quy tắc BR-05 (2 lượt/bài nộp).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={refreshAll}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: 'rgba(11, 18, 32, 0.05)',
                border: '1px solid rgba(11, 18, 32, 0.08)',
                color: 'var(--text-main)',
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
                  background: 'var(--blue-600)',
                  border: 'none',
                  color: 'var(--on-blue)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                }}
              >
                <FileCode size={16} /> Nộp Bài Tập Mới
              </button>
            )}
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '24px' }}>
          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.025)', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG BÀI ĐÃ NỘP</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
              {totalSubmissions} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>bài</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.025)', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>BÀI ĐẠT YÊU CẦU</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--blue-200)', marginTop: '4px' }}>
              {passedCount} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-dim)' }}>/ {totalSubmissions} bài</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.025)', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>QUY TẮC PHÚC KHẢO BR-05</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scale size={16} /> 2 lượt độc lập / mỗi bài tập
            </div>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm & Bộ lọc */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '480px' }}>
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
              backgroundColor: 'rgba(11, 18, 32, 0.035)',
              border: '1px solid rgba(11, 18, 32, 0.07)',
              color: 'var(--text-main)',
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
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.16)' : 'rgba(11, 18, 32, 0.035)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: active ? '#3b82f6' : 'transparent',
                  color: active ? 'var(--text-main)' : 'var(--text-muted)',
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
          <FileCode size={48} color="#3b82f6" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {searchTerm ? 'Không tìm thấy bài nộp nào phù hợp bộ lọc' : 'Bạn chưa có bài nộp nào'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Khi nộp bài tập qua hệ thống chấm điểm tự động Docker Sandbox, toàn bộ kết quả chấm, điểm số và file zip sẽ được lưu trữ tại đây.
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
                background: 'var(--blue-600)',
                border: 'none',
                color: 'var(--on-blue)',
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
            const subAppeals = appealsBySubmission[sub.submissionId] || [];
            const appealsCount = subAppeals.length;
            const isMaxAppeals = appealsCount >= 2;
            const latestAppeal = appealsCount > 0 ? subAppeals[appealsCount - 1] : null;

            // Tìm đơn phúc khảo được chấp thuận có điểm điều chỉnh
            const acceptedAppealWithScore = subAppeals.slice().reverse().find(
              (a) => a.status === 'ACCEPTED' && a.adjustedScore !== undefined
            );

            const originalScore = sub.score ?? sub.details?.score;
            const displayScore = acceptedAppealWithScore?.adjustedScore !== undefined
              ? acceptedAppealWithScore.adjustedScore
              : originalScore;

            const isPassed = displayScore !== undefined ? displayScore >= 5.0 : sub.status === 'PASSED';
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
                  borderRadius: '12px',
                  border: acceptedAppealWithScore
                    ? '1px solid rgba(37, 99, 235, 0.18)'
                    : '1px solid rgba(11, 18, 32, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Dòng 1: Header bài nộp & Điểm số */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Badge trạng thái */}
                    {sub.status === 'QUEUED' || sub.status === 'IN_PROGRESS' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'var(--state-info-bg)', color: 'var(--state-info)', fontSize: '12px', fontWeight: 700 }}>
                        <Clock size={14} /> ĐANG CHẤM
                      </span>
                    ) : isPassed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'var(--state-ok-bg)', color: 'var(--state-ok)', fontSize: '12px', fontWeight: 700 }}>
                        <CheckCircle size={14} /> ĐẠT ({displayScore !== undefined ? `${displayScore.toFixed(1)}/10` : 'PASS'})
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '12px', backgroundColor: 'var(--state-bad-bg)', color: 'var(--state-bad)', fontSize: '12px', fontWeight: 700 }}>
                        <XCircle size={14} /> CHƯA ĐẠT ({displayScore !== undefined ? `${displayScore.toFixed(1)}/10` : 'FAIL'})
                      </span>
                    )}

                    {/* Mã bài nộp */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mã bài nộp:</span>
                      <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--blue-300)', fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(37, 99, 235, 0.07)', padding: '2px 8px', borderRadius: '6px' }}>
                        {sub.submissionId}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(sub.submissionId)}
                        title="Sao chép mã bài nộp để phúc khảo"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === sub.submissionId ? '#2563eb' : 'var(--text-muted)',
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
                    <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(11, 18, 32, 0.04)', color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                      {sub.language}
                    </span>

                    {/* Badge số lần đã phúc khảo của bài này */}
                    {appealsCount > 0 && (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: isMaxAppeals ? 'rgba(11, 18, 32, 0.06)' : 'rgba(37, 99, 235, 0.08)',
                          color: isMaxAppeals ? 'var(--text-main)' : '#1e40af',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Scale size={12} /> Phúc khảo: {appealsCount}/2 lượt
                      </span>
                    )}
                  </div>

                  {/* Điểm số hiển thị góc phải */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: acceptedAppealWithScore ? '#2563eb' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '4px',
                        }}
                      >
                        {acceptedAppealWithScore && <Sparkles size={12} />}
                        {acceptedAppealWithScore ? 'Điểm Sau Phúc Khảo' : 'Điểm Tổng Hợp'}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 900, color: displayScore !== undefined && displayScore >= 5.0 ? '#2563eb' : 'var(--text-main)' }}>
                        {displayScore !== undefined ? `${displayScore.toFixed(1)} / 10.0` : 'Chờ chấm'}
                      </div>
                      {acceptedAppealWithScore && originalScore !== undefined && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                          Điểm gốc: {originalScore.toFixed(1)}/10.0
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dòng 2: Tên đề bài & thông tin file */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', backgroundColor: 'rgba(11, 18, 32, 0.02)', padding: '14px 16px', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Đề bài / Assignment</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      {sub.assignmentId || 'SWP391 - Đồ Án Chuyên Ngành'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tên file nộp gốc</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileTypeIcon fileName={sub.fileName || `${sub.submissionId}.zip`} size={18} /> {sub.fileName || `${sub.submissionId}.zip`}
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
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.1)', fontSize: '12px', color: 'var(--blue-200)' }}>
                      <strong>Testcases:</strong> {testcaseText} (70% trọng số)
                    </div>
                  )}

                  {cleanCodeScore !== undefined && (
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)', fontSize: '12px', color: '#1e40af' }}>
                      <strong>Clean Code:</strong> {cleanCodeScore.toFixed(1)} / 10.0
                    </div>
                  )}

                  {sub.details?.aiRating?.solidScore && (
                    <div style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.1)', fontSize: '12px', color: 'var(--blue-200)' }}>
                      <strong>SOLID:</strong> S:{sub.details.aiRating.solidScore.s} O:{sub.details.aiRating.solidScore.o} L:{sub.details.aiRating.solidScore.l} I:{sub.details.aiRating.solidScore.i} D:{sub.details.aiRating.solidScore.d}
                    </div>
                  )}
                </div>

                {/* Nhận xét AI ngắn nếu có */}
                {sub.details?.aiRating?.explanation && (
                  <div style={{ fontSize: '12px', color: '#4d5c76', fontStyle: 'italic', backgroundColor: 'rgba(11, 18, 32, 0.03)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                    &ldquo;{sub.details.aiRating.explanation}&rdquo;
                  </div>
                )}

                {/* KHỐI THÔNG TIN PHÚC KHẢO (NẾU BÀI NỘP NÀY ĐÃ GỬI ĐƠN PHÚC KHẢO) */}
                {appealsCount > 0 && (
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header thông tin phúc khảo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Scale size={18} color="#2563eb" />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
                          Thông Tin Phúc Khảo Bài Nộp (Đã sử dụng: {appealsCount}/2 lượt của bài này)
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                          — Quy tắc BR-05
                        </span>
                      </div>

                      <div>
                        {latestAppeal?.status === 'ACCEPTED' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-ok-bg)', color: 'var(--state-ok)', fontSize: '12px', fontWeight: 700 }}>
                            <CheckCircle size={14} /> ĐÃ CHẤP THUẬN CẬP NHẬT ĐIỂM
                          </span>
                        )}
                        {latestAppeal?.status === 'REJECTED' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--state-bad-bg)', color: 'var(--state-bad)', fontSize: '12px', fontWeight: 700 }}>
                            <XCircle size={14} /> ĐÃ TỪ CHỐI KHIẾU NẠI
                          </span>
                        )}
                        {(latestAppeal?.status === 'PENDING' || latestAppeal?.status === 'IN_REVIEW') && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#1e40af', fontSize: '12px', fontWeight: 700 }}>
                            <Clock size={14} /> ĐANG CHỜ GIẢNG VIÊN XEM XÉT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Danh sách từng lần phúc khảo: Lần 1, Lần 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {subAppeals.map((app, appIdx) => (
                        <div
                          key={app.appealId || appIdx}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(11, 18, 32, 0.04)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue-200)', backgroundColor: 'rgba(37, 99, 235, 0.10)', padding: '2px 8px', borderRadius: '6px' }}>
                                Lần {appIdx + 1}/2
                              </span>
                              <code style={{ fontSize: '12px', color: '#33415a' }}>{app.appealId}</code>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                ({new Date(app.createdAt).toLocaleString('vi-VN')})
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: app.status === 'ACCEPTED' ? '#2563eb' : app.status === 'REJECTED' ? 'var(--text-main)' : '#1e40af' }}>
                              {app.status === 'ACCEPTED' ? '✓Đã chấp thuận' : app.status === 'REJECTED' ? '✕Đã từ chối' : '⏳ Chờ xem xét'}
                            </span>
                          </div>

                          {/* Lý do sinh viên gửi */}
                          <div style={{ fontSize: '13px', color: '#33415a', lineHeight: 1.5 }}>
                            <strong style={{ color: '#4d5c76' }}>Lý do bạn khiếu nại: </strong>
                            &ldquo;{app.reason}&rdquo;
                          </div>

                          {/* Kết quả phản hồi của Giảng viên */}
                          {app.status === 'ACCEPTED' && (
                            <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.07)', border: '1px solid rgba(37, 99, 235, 0.12)', fontSize: '12px', color: 'var(--blue-200)' }}>
                              <div style={{ fontWeight: 700, color: 'var(--blue-200)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Award size={14} /> Phản hồi từ Giảng viên ({app.reviewerId || 'Giảng viên phụ trách'}):
                              </div>
                              <div>{app.resolutionNote || 'Đã đồng ý điều chỉnh điểm theo khiếu nại.'}</div>
                              {app.adjustedScore !== undefined && (
                                <div style={{ marginTop: '5px', fontWeight: 600, color: 'var(--blue-300)', fontSize: '13px' }}>
                                  Điểm số điều chỉnh chính thức: {app.adjustedScore} / 10.0
                                  {app.resolvedAt && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                                      (Duyệt ngày: {new Date(app.resolvedAt).toLocaleString('vi-VN')})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {app.status === 'REJECTED' && (
                            <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(11, 18, 32, 0.05)', border: '1px solid rgba(11, 18, 32, 0.09)', fontSize: '12px', color: 'var(--text-main)' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '3px' }}>
                                ✕Phản hồi từ Giảng viên ({app.reviewerId || 'Giảng viên phụ trách'}):
                              </div>
                              <div>{app.resolutionNote || 'Không chấp thuận khiếu nại. Điểm số giữ nguyên theo kết quả ban đầu.'}</div>
                              {app.resolvedAt && (
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>
                                  Thời gian xử lý: {new Date(app.resolvedAt).toLocaleString('vi-VN')}
                                </div>
                              )}
                            </div>
                          )}

                          {(app.status === 'PENDING' || app.status === 'IN_REVIEW') && (
                            <div style={{ fontSize: '11px', color: '#1e40af', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={12} /> Đơn đang trong danh sách chờ Giảng viên phúc tra. Kết quả sẽ được cập nhật tự động tại đây.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dòng 4: CÁC NÚT HÀNH ĐỘNG (Tải lại file zip & Phúc khảo) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(11, 18, 32, 0.04)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#2563eb" />
                    <span>Mã băm SHA-256: </span>
                    <code style={{ fontSize: '11px', color: '#4d5c76' }}>
                      {sub.sha256Hash ? `${sub.sha256Hash.substring(0, 16)}...` : 'Đã kiểm định'}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {/* NÚT TẢI LẠI FILE BÀI NỘP (.ZIP) */}
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(sub)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '9px 18px',
                        borderRadius: '9px',
                        background: 'var(--blue-600)',
                        border: 'none',
                        color: 'var(--on-blue)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                        transition: 'all 0.15s ease',
                      }}
                      title="Xem toan bo ma nguon da nop, chi tiet testcase va danh gia AI"
                    >
                      <Sparkles size={15} /> Xem Chi Tiết (Code & AI)
                    </button>

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
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid rgba(37, 99, 235, 0.16)',
                        color: 'var(--blue-300)',
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

                    {/* NÚT PHÚC KHẢO / KHIẾU NẠI ĐIỂM (Làm mờ, vô hiệu hóa nếu đã dùng đủ 2 lượt) */}
                    <button
                      type="button"
                      onClick={() => !isMaxAppeals && handleOpenAppeal(sub)}
                      disabled={isMaxAppeals}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '9px 16px',
                        borderRadius: '9px',
                        backgroundColor: isMaxAppeals
                          ? 'rgba(11, 18, 32, 0.03)'
                          : appealsCount === 1
                            ? 'rgba(37, 99, 235, 0.1)'
                            : 'rgba(37, 99, 235, 0.08)',
                        border: isMaxAppeals
                          ? '1px dashed rgba(11, 18, 32, 0.1)'
                          : '1px solid rgba(37, 99, 235, 0.18)',
                        color: isMaxAppeals ? '#4d5c76' : '#1e40af',
                        fontSize: '13px',
                        fontWeight: 700,
                        opacity: isMaxAppeals ? 0.45 : 1,
                        cursor: isMaxAppeals ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title={
                        isMaxAppeals
                          ? 'Bài nộp này đã sử dụng tối đa 2/2 lượt phúc khảo theo quy tắc BR-05. Không thể khiếu nại thêm.'
                          : appealsCount === 1
                            ? 'Gửi đơn phúc khảo lần 2 cho riêng bài nộp này (còn 1 lượt)'
                            : 'Gửi đơn khiếu nại & phúc khảo cho riêng bài nộp này (tối đa 2 lượt)'
                      }
                    >
                      <Scale size={15} />
                      {isMaxAppeals
                        ? 'Hết lượt phúc khảo (2/2)'
                        : appealsCount === 1
                          ? 'Phúc khảo lần 2 (1/2 lượt)'
                          : 'Phúc khảo bài này (0/2 lượt)'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal phúc khảo nội bộ khi mở trực tiếp từ từng bài nộp */}
      {/* Modal Xem Chi Tiet Bai Nop */}
      <SubmissionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        submission={selectedDetailSubmission}
        apiBaseUrl={apiBaseUrl}
        onOpenAppeal={(subId, currentScore) => {
          setDetailModalOpen(false);
          setAppealSubId(subId);
          setAppealScore(currentScore);
          setAppealModalOpen(true);
        }}
        onDownloadZip={(sub) => {
          const matchSub = submissions.find((s) => s.submissionId === sub.submissionId);
          if (matchSub) handleDownloadZip(matchSub);
        }}
      />

      <AppealModal
        isOpen={appealModalOpen}
        onClose={() => {
          setAppealModalOpen(false);
          void refreshAll();
        }}
        onAppealSuccess={() => {
          void refreshAll();
        }}
        submissionId={appealSubId}
        studentId={studentId}
        currentScore={appealScore}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
};
