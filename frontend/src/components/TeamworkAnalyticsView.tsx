import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  GitCommit,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Info,
} from 'lucide-react';
import type { TeamworkMetric } from '../types';
import { API_BASE_URL } from '../config/api';

interface TeamworkAnalyticsViewProps {
  apiBaseUrl?: string;
  token?: string;
  classId?: string;
}

export const TeamworkAnalyticsView: React.FC<TeamworkAnalyticsViewProps> = ({
  apiBaseUrl = API_BASE_URL,
  token,
  classId: initialClassId,
}) => {
  const [metrics, setMetrics] = useState<TeamworkMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(initialClassId || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = selectedClass && selectedClass !== 'ALL'
        ? `${apiBaseUrl}/api/v1/teamwork-metrics/class/${encodeURIComponent(selectedClass)}`
        : `${apiBaseUrl}/api/v1/teamwork-metrics`;

      const res = await fetch(url, { headers });
      const json = await res.json();
      if (res.ok && json.data) {
        setMetrics(json.data);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải chỉ số đóng góp Git:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token, selectedClass]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  // Đồng bộ thời gian thực từ Git log CLI qua API
  const handleSyncGit = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiBaseUrl}/api/v1/teamwork-metrics/sync-git`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();

      if (res.ok) {
        setStatusMessage({
          text: `Đồng bộ thành công từ Git CLI! Đã nạp ${json.total || 0} bản ghi, phát hiện ${json.freeRidersCount || 0} cảnh báo.`,
          type: 'success',
        });
        await fetchMetrics();
      } else {
        setStatusMessage({
          text: json.message || 'Đồng bộ Git thất bại!',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: 'Lỗi kết nối khi đồng bộ Git log: ' + err.message,
        type: 'error',
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Danh sách các lớp học
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach((m) => {
      if (m.classId) set.add(m.classId);
    });
    return Array.from(set);
  }, [metrics]);

  // Lọc theo tìm kiếm
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      const matchSearch =
        !searchQuery.trim() ||
        (m.studentName && m.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.studentId && m.studentId.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchClass = selectedClass === 'ALL' || m.classId === selectedClass;
      return matchSearch && matchClass;
    });
  }, [metrics, searchQuery, selectedClass]);

  // Thống kê KPI tổng quan
  const stats = useMemo(() => {
    const totalMembers = filteredMetrics.length;
    const totalCommits = filteredMetrics.reduce((sum, m) => sum + (m.commitCount || 0), 0);
    const totalAdded = filteredMetrics.reduce((sum, m) => sum + (m.linesAdded || 0), 0);
    const totalDeleted = filteredMetrics.reduce((sum, m) => sum + (m.linesDeleted || 0), 0);
    const freeRiders = filteredMetrics.filter((m) => m.isFreeRider).length;

    return {
      totalMembers,
      totalCommits,
      totalAdded,
      totalDeleted,
      freeRiders,
    };
  }, [filteredMetrics]);

  // Xuất file CSV báo cáo
  const handleExportCSV = () => {
    if (filteredMetrics.length === 0) return;
    const headers = ['Mã SV', 'Họ và Tên', 'Lớp', 'Số Commits', 'Dòng thêm (+)', 'Dòng xóa (-)', 'Tỷ lệ đóng góp (%)', 'Trạng thái Free-rider'];
    const rows = filteredMetrics.map((m) => [
      m.studentId,
      `"${m.studentName || ''}"`,
      m.classId,
      m.commitCount,
      m.linesAdded,
      m.linesDeleted,
      `${m.contributionPct}%`,
      m.isFreeRider ? 'FREE-RIDER (<10%)' : 'ĐẠT CHUẨN',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AITA_Teamwork_Metrics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '36px' }}>
      {/* HEADER PHÂN HỆ 5 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 className="aita-page-title" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)' }}>
            Theo dõi Đóng góp Nhóm &amp; Chống Free-Riding
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Hệ thống tự động đọc lịch sử Git CLI (<code style={{ fontSize: '12px', padding: '1px 5px', background: '#f1f5f9', borderRadius: '4px' }}>git log --shortstat</code>), phân tích số commit, dòng mã nguồn đóng góp và cảnh báo sinh viên ỷ lại.
          </p>
        </div>

        {/* Nút hành động */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSyncGit}
            disabled={syncing}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{syncing ? 'Đang đọc Git log...' : 'Đồng bộ từ Git Log'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {statusMessage && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: statusMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${statusMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: statusMessage.type === 'success' ? '#166534' : '#991b1b',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 4 THẺ THỐNG KÊ KPI */}
      <div className="aita-grid-4" style={{ marginBottom: '24px' }}>
        {/* Card 1: Tổng thành viên */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid #0E4274' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Thành viên theo dõi</span>
            <Users size={18} style={{ color: '#0E4274' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalMembers}</div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>Tổng số thành viên trong CSDL</p>
        </div>

        {/* Card 2: Tổng commits */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tổng số Commits</span>
            <GitCommit size={18} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalCommits}</div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>Ghi nhận từ lịch sử repository</p>
        </div>

        {/* Card 3: Tổng LOC */}
        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Dòng code đóng góp (LOC)</span>
            <FileCode size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
            <span style={{ color: '#16a34a' }}>+{stats.totalAdded.toLocaleString()}</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 4px', fontSize: '14px' }}>/</span>
            <span style={{ color: '#dc2626', fontSize: '16px' }}>-{stats.totalDeleted.toLocaleString()}</span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>Dòng code thêm &amp; xóa thực tế</p>
        </div>

        {/* Card 4: Free-riders phát hiện */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            borderLeft: `4px solid ${stats.freeRiders > 0 ? '#dc2626' : '#16a34a'}`,
            backgroundColor: stats.freeRiders > 0 ? 'rgba(239, 68, 68, 0.03)' : 'inherit',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Cảnh báo Free-rider</span>
            {stats.freeRiders > 0 ? (
              <ShieldAlert size={18} style={{ color: '#dc2626' }} />
            ) : (
              <ShieldCheck size={18} style={{ color: '#16a34a' }} />
            )}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: stats.freeRiders > 0 ? '#dc2626' : '#16a34a' }}>
            {stats.freeRiders}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
            {stats.freeRiders > 0 ? 'Sinh viên có đóng góp < 10%' : 'Tất cả đều đạt chuẩn đóng góp'}
          </p>
        </div>
      </div>

      {/* THANH TÌM KIẾM & LỌC */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 280px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            />
            <input
              type="text"
              placeholder="Tìm theo MSSV hoặc họ tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
            />
          </div>

          {availableClasses.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--text-dim)' }} />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input-field"
                style={{ fontSize: '13px', height: '36px', padding: '0 8px' }}
              >
                <option value="ALL">Tất cả lớp học</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Hiển thị <strong>{filteredMetrics.length}</strong> / {metrics.length} thành viên
        </div>
      </div>

      {/* BẢNG DỮ LIỆU ĐÓNG GÓP THÀNH VIÊN */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: 0, marginBottom: '24px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(14, 66, 116, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-main)' }}>Sinh viên</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Lớp học phần</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Số Commits</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Dòng code (+ / -)</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-main)', minWidth: '180px' }}>Tỷ lệ đóng góp (%)</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>Trạng thái Liêm chính</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
                    <p>Đang tải dữ liệu đóng góp Git...</p>
                  </td>
                </tr>
              ) : filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    <Users size={24} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <p>Không tìm thấy thành viên nào phù hợp với bộ lọc.</p>
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((item) => {
                  const pct = Math.min(100, Math.max(0, item.contributionPct || 0));
                  const isFree = item.isFreeRider || pct < 10.0;
                  const progressColor = isFree ? '#dc2626' : pct >= 25 ? '#16a34a' : '#2563eb';

                  return (
                    <tr
                      key={item.metricId}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isFree ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                      }}
                    >
                      {/* Cột 1: Thông tin sinh viên */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isFree ? 'rgba(239, 68, 68, 0.1)' : 'rgba(14, 66, 116, 0.08)',
                              color: isFree ? '#dc2626' : '#0E4274',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {(item.studentName || item.studentId).charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {item.studentName || 'Sinh viên'}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{item.studentId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Lớp học */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 500,
                          }}
                        >
                          {item.classId}
                        </span>
                      </td>

                      {/* Cột 3: Commits */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13.5px' }}>
                          {item.commitCount}
                        </span>
                      </td>

                      {/* Cột 4: LOC +/- */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>+{(item.linesAdded || 0).toLocaleString()}</span>
                          <span style={{ color: 'var(--text-dim)', margin: '0 4px' }}>/</span>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>-{(item.linesDeleted || 0).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Cột 5: Thanh tỷ lệ đóng góp */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: progressColor }}>{pct.toFixed(1)}%</span>
                          {isFree && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>Dưới 10%</span>}
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#e2e8f0',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: progressColor,
                              borderRadius: '999px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </td>

                      {/* Cột 6: Trạng thái Free-rider */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {isFree ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              border: '1px solid #fecaca',
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Free-rider (&lt; 10%)</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Đạt chuẩn</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUY CHUẨN ĐỀ CƯƠNG SWP391 */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 22px',
          backgroundColor: 'rgba(14, 66, 116, 0.03)',
          border: '1px solid rgba(14, 66, 116, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Info size={16} style={{ color: '#0E4274' }} />
          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0E4274' }}>
            Quy định đánh giá đóng góp cá nhân
          </h4>
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <li>
            <strong>Ngăn chặn ỷ lại (Free-riding):</strong> Giảng viên và nhóm trưởng đối chiếu trực tiếp tỷ lệ code đóng góp (LOC - Lines of Code, commits và số lượng PRs được chấp nhận) từ Git CLI Parser của từng sinh viên.
          </li>
          <li>
            <strong>Chế tài xử phạt:</strong> Sinh viên có tỷ lệ đóng góp thực tế <strong>dưới 10% (hoặc dưới 5% không có lý do chính đáng)</strong> sẽ bị hội đồng trừ từ <strong>50% đến 100%</strong> điểm số của Milestone đó.
          </li>
          <li>
            Dữ liệu trên bảng được đồng bộ tự động từ Git logs thật qua lệnh <code style={{ fontSize: '11.5px' }}>git log --shortstat</code> và đối chiếu với danh sách tài khoản đã đăng ký trên hệ thống.
          </li>
        </ul>
      </div>
    </div>
  );
};
export default TeamworkAnalyticsView;
