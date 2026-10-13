import { useState, useEffect, useCallback } from 'react';
import {
  Users, Activity, Server, Database, Shield, RefreshCw,
  Trash2, RotateCcw, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Cpu, BarChart2, Settings,
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
    backgroundColor: `${color}22`, color, border: `1px solid ${color}44`,
  }}>{text}</span>
);

const statCard = (icon: React.ReactNode, label: string, value: string | number, sub?: string, color = '#6366f1') => (
  <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

export function AdminDashboard({ token }: { token: string }) {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [dlqJobs, setDlqJobs] = useState<DLQJob[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
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
    if (res.ok) { setActionMsg('✅ Đã đưa job vào hàng đợi lại!'); fetchAll(); }
    else setActionMsg('❌ Thất bại khi retry job.');
    setTimeout(() => setActionMsg(''), 3000);
  };

  const deleteDLQ = async (dlqId: string) => {
    const res = await fetch(`${API}/api/v1/queue/dlq/${dlqId}`, { method: 'DELETE', headers });
    if (res.ok) { setActionMsg('🗑️ Đã xóa job khỏi DLQ.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const purgeDLQ = async () => {
    if (!confirm('Xác nhận xóa toàn bộ DLQ?')) return;
    const res = await fetch(`${API}/api/v1/queue/dlq/purge`, { method: 'POST', headers });
    if (res.ok) { setActionMsg('🗑️ Đã purge toàn bộ DLQ.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(`Xác nhận xóa user ${userId}?`)) return;
    const res = await fetch(`${API}/api/v1/users/${userId}`, { method: 'DELETE', headers });
    if (res.ok) { setActionMsg('✅ Đã xóa user.'); fetchAll(); }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const tabs = [
    { key: 'overview', label: 'Tổng quan', icon: <BarChart2 size={14} /> },
    { key: 'users', label: `Người dùng (${users.length})`, icon: <Users size={14} /> },
    { key: 'submissions', label: `Bài nộp (${submissions.length})`, icon: <Activity size={14} /> },
    { key: 'dlq', label: `DLQ ${dlqJobs.length > 0 ? `(${dlqJobs.length})` : ''}`, icon: <AlertTriangle size={14} /> },
    { key: 'settings', label: 'Cài đặt', icon: <Settings size={14} /> },
  ];

  const roleColor: Record<string, string> = { ADMIN: '#f59e0b', INSTRUCTOR: '#818cf8', HOD: '#c084fc', STUDENT: '#10b981' };

  return (
    <div style={{ padding: '0 0 48px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
            <span style={{ color: '#f59e0b' }}>⚙️</span> Admin Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Quản trị hệ thống AITA-Intelligent — Toàn quyền điều hành
          </p>
        </div>
        <button
          onClick={fetchAll}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Làm mới
        </button>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10b981', fontSize: 13 }}>
          {actionMsg}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid var(--border-color)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: activeTab === tab.key ? '#818cf8' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {statCard(<Users size={20} />, 'Tổng người dùng', users.length, `${users.filter(u => u.role === 'STUDENT').length} sinh viên`, '#10b981')}
            {statCard(<Activity size={20} />, 'Tổng bài nộp', submissions.length, `${submissions.filter(s => s.status === 'COMPLETED').length} đã chấm xong`)}
            {statCard(<Server size={20} />, 'Queue Mode', queueStats?.mode || '—', queueStats?.isRedisAvailable ? 'Redis Online' : 'In-Memory Fallback', queueStats?.isRedisAvailable ? '#10b981' : '#f59e0b')}
            {statCard(<AlertTriangle size={20} />, 'Dead Letter Queue', queueStats?.dlqCount ?? dlqJobs.length, 'job thất bại', '#f43f5e')}
            {statCard(<Cpu size={20} />, 'Active Jobs', queueStats?.activeCount ?? 0, `Đang chấm bài`, '#06b6d4')}
            {statCard(<Database size={20} />, 'Completed', queueStats?.completedCount ?? 0, 'bài đã chấm xong', '#8b5cf6')}
          </div>

          {/* Queue Status Card */}
          {queueStats && (
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>🔴 BullMQ Queue Status</h3>
                {badge(queueStats.mode, queueStats.mode === 'REDIS' ? '#10b981' : '#f59e0b')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {[
                  { label: 'Waiting', val: queueStats.waitingCount, color: '#f59e0b' },
                  { label: 'Active', val: queueStats.activeCount, color: '#06b6d4' },
                  { label: 'Completed', val: queueStats.completedCount, color: '#10b981' },
                  { label: 'Failed', val: queueStats.failedCount, color: '#f43f5e' },
                  { label: 'DLQ', val: queueStats.dlqCount, color: '#c084fc' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px', background: `${color}11`, borderRadius: 10, border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              {queueStats.isCongested && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', fontSize: 12 }}>
                  ⚠️ Hàng đợi đang bị tắc nghẽn! Số lượng job đang chờ vượt ngưỡng.
                </div>
              )}
            </div>
          )}

          {/* Recent Submissions */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📋 Bài nộp gần đây</h3>
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
                  <tr key={s.submissionId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#818cf8' }}>{s.submissionId.slice(0, 16)}...</td>
                    <td style={{ padding: '10px 12px', color: '#f3f4f6' }}>{s.studentId}</td>
                    <td style={{ padding: '10px 12px' }}>{badge(s.language?.toUpperCase() || 'N/A', '#06b6d4')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {badge(s.status, s.status === 'COMPLETED' ? '#10b981' : s.status === 'FAILED' ? '#f43f5e' : '#f59e0b')}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#10b981' : 'var(--text-dim)' }}>
                      {s.score !== undefined ? `${s.score}/10` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN') : '—'}
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
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>👥 Quản lý người dùng</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['TẤT CẢ', 'ADMIN', 'INSTRUCTOR', 'STUDENT'].map(r => (
                <span key={r} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#818cf8', cursor: 'pointer' }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
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
                <tr key={u.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#818cf8' }}>{u.userId}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f3f4f6' }}>{u.fullName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>{badge(u.role, roleColor[u.role] || '#9ca3af')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.isActive
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12 }}><CheckCircle size={12} /> Active</span>
                      : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f43f5e', fontSize: 12 }}><XCircle size={12} /> Inactive</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => deleteUser(u.userId)} title="Xóa user"
                        style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 6, color: '#f43f5e', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Trash2 size={12} /> Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>📄 Tất cả bài nộp</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Submission ID', 'Student', 'Assignment', 'Language', 'Trạng thái', 'Điểm', 'Thời gian nộp'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.submissionId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#818cf8' }}>{s.submissionId}</td>
                  <td style={{ padding: '10px 12px', color: '#f3f4f6' }}>{s.studentId}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{s.assignmentId}</td>
                  <td style={{ padding: '10px 12px' }}>{badge(s.language?.toUpperCase() || '—', '#06b6d4')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {badge(s.status, s.status === 'COMPLETED' ? '#10b981' : s.status === 'FAILED' ? '#f43f5e' : '#f59e0b')}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: s.score !== undefined ? '#10b981' : 'var(--text-dim)' }}>
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
      )}

      {/* DLQ TAB */}
      {activeTab === 'dlq' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>☠️ Dead Letter Queue (DLQ)</h3>
            {dlqJobs.length > 0 && (
              <button onClick={purgeDLQ} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <Trash2 size={13} /> Purge All DLQ
              </button>
            )}
          </div>
          {dlqJobs.length === 0 ? (
            <div className="glass-panel" style={{ padding: 48, textAlign: 'center' }}>
              <CheckCircle size={40} style={{ color: '#10b981', margin: '0 auto 12px' }} />
              <p style={{ color: '#10b981', fontWeight: 600 }}>DLQ sạch — Không có job thất bại!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dlqJobs.map(job => (
                <div key={job.dlqId} className="glass-panel" style={{ padding: 16, borderLeft: '3px solid #f43f5e' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#f43f5e' }}>{job.dlqId}</span>
                        {badge(`${job.attemptsMade} attempts`, '#f59e0b')}
                        {badge(job.status, '#f43f5e')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Submission: <span style={{ color: '#818cf8' }}>{job.submissionId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                        {job.failedReason}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                      <button onClick={() => retryDLQ(job.dlqId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, color: '#818cf8', cursor: 'pointer', fontSize: 12 }}>
                        <RotateCcw size={12} /> Retry
                      </button>
                      <button onClick={() => deleteDLQ(job.dlqId)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 6, color: '#f43f5e', cursor: 'pointer', fontSize: 12 }}>
                        <Trash2 size={12} /> Xóa
                      </button>
                      <button onClick={() => setExpandedDLQ(expandedDLQ === job.dlqId ? null : job.dlqId)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 8px', cursor: 'pointer' }}>
                        {expandedDLQ === job.dlqId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                  {expandedDLQ === job.dlqId && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={12} /> Tạo lúc: {job.createdAt ? new Date(job.createdAt).toLocaleString('vi-VN') : '—'}
                      </div>
                      <div>DLQ ID: <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{job.dlqId}</span></div>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>⚙️ Cấu hình hệ thống</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { label: 'JWT Expiry', val: '24 giờ (86400s)', icon: <Shield size={16} /> },
              { label: 'OTP TTL', val: '5 phút', icon: <Clock size={16} /> },
              { label: 'Max File Upload', val: '10 MB (.zip)', icon: <Database size={16} /> },
              { label: 'BullMQ Max Retries', val: '3 lần', icon: <RotateCcw size={16} /> },
              { label: 'Queue Mode', val: queueStats?.mode || '—', icon: <Server size={16} /> },
              { label: 'Redis', val: queueStats?.isRedisAvailable ? '✅ Online' : '⚠️ Offline (In-Memory)', icon: <Activity size={16} /> },
            ].map(({ label, val, icon }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  <span style={{ color: '#818cf8' }}>{icon}</span>
                  {label}
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
