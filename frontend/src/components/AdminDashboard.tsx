import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import { TeamworkAnalyticsView } from './TeamworkAnalyticsView';
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Server, Database, Shield, RefreshCw,
  Trash2, RotateCcw, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Cpu, BarChart2, Settings, Sparkles,
  GitCommit, Scale
} from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';
import { getSubmissionStatusStyle } from '../utils/statusStyles';

interface QueueStats {
  queueName: string;
  mode: 'REDIS' | 'IN_MEMORY';
  isRedisAvailable: boolean;
  waitingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  dlqCount: number;
  isCongested: boolean;
  concurrencyLimit: number;
  maxRetries: number;
}

interface DLQJob {
  dlqId: string;
  submissionId: string;
  failedReason: string;
  attemptsMade: number;
  status: string;
  createdAt: string;
}

interface UserRecord {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface SubmissionRecord {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;
  status: string;
  score?: number;
  fileName?: string;
  submittedAt: string;
}

const badge = (text: string, color: string) => (
  <span style={{
    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
    backgroundColor: `${color}1a`, color, border: `1px solid ${color}40`,
  }}>{text}</span>
);

const statCard = (icon: React.ReactNode, label: string, value: string | number, sub?: string, color = '#0E4274') => (
  <div className="aita-card" style={{ padding: '18px 20px', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '14px' }}>
    <div
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid rgba(14, 66, 116, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  </div>
);

export function AdminDashboard({ token }: { token: string }) {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [dlqJobs, setDlqJobs] = useState<DLQJob[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailSubmission, setSelectedDetailSubmission] = useState<SubmissionDetailData | null>(null);

  const handleOpenDetailModal = (s: any) => {
    setSelectedDetailSubmission({
      submissionId: s.submissionId,
      studentId: s.studentId,
      assignmentId: s.assignmentId,
      fileName: s.fileName || 'Solution.zip',
      language: s.language || 'java',
      submittedAt: s.submittedAt || s.createdAt || new Date().toISOString(),
      score: s.score ?? s.details?.score,
      scoreBreakdown: s.details?.scoreBreakdown,
      passedTestcases: s.details?.passedTestcases,
      totalTestcases: s.details?.totalTestcases,
      executionTimeMs: s.details?.executionTimeMs,
      sha256: s.sha256Hash,
      sourceCode: s.details?.sourceCode,
      aiRating: s.details?.aiRating || s.aiRating,
    });
    setDetailModalOpen(true);
  };
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'submissions' | 'dlq' | 'settings' | 'teamwork' | 'appeals'>('overview');
  const [expandedDLQ, setExpandedDLQ] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [appeals, setAppeals] = useState<any[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, dlqRes, usersRes, subRes, appRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/queue/stats`, { headers }),
        fetch(`${API}/api/v1/queue/dlq`, { headers }),
        fetch(`${API}/api/v1/users`, { headers }),
        fetch(`${API}/api/v1/submissions`, { headers }),
        fetch(`${API}/api/v1/appeals`, { headers }),
      ]);

      if (qRes.status === 'fulfilled' && qRes.value.ok) setQueueStats(await qRes.value.json());
      if (dlqRes.status === 'fulfilled' && dlqRes.value.ok) {
        const d = await dlqRes.value.json(); setDlqJobs(d.data || d || []);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const u = await usersRes.value.json(); setUsers(u.data || u || []);
      }
      if (subRes.status === 'fulfilled' && subRes.value.ok) {
        const s = await subRes.value.json(); setSubmissions(s.data || s || []);
      }
      if (appRes.status === 'fulfilled' && appRes.value.ok) {
        const a = await appRes.value.json(); setAppeals(a.data || a || []);
      }
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAssignReviewer = async (appealId: string, reviewerId: string) => {
    if (!reviewerId) {
      alert('Vui lòng chọn Giảng viên cần phân công!');
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/appeals/${appealId}/assign`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ reviewerId }),
      });
      if (res.ok) {
        setActionMsg(`Đã phân công Giảng viên ${reviewerId} chấm phúc khảo đơn #${appealId}!`);
        fetchAll();
      } else {
        const err = await res.json();
        setActionMsg(err.message || 'Lỗi khi phân công giảng viên');
      }
    } catch (e: any) {
      setActionMsg('Lỗi kết nối: ' + e.message);
    }
    setTimeout(() => setActionMsg(''), 4000);
  };

  const retryDLQ = async (dlqId: string) => {
    const res = await fetch(`${API}/api/v1/queue/dlq/retry/${dlqId}`, { method: 'POST', headers });
    if (res.ok) { setActionMsg('Đã đưa job vào hàng đợi lại!'); fetchAll(); }
    else setActionMsg('Thất bại khi retry job.');
    setTimeout(() => setActionMsg(''), 3000);
  };

  const deleteDLQ = async (dlqId: string) => {
    const res = await fetch(`${API}/api/v1/queue/dlq/${dlqId}`, { method: 'DELETE', headers });
    if (res.ok) { setActionMsg('Đã xóa job khỏi DLQ.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const purgeDLQ = async () => {
    if (!confirm('Xác nhận xóa toàn bộ DLQ?')) return;
    const res = await fetch(`${API}/api/v1/queue/dlq/purge`, { method: 'POST', headers });
    if (res.ok) { setActionMsg('Đã purge toàn bộ DLQ.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(`Xác nhận xóa user ${userId}?`)) return;
    const res = await fetch(`${API}/api/v1/users/${userId}`, { method: 'DELETE', headers });
    if (res.ok) { setActionMsg('Đã xóa user.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const tabs = [
    { key: 'overview', label: 'Tổng quan', icon: <BarChart2 size={14} /> },
    { key: 'users', label: `Người dùng (${users.length})`, icon: <Users size={14} /> },
    { key: 'submissions', label: `Bài nộp (${submissions.length})`, icon: <Activity size={14} /> },
    { key: 'appeals', label: `Phúc khảo (${appeals.length})`, icon: <Scale size={14} /> },
    { key: 'teamwork', label: 'Git Teamwork', icon: <GitCommit size={14} /> },
    { key: 'dlq', label: `DLQ ${dlqJobs.length > 0 ? `(${dlqJobs.length})` : ''}`, icon: <AlertTriangle size={14} /> },
    { key: 'settings', label: 'Cài đặt', icon: <Settings size={14} /> },
  ];

  const roleColor: Record<string, string> = { ADMIN: '#1d4ed8', INSTRUCTOR: '#1d4ed8', HOD: '#1d4ed8', STUDENT: '#1d4ed8' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 0 48px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Quản trị hệ thống</p>
          <h1 className="aita-page-title">
            Bảng điều khiển Admin
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Giám sát hàng đợi chấm bài, người dùng và bài nộp toàn hệ thống.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAll}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Làm mới
        </button>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: '9px 14px',
            background: 'rgba(59, 130, 246, 0.07)',
            border: '1px solid var(--border-blue)',
            borderRadius: 8,
            color: 'var(--blue-200)',
            fontSize: 12.5,
          }}
        >
          {actionMsg}
        </div>
      )}

      {/* Tab Navigation */}
      <div role="tablist" aria-label="Quản trị hệ thống" className="aita-tablist" style={{ marginBottom: 22 }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key as any)}
              className={`aita-tab-btn ${active ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          <div className="aita-grid-3" style={{ marginBottom: 24 }}>
            {statCard(<Users size={20} />, 'Tổng người dùng', users.length, `${users.filter(u => u.role === 'STUDENT').length} sinh viên`, '#0E4274')}
            {statCard(<Activity size={20} />, 'Tổng bài nộp', submissions.length, `${submissions.filter(s => s.status === 'COMPLETED').length} đã chấm xong`, '#0E4274')}
            {statCard(<Server size={20} />, 'Queue Mode', queueStats?.mode || '—', queueStats?.isRedisAvailable ? 'Redis Online' : 'In-Memory Fallback', '#0E4274')}
            {statCard(<AlertTriangle size={20} />, 'Dead Letter Queue', queueStats?.dlqCount ?? dlqJobs.length, 'job thất bại', '#b91c1c')}
            {statCard(<Cpu size={20} />, 'Active Jobs', queueStats?.activeCount ?? 0, `Đang chấm bài`, '#175794')}
            {statCard(<Database size={20} />, 'Completed', queueStats?.completedCount ?? 0, 'bài đã chấm xong', '#15803d')}
          </div>

          {/* Queue Status Card */}
          {queueStats && (
            <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>BullMQ Queue Status</h3>
                {badge(queueStats.mode, '#0E4274')}
              </div>
              <div className="stat-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Waiting', val: queueStats.waitingCount, color: '#0E4274', bg: 'rgba(14, 66, 116, 0.06)', border: 'rgba(14, 66, 116, 0.18)' },
                  { label: 'Active', val: queueStats.activeCount, color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.07)', border: 'rgba(29, 78, 216, 0.22)' },
                  { label: 'Completed', val: queueStats.completedCount, color: '#15803d', bg: '#dcfce7', border: '#86efac' },
                  { label: 'Failed', val: queueStats.failedCount, color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
                  { label: 'DLQ', val: queueStats.dlqCount, color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
                ].map(({ label, val, color, bg, border }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '14px 12px', background: bg, borderRadius: 12, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{val}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
                  </div>
                ))}
              </div>
              {queueStats.isCongested && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(11, 18, 32, 0.05)', border: '1px solid rgba(11, 18, 32, 0.1)', borderRadius: 8, color: 'var(--text-main)', fontSize: 12 }}>
                  Hàng đợi đang bị tắc nghẽn! Số lượng job đang chờ vượt ngưỡng.
                </div>
              )}
            </div>
          )}

          {/* Recent Submissions */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Bài nộp gần đây</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Submission ID', 'Student ID', 'Language', 'Trạng thái', 'Điểm', 'Thời gian'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 8).map(s => (
                  <tr key={s.submissionId} style={{ borderBottom: '1px solid rgba(11, 18, 32, 0.03)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--blue-300)' }}>{s.submissionId.slice(0, 16)}...</td>
                    <td style={{ padding: '10px 12px', color: '#0b1220' }}>{s.studentId}</td>
                    <td style={{ padding: '10px 12px' }}>{badge(s.language?.toUpperCase() || 'N/A', '#1d4ed8')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {(() => {
                        const st = getSubmissionStatusStyle(s.status, { score: s.score });
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#0E4274' : 'var(--text-dim)' }}>
                      {s.score !== undefined ? `${s.score}/10` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN') : '—'}
                    </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenDetailModal(s)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        background: "var(--blue-600)",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Sparkles size={11} /> Chi tiết
                    </button>
                  </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>Chưa có bài nộp nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Quản lý người dùng</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['TẤT CẢ', 'ADMIN', 'INSTRUCTOR', 'STUDENT'].map(r => (
                <span key={r} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(59, 130, 246, 0.09)', color: 'var(--blue-300)', cursor: 'pointer' }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['ID', 'Họ tên', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Hành động'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.userId} style={{ borderBottom: '1px solid rgba(11, 18, 32, 0.03)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--blue-300)' }}>{u.userId}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0b1220' }}>{u.fullName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>{badge(u.role, roleColor[u.role] || '#4d5c76')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.isActive
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--state-ok)', fontSize: 12, fontWeight: 600 }}><CheckCircle size={12} /> Active</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--state-bad)', fontSize: 12, fontWeight: 600 }}><XCircle size={12} /> Inactive</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => deleteUser(u.userId)} title="Xóa user"
                        style={{ background: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.1)', borderRadius: 6, color: 'var(--text-main)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Trash2 size={12} /> Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Tất cả bài nộp</h3>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Submission ID', 'Student', 'Assignment', 'Language', 'Trạng thái', 'Điểm', 'Thời gian nộp', 'Thao tác'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.submissionId} style={{ borderBottom: '1px solid rgba(11, 18, 32, 0.03)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--blue-300)' }}>{s.submissionId}</td>
                  <td style={{ padding: '10px 12px', color: '#0b1220' }}>{s.studentId}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{s.assignmentId}</td>
                  <td style={{ padding: '10px 12px' }}>{badge(s.language?.toUpperCase() || '—', '#1d4ed8')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {(() => {
                      const st = getSubmissionStatusStyle(s.status, { score: s.score });
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
                          {st.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#0E4274' : 'var(--text-dim)' }}>
                    {s.score !== undefined ? `${s.score}/10` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* DLQ TAB */}
      {activeTab === 'dlq' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Dead Letter Queue (DLQ)</h3>
            {dlqJobs.length > 0 && (
              <button onClick={purgeDLQ} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.1)', borderRadius: 8, color: 'var(--text-main)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <Trash2 size={13} /> Purge All DLQ
              </button>
            )}
          </div>
          {dlqJobs.length === 0 ? (
            <div className="glass-panel" style={{ padding: 48, textAlign: 'center' }}>
              <CheckCircle size={40} style={{ color: 'var(--blue-300)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--blue-300)', fontWeight: 600 }}>DLQ sạch — Không có job thất bại!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dlqJobs.map(job => (
                <div key={job.dlqId} className="glass-panel" style={{ padding: 16, borderLeft: '3px solid #ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-main)' }}>{job.dlqId}</span>
                        {badge(`${job.attemptsMade} attempts`, '#7d4f00')}
                        {badge(job.status, '#b42318')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Submission: <span style={{ color: 'var(--blue-300)' }}>{job.submissionId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                        {job.failedReason}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                      <button onClick={() => retryDLQ(job.dlqId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(59, 130, 246, 0.09)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 6, color: 'var(--blue-300)', cursor: 'pointer', fontSize: 12 }}>
                        <RotateCcw size={12} /> Retry
                      </button>
                      <button onClick={() => deleteDLQ(job.dlqId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(11, 18, 32, 0.05)', border: '1px solid rgba(11, 18, 32, 0.09)', borderRadius: 6, color: 'var(--text-main)', cursor: 'pointer', fontSize: 12 }}>
                        <Trash2 size={12} /> Xóa
                      </button>
                      <button onClick={() => setExpandedDLQ(expandedDLQ === job.dlqId ? null : job.dlqId)}
                        style={{ background: 'rgba(11, 18, 32, 0.035)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 8px', cursor: 'pointer' }}>
                        {expandedDLQ === job.dlqId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                  {expandedDLQ === job.dlqId && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(11, 18, 32, 0.04)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={12} /> Tạo lúc: {job.createdAt ? new Date(job.createdAt).toLocaleString('vi-VN') : '—'}
                      </div>
                      <div>DLQ ID: <span style={{ fontFamily: 'monospace', color: 'var(--blue-300)' }}>{job.dlqId}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APPEALS MANAGEMENT TAB (PHAN HE 1 & 3: KHOA/BOMON PHAN CONG GIANG VIEN DOC LAP) */}
      {activeTab === 'appeals' && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={18} color="var(--blue-300)" />
                Quản lý Đơn Phúc Khảo &amp; Phân Công Giảng Viên Chấm Độc Lập
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Admin / Trưởng bộ môn tiếp nhận đơn từ sinh viên và phân công cho Giảng viên độc lập chấm phúc tra (tránh thiên vị, bảo đảm khách quan).
              </p>
            </div>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
              Tổng: {appeals.length} đơn ({appeals.filter(a => a.status === 'PENDING').length} chờ phân công)
            </span>
          </div>

          {appeals.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
              <Scale size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p>Hiện chưa có đơn phúc khảo nào trong hệ thống.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(14, 66, 116, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>Mã đơn</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>Sinh viên &amp; Bài nộp</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '280px' }}>Lý do khiếu nại</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)' }}>Giảng viên phân công</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>Thao tác phân công</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map((item) => {
                    const statusColor =
                      item.status === 'ACCEPTED' ? '#15803d' :
                      item.status === 'REJECTED' ? '#b91c1c' :
                      item.status === 'IN_REVIEW' ? '#2563eb' : '#d97706';
                    const statusBg =
                      item.status === 'ACCEPTED' ? '#dcfce7' :
                      item.status === 'REJECTED' ? '#fee2e2' :
                      item.status === 'IN_REVIEW' ? '#eff6ff' : '#fef3c7';

                    const currentSelectedGv = assignMap[item.appealId] || item.reviewerId || '';
                    const availableLecturers = users.filter(u => u.role === 'INSTRUCTOR' || u.role === 'HOD');

                    return (
                      <tr key={item.appealId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0E4274' }}>{item.appealId}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 2 }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.studentId}</div>
                          <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {item.submissionId}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', maxWidth: '280px' }}>
                          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {item.reason}
                          </p>
                          {item.resolutionNote && (
                            <div style={{ marginTop: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4, fontSize: '11.5px', borderLeft: '3px solid #2563eb' }}>
                              <strong>Kết quả:</strong> {item.resolutionNote} {item.adjustedScore !== undefined ? `(Điểm mới: ${item.adjustedScore})` : ''}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusColor}33`,
                            }}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          {item.reviewerId ? (
                            <div>
                              <span style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '12.5px' }}>
                                {item.reviewerId}
                              </span>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {item.resolvedAt ? `Đã xử lý lúc ${new Date(item.resolvedAt).toLocaleTimeString('vi-VN')}` : 'Đang thụ lý'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#d97706', fontStyle: 'italic' }}>
                              Chưa phân công
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                          {item.status === 'ACCEPTED' || item.status === 'REJECTED' ? (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontStyle: 'italic' }}>Đã hoàn tất</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <select
                                value={currentSelectedGv}
                                onChange={(e) => setAssignMap(prev => ({ ...prev, [item.appealId]: e.target.value }))}
                                className="input-field"
                                style={{ fontSize: '12px', height: '30px', padding: '0 6px', maxWidth: '170px' }}
                              >
                                <option value="">-- Chọn Giảng viên --</option>
                                {availableLecturers.map((gv) => (
                                  <option key={gv.userId} value={gv.userId}>
                                    {gv.fullName} ({gv.userId})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAssignReviewer(item.appealId, currentSelectedGv)}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 9px', fontSize: '11.5px' }}
                              >
                                Phân công
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GIT TEAMWORK TAB (PHAN HE 5) */}
      {activeTab === 'teamwork' && (
        <TeamworkAnalyticsView token={token} />
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Cấu hình hệ thống</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { label: 'JWT Expiry', val: '24 giờ (86400s)', icon: <Shield size={16} /> },
              { label: 'OTP TTL', val: '5 phút', icon: <Clock size={16} /> },
              { label: 'Max File Upload', val: '10 MB (.zip)', icon: <Database size={16} /> },
              { label: 'BullMQ Max Retries', val: '3 lần', icon: <RotateCcw size={16} /> },
              { label: 'Queue Mode', val: queueStats?.mode || '—', icon: <Server size={16} /> },
              { label: 'Redis', val: queueStats?.isRedisAvailable ? 'Online' : 'Offline (In-Memory)', icon: <Activity size={16} /> },
            ].map(({ label, val, icon }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(11, 18, 32, 0.025)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  <span style={{ color: 'var(--blue-300)' }}>{icon}</span>
                  {label}
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#0b1220' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Modal Xem Chi Tiet Bai Nop Cho Admin */}
      <SubmissionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        submission={selectedDetailSubmission}
      />
    </div>
  );
}
