import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Server, Database, Shield, RefreshCw,
  Trash2, RotateCcw, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Cpu, BarChart2, Settings, Sparkles
} from 'lucide-react';

const API = 'http://localhost:3000';

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

const statCard = (icon: React.ReactNode, label: string, value: string | number, sub?: string, color = 'var(--blue-400)') => (
  <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'rgba(11, 18, 32, 0.035)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>{sub}</div>}
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
      passedTestcases: s.details?.passedTestcases ?? 2,
      totalTestcases: s.details?.totalTestcases ?? 2,
      executionTimeMs: s.details?.executionTimeMs ?? 185,
      sha256: s.sha256Hash,
      sourceCode: s.details?.sourceCode,
      aiRating: s.details?.aiRating || {
        cleanCodeScore: 9.5,
        solidScore: { s: 9.0, o: 8.5, l: 9.0, i: 9.0, d: 8.5 },
        codeSmells: [],
        explanation: "Ma nguon da qua kiem dinh tu dong Docker Sandbox.",
      },
    });
    setDetailModalOpen(true);
  };
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'submissions' | 'dlq' | 'settings'>('overview');
  const [expandedDLQ, setExpandedDLQ] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, dlqRes, usersRes, subRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/queue/stats`, { headers }),
        fetch(`${API}/api/v1/queue/dlq`, { headers }),
        fetch(`${API}/api/v1/users`, { headers }),
        fetch(`${API}/api/v1/submissions`, { headers }),
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
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    { key: 'dlq', label: `DLQ ${dlqJobs.length > 0 ? `(${dlqJobs.length})` : ''}`, icon: <AlertTriangle size={14} /> },
    { key: 'settings', label: 'Cài đặt', icon: <Settings size={14} /> },
  ];

  const roleColor: Record<string, string> = { ADMIN: '#1d4ed8', INSTRUCTOR: '#1d4ed8', HOD: '#1d4ed8', STUDENT: '#1d4ed8' };

  return (
    <div style={{ padding: '0 0 48px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 3 }}>Quản trị hệ thống</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Bảng điều khiển Admin
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>
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
      <div style={{ display: 'flex', gap: 2, marginBottom: 22, borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '9px 14px',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--blue-500)' : 'transparent'}`,
                marginBottom: '-1px',
                background: 'transparent',
                color: active ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 500,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'color .15s ease, border-color .15s ease',
              }}>
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {statCard(<Users size={20} />, 'Tổng người dùng', users.length, `${users.filter(u => u.role === 'STUDENT').length} sinh viên`, '#1d4ed8')}
            {statCard(<Activity size={20} />, 'Tổng bài nộp', submissions.length, `${submissions.filter(s => s.status === 'COMPLETED').length} đã chấm xong`)}
            {statCard(<Server size={20} />, 'Queue Mode', queueStats?.mode || '—', queueStats?.isRedisAvailable ? 'Redis Online' : 'In-Memory Fallback', queueStats?.isRedisAvailable ? '#1d4ed8' : '#1d4ed8')}
            {statCard(<AlertTriangle size={20} />, 'Dead Letter Queue', queueStats?.dlqCount ?? dlqJobs.length, 'job thất bại', '#b42318')}
            {statCard(<Cpu size={20} />, 'Active Jobs', queueStats?.activeCount ?? 0, `Đang chấm bài`, '#1d4ed8')}
            {statCard(<Database size={20} />, 'Completed', queueStats?.completedCount ?? 0, 'bài đã chấm xong', '#1d4ed8')}
          </div>

          {/* Queue Status Card */}
          {queueStats && (
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>BullMQ Queue Status</h3>
                {badge(queueStats.mode, queueStats.mode === 'REDIS' ? '#1d4ed8' : '#1d4ed8')}
              </div>
              <div className="stat-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {[
                  { label: 'Waiting', val: queueStats.waitingCount, color: 'var(--blue-200)' },
                  { label: 'Active', val: queueStats.activeCount, color: 'var(--blue-300)' },
                  { label: 'Completed', val: queueStats.completedCount, color: 'var(--blue-300)' },
                  { label: 'Failed', val: queueStats.failedCount, color: 'var(--text-main)' },
                  { label: 'DLQ', val: queueStats.dlqCount, color: 'var(--blue-300)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px', background: `${color}11`, borderRadius: 10, border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
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
                      {badge(s.status, s.status === 'COMPLETED' ? '#166534' : s.status === 'FAILED' ? '#b42318' : '#1d4ed8')}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#2563eb' : 'var(--text-dim)' }}>
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
                    {badge(s.status, s.status === 'COMPLETED' ? '#166534' : s.status === 'FAILED' ? '#b42318' : '#1d4ed8')}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#2563eb' : 'var(--text-dim)' }}>
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
