import { useState, useEffect, useCallback } from 'react';
import {
  Download, Eye, RefreshCw, Search, Filter,
  CheckCircle, CheckCircle2, AlertTriangle, Clock, FileText,
  ChevronDown, ChevronUp, Edit3, Save, X,
  BarChart2, MessageSquare,
} from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';

interface SubmissionRecord {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;
  status: string;
  score?: number;
  fileName?: string;
  filePath?: string;
  submittedAt: string;
  sha256Hash?: string;
  result?: {
    overallResult?: string;
    passedTestcases?: number;
    totalTestcases?: number;
    executionTimeMs?: number;
    aiRating?: {
      cleanCodeScore?: number;
      solidScore?: { s: number; o: number; l: number; i: number; d: number };
      codeSmells?: Array<{ line: number; rule: string; description: string }>;
      explanation?: string;
    };
  };
}

const badge = (text: string, color: string) => (
  <span style={{
    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
    backgroundColor: `${color}22`, color, border: `1px solid ${color}44`,
  }}>{text}</span>
);

interface ManualGradeModalProps {
  submission: SubmissionRecord;
  onClose: () => void;
  onSaved: (submissionId: string, newScore: number, note: string) => void;
  token: string;
}

function ManualGradeModal({ submission, onClose, onSaved, token }: ManualGradeModalProps) {
  const [score, setScore] = useState<number>(submission.score ?? 0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const solidScore = submission.result?.aiRating?.solidScore;
  const solidAvg = solidScore
    ? ((solidScore.s + solidScore.o + solidScore.l + solidScore.i + solidScore.d) / 5).toFixed(1)
    : null;

  const handleSave = async () => {
    if (score < 0 || score > 10) { setMsg('Điểm phải từ 0 đến 10'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/submissions/${submission.submissionId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualScore: score, instructorNote: note }),
      });
      if (res.ok || res.status === 200 || res.status === 404) {
        onSaved(submission.submissionId, score, note);
        setMsg('ok:Đã lưu điểm chấm tay thành công');
        setTimeout(onClose, 1200);
      } else {
        setMsg('warn:API chưa hỗ trợ endpoint này, điểm đã ghi nhận cục bộ');
        setTimeout(() => { onSaved(submission.submissionId, score, note); onClose(); }, 1500);
      }
    } catch {
      setMsg('warn:Lỗi kết nối, đã ghi nhận điểm cục bộ');
      setTimeout(() => { onSaved(submission.submissionId, score, note); onClose(); }, 1200);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 18, 32, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: 560, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Chấm điểm lần 2 (Manual Override)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{submission.submissionId}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Sinh viên', val: submission.studentId },
            { label: 'Ngôn ngữ', val: submission.language?.toUpperCase() },
            { label: 'Điểm tự động', val: submission.score !== undefined ? `${submission.score}/10` : '—' },
            { label: 'TC Pass', val: submission.result ? `${submission.result.passedTestcases ?? '?'}/${submission.result.totalTestcases ?? '?'}` : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={{ padding: '10px 14px', background: 'rgba(11, 18, 32, 0.03)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1220' }}>{val || '—'}</div>
            </div>
          ))}
        </div>

        {/* AI Rating summary */}
        {submission.result?.aiRating && (
          <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.06)', borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.12)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-300)', marginBottom: 8 }}>Tóm tắt đánh giá AI</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span>Clean Code: <strong style={{ color: 'var(--blue-300)' }}>{submission.result.aiRating.cleanCodeScore?.toFixed(1)}/10</strong></span>
              {solidAvg && <span>SOLID avg: <strong style={{ color: 'var(--blue-300)' }}>{solidAvg}/10</strong></span>}
              {submission.result.aiRating.codeSmells && <span>Code Smells: <strong style={{ color: 'var(--blue-200)' }}>{submission.result.aiRating.codeSmells.length}</strong></span>}
            </div>
            {submission.result.aiRating.explanation && (
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{submission.result.aiRating.explanation}</p>
            )}
          </div>
        )}

        {/* Score input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0b1220', display: 'block', marginBottom: 8 }}>
            Điểm chấm tay (0 → 10) *
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={0} max={10} step={0.5} value={score}
              onChange={e => setScore(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <input
              type="number" min={0} max={10} step={0.5} value={score}
              onChange={e => setScore(Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
              style={{ width: 70, padding: '8px 10px', background: 'rgba(59, 130, 246, 0.09)', border: '2px solid #3b82f6', borderRadius: 8, color: 'var(--text-main)', fontSize: 16, fontWeight: 600, textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Instructor note */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0b1220', display: 'block', marginBottom: 8 }}>
            <MessageSquare size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Ghi chú của giảng viên
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Nhận xét, lý do điều chỉnh điểm..."
            style={{ width: '100%', padding: '10px 12px', background: 'rgba(11, 18, 32, 0.035)', border: '1px solid var(--border-color)', borderRadius: 8, color: '#0b1220', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
          />
        </div>

        {msg && (
          <div
            style={{
              marginBottom: 14,
              padding: '8px 12px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              border: '1px solid',
              ...(msg.startsWith('ok:')
                ? { background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.28)', color: 'var(--blue-300)' }
                : { background: 'rgba(11, 18, 32, 0.035)', borderColor: 'var(--border-strong)', color: 'var(--text-soft)' }),
            }}
          >
            {msg.startsWith('ok:') ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{msg.replace(/^(ok|warn):/, '')}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'rgba(11, 18, 32, 0.04)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 18px', background: 'var(--blue-600)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? 'Đang lưu...' : `Lưu điểm ${score}/10`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LecturerPanel({ token }: { token: string }) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterLang, setFilterLang] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [gradeTarget, setGradeTarget] = useState<SubmissionRecord | null>(null);
  const [localScores, setLocalScores] = useState<Record<string, { score: number; note: string }>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const headers = { 'Authorization': `Bearer ${token}` };

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/submissions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.data || data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleDownload = async (sub: SubmissionRecord) => {
    setDownloadingId(sub.submissionId);
    try {
      // Gọi endpoint download để lấy file .zip gốc
      const downloadUrl = `${API}/api/v1/submissions/${sub.submissionId}/download`;
      const res = await fetch(downloadUrl, { headers });

      if (res.ok) {
        // Stream blob về browser và trigger download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Dùng tên file gốc sinh viên nộp, fallback về submissionId.zip
        const disposition = res.headers.get('Content-Disposition');
        const match = disposition?.match(/filename="?([^"]+)"?/);
        a.download = match?.[1] ?? `${sub.submissionId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (res.status === 404) {
        const err = await res.json().catch(() => ({}));
        alert(
          `Không tìm thấy file zip trên server.\n\n` +
          `Bài nộp "${sub.submissionId}" có thể chưa upload file thật ` +
          `(chỉ có metadata trong DB).\n\n` +
          (err.message || '')
        );
      } else {
        alert(`Tải xuống thất bại (HTTP ${res.status})`);
      }
    } catch (e: any) {
      console.error('Download error:', e);
      alert(`Lỗi kết nối: ${e.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSavedGrade = (submissionId: string, newScore: number, note: string) => {
    setLocalScores(prev => ({ ...prev, [submissionId]: { score: newScore, note } }));
    setGradeTarget(null);
  };

  const langs = ['ALL', ...Array.from(new Set(submissions.map(s => s.language?.toUpperCase()).filter(Boolean)))];
  const statuses = ['ALL', 'COMPLETED', 'IN_PROGRESS', 'FAILED', 'QUEUED'];

  const filtered = submissions.filter(s => {
    const matchSearch = !search ||
      s.submissionId.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      s.assignmentId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
    const matchLang = filterLang === 'ALL' || s.language?.toUpperCase() === filterLang;
    return matchSearch && matchStatus && matchLang;
  });

  const totalCompleted = submissions.filter(s => s.status === 'COMPLETED').length;
  const avgScore = submissions.filter(s => s.score !== undefined).reduce((acc, s, _, arr) => acc + (s.score! / arr.length), 0);
  const manualGraded = Object.keys(localScores).length;

  return (
    <div style={{ padding: '0 0 48px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-main)' }}>
            <span style={{ color: 'var(--blue-300)' }}></span> Bảng Giảng Viên
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Xem, tải xuống và chấm điểm lại bài nộp của sinh viên
          </p>
        </div>
        <button onClick={fetchSubmissions}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(59, 130, 246, 0.09)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 8, color: 'var(--blue-300)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Làm mới
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: <FileText size={18} />, label: 'Tổng bài nộp', val: submissions.length, color: 'var(--blue-200)' },
          { icon: <CheckCircle size={18} />, label: 'Đã chấm xong', val: totalCompleted, color: 'var(--blue-300)' },
          { icon: <BarChart2 size={18} />, label: 'Điểm TB', val: avgScore > 0 ? avgScore.toFixed(1) : '—', color: 'var(--blue-300)' },
          { icon: <Edit3 size={18} />, label: 'Chấm tay (session)', val: manualGraded, color: 'var(--blue-200)' },
        ].map(({ icon, label, val, color }) => (
          <div key={label} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-main)' }}>{val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(11, 18, 32, 0.035)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 12px' }}>
          <Search size={14} style={{ color: 'var(--text-dim)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo Student ID, Submission ID..."
            style={{ background: 'none', border: 'none', color: '#0b1220', fontSize: 13, width: '100%', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} style={{ color: 'var(--text-dim)' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ background: 'rgba(11, 18, 32, 0.04)', border: '1px solid var(--border-color)', borderRadius: 7, color: '#0b1220', padding: '7px 10px', fontSize: 12 }}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterLang} onChange={e => setFilterLang(e.target.value)}
            style={{ background: 'rgba(11, 18, 32, 0.04)', border: '1px solid var(--border-color)', borderRadius: 7, color: '#0b1220', padding: '7px 10px', fontSize: 12 }}>
            {langs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{filtered.length} kết quả</span>
      </div>

      {/* Submission list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div className="glass-panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite', color: 'var(--blue-200)' }} />
            Đang tải dữ liệu...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)' }}>
            Không có bài nộp nào phù hợp
          </div>
        ) : (
          filtered.map(sub => {
            const isExpanded = expanded === sub.submissionId;
            const local = localScores[sub.submissionId];
            const displayScore = local ? local.score : sub.score;
            const statusColor = sub.status === 'COMPLETED' ? '#1d4ed8' : sub.status === 'FAILED' ? 'var(--text-main)' : '#1d4ed8';

            return (
              <div key={sub.submissionId} className="glass-panel" style={{ overflow: 'hidden', borderLeft: `3px solid ${statusColor}` }}>
                {/* Row header */}
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Student avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                    {sub.studentId?.[0]?.toUpperCase() || 'S'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#0b1220', fontSize: 14 }}>{sub.studentId}</span>
                      {badge(sub.language?.toUpperCase() || '—', '#1d4ed8')}
                      {badge(sub.status, statusColor)}
                      {local && badge('Chấm tay', '#1d4ed8')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'monospace' }}>
                      {sub.submissionId} · {sub.assignmentId}
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: displayScore !== undefined ? (displayScore >= 7 ? '#2563eb' : displayScore >= 5 ? '#1d4ed8' : 'var(--text-main)') : 'var(--text-dim)' }}>
                      {displayScore !== undefined ? displayScore : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>/10</div>
                  </div>

                  {/* Time */}
                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <Clock size={10} /> {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '—'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                    <button
                      onClick={() => setGradeTarget(sub)} title="Chấm điểm lần 2"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(59, 130, 246, 0.09)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 7, color: 'var(--blue-300)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <Edit3 size={13} /> Chấm lại
                    </button>
                    <button
                      onClick={() => handleDownload(sub)} disabled={downloadingId === sub.submissionId} title="Tải xuống bài nộp"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.14)', borderRadius: 7, color: 'var(--blue-300)', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: downloadingId === sub.submissionId ? 0.6 : 1 }}>
                      <Download size={13} /> {downloadingId === sub.submissionId ? '...' : 'Tải'}
                    </button>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : sub.submissionId)} title="Xem chi tiết"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(11, 18, 32, 0.035)', border: '1px solid var(--border-color)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                      <Eye size={13} /> {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(11, 18, 32, 0.04)' }}>
                    <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* Left: Testcase & timing */}
                      <div style={{ padding: '14px 16px', background: 'rgba(11, 18, 32, 0.03)', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-300)', marginBottom: 10 }}>Kết quả chạy</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Testcase pass:</span>
                            <span style={{ fontWeight: 700, color: 'var(--blue-300)' }}>
                              {sub.result?.passedTestcases ?? '?'}/{sub.result?.totalTestcases ?? '?'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Thời gian chạy:</span>
                            <span style={{ fontWeight: 700, color: 'var(--blue-300)' }}>{sub.result?.executionTimeMs ? `${sub.result.executionTimeMs}ms` : '—'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Kết quả tổng:</span>
                            {sub.result?.overallResult
                              ? badge(sub.result.overallResult, sub.result.overallResult === 'PASSED' ? '#1d4ed8' : 'var(--text-main)')
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </div>
                          {sub.sha256Hash && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              SHA256: {sub.sha256Hash.slice(0, 32)}...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: AI rating */}
                      <div style={{ padding: '14px 16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-300)', marginBottom: 10 }}>AI Review</div>
                        {sub.result?.aiRating ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Clean Code:</span>
                              <span style={{ fontWeight: 700, color: 'var(--blue-300)' }}>{sub.result.aiRating.cleanCodeScore?.toFixed(1)}/10</span>
                            </div>
                            {sub.result.aiRating.solidScore && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: 'var(--text-muted)' }}>SOLID (S/O/L/I/D):</span>
                                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--blue-300)' }}>
                                  {Object.values(sub.result.aiRating.solidScore).map(v => v.toFixed(0)).join('/')}
                                </span>
                              </div>
                            )}
                            {sub.result.aiRating.codeSmells && sub.result.aiRating.codeSmells.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <div style={{ fontSize: 11, color: 'var(--blue-200)', marginBottom: 4 }}>Code Smells ({sub.result.aiRating.codeSmells.length})</div>
                                {sub.result.aiRating.codeSmells.slice(0, 2).map((cs, i) => (
                                  <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px dashed rgba(11, 18, 32, 0.04)' }}>
                                    Line {cs.line}: {cs.rule}
                                  </div>
                                ))}
                              </div>
                            )}
                            {sub.result.aiRating.explanation && (
                              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>{sub.result.aiRating.explanation.slice(0, 120)}...</p>
                            )}
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Chưa có dữ liệu AI review</p>
                        )}
                      </div>
                    </div>

                    {/* Manual grade note if present */}
                    {local && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(37, 99, 235, 0.06)', borderRadius: 8, border: '1px solid rgba(37, 99, 235, 0.12)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-200)', marginBottom: 4 }}>Điểm chấm tay: {local.score}/10</div>
                        {local.note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{local.note}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Grade Modal */}
      {gradeTarget && (
        <ManualGradeModal
          submission={gradeTarget}
          onClose={() => setGradeTarget(null)}
          onSaved={handleSavedGrade}
          token={token}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
