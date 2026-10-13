import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle2, XCircle, Clock, AlertCircle, Search, RefreshCw, MessageSquare, Award } from 'lucide-react';
import type { Appeal } from '../types';

interface LecturerAppealsManagerProps {
  apiBaseUrl?: string;
  lecturerId?: string;
}

export const LecturerAppealsManager: React.FC<LecturerAppealsManagerProps> = ({
  apiBaseUrl = 'http://localhost:3000',
  lecturerId = 'GV001',
}) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [resolutionNote, setResolutionNote] = useState('');
  const [adjustedScore, setAdjustedScore] = useState<number>(9.0);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals`);
      if (res.ok) {
        const json = await res.json();
        setAppeals(json.data || []);
      }
    } catch {
      // Mock data nếu API gateway offline
      setAppeals([
        {
          appealId: 'APL-101-DEMO',
          submissionId: 'SUB-SE170000-01',
          studentId: 'SE170000',
          reason: 'Kính gửi Thầy, bài của em đã tối ưu O(N log N) bằng thuật toán MergeSort nhưng AI chấm điểm SOLID bị trừ 1.5đ ở hàm hiển thị, mong Thầy chấm lại.',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          appealId: 'APL-102-DEMO',
          submissionId: 'SUB-SE170456-02',
          studentId: 'SE170456',
          reason: 'Em xin phúc khảo Testcase 2, em chạy trên Ubuntu local thì PASS nhưng server báo timeout 2.0s.',
          status: 'ACCEPTED',
          reviewerId: 'GV001',
          resolutionNote: 'Đã phúc tra trong Docker sandbox: bộ nhớ đạt 512MB, chấp thuận cộng thêm 1.0 điểm.',
          adjustedScore: 8.5,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 80000000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAppeals();
  }, []);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal) return;
    if (resolutionNote.trim().length < 5) {
      alert('Vui lòng nhập phản hồi giải quyết cụ thể (tối thiểu 5 ký tự)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals/${selectedAppeal.appealId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolveStatus,
          reviewerId: lecturerId,
          resolutionNote: resolutionNote.trim(),
          adjustedScore: resolveStatus === 'ACCEPTED' ? adjustedScore : undefined,
        }),
      });

      if (res.ok) {
        setToastMessage(`Đã xử lý thành công đơn phúc khảo #${selectedAppeal.appealId}`);
        setSelectedAppeal(null);
        setResolutionNote('');
        void fetchAppeals();
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi khi cập nhật đơn phúc khảo');
      }
    } catch {
      // Mock local update
      setAppeals((prev) =>
        prev.map((a) =>
          a.appealId === selectedAppeal.appealId
            ? {
                ...a,
                status: resolveStatus,
                reviewerId: lecturerId,
                resolutionNote: resolutionNote.trim(),
                adjustedScore: resolveStatus === 'ACCEPTED' ? adjustedScore : undefined,
                resolvedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      setToastMessage(`Đã xử lý (offline mode) đơn #${selectedAppeal.appealId}`);
      setSelectedAppeal(null);
      setResolutionNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAppeals = appeals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
            HỘI ĐỒNG PHÚC KHẢO (UC-06 / BR-05)
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            Quản Lý &amp; Phê Duyệt Đơn Khiếu Nại Điểm
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Tiếp nhận khiếu nại của sinh viên trong vòng 48h, đối chiếu kết quả sandbox và điều chỉnh điểm số.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAppeals}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '14px', marginBottom: '20px', fontWeight: 600 }}>
          {toastMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: statusFilter === tab ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: statusFilter === tab ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: statusFilter === tab ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tab === 'ALL' && `Tất Cả (${appeals.length})`}
            {tab === 'PENDING' && `Chờ Duyệt (${appeals.filter((a) => a.status === 'PENDING').length})`}
            {tab === 'ACCEPTED' && `Đã Chấp Thuận (${appeals.filter((a) => a.status === 'ACCEPTED').length})`}
            {tab === 'REJECTED' && `Đã Từ Chối (${appeals.filter((a) => a.status === 'REJECTED').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>MÃ ĐƠN</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>SINH VIÊN</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>BÀI NỘP</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>LÝ DO KHIẾU NẠI</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>TRẠNG THÁI</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppeals.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có đơn phúc khảo nào trong danh mục này.
                </td>
              </tr>
            ) : (
              filteredAppeals.map((app) => (
                <tr key={app.appealId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#818cf8' }}>
                    #{app.appealId}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>
                    {app.studentId}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                    {app.submissionId}
                  </td>
                  <td style={{ padding: '16px 20px', maxWidth: '300px', color: '#cbd5e1' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.reason}>
                      {app.reason}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {app.status === 'ACCEPTED' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                        ĐÃ DUYỆT ({app.adjustedScore}đ)
                      </span>
                    ) : app.status === 'REJECTED' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontWeight: 700 }}>
                        TỪ CHỐI
                      </span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 700 }}>
                        CHỜ DUYỆT
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button
                      onClick={() => {
                        setSelectedAppeal(app);
                        setResolveStatus('ACCEPTED');
                        setResolutionNote(app.resolutionNote || '');
                        setAdjustedScore(app.adjustedScore || 9.0);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        backgroundColor: app.status === 'PENDING' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#818cf8',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {app.status === 'PENDING' ? 'Xử Lý Đơn' : 'Xem Lại'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Xử lý Phúc Khảo */}
      {selectedAppeal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedAppeal(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '600px',
              backgroundColor: '#0f172a',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
              Xử Lý Đơn Phúc Khảo #{selectedAppeal.appealId}
            </h3>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sinh viên: <strong>{selectedAppeal.studentId}</strong> | Bài nộp: <strong>{selectedAppeal.submissionId}</strong></div>
              <div style={{ fontSize: '14px', color: '#e2e8f0', marginTop: '6px', lineHeight: 1.4 }}>
                <strong>Lý do của SV:</strong> {selectedAppeal.reason}
              </div>
            </div>

            <form onSubmit={handleResolve}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  Quyết định của Giảng viên:
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setResolveStatus('ACCEPTED')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: resolveStatus === 'ACCEPTED' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: resolveStatus === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: resolveStatus === 'ACCEPTED' ? '#10b981' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Chấp Thuận Phúc Khảo
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveStatus('REJECTED')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: resolveStatus === 'REJECTED' ? '2px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: resolveStatus === 'REJECTED' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: resolveStatus === 'REJECTED' ? '#f43f5e' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ❌ Từ Chối Khiếu Nại
                  </button>
                </div>
              </div>

              {resolveStatus === 'ACCEPTED' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Điểm số điều chỉnh sau phúc khảo (0 - 10):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={adjustedScore}
                    onChange={(e) => setAdjustedScore(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 700,
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  Phản hồi sư phạm / Ghi chú giải quyết:
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Nhập lý do chấp thuận hoặc giải thích vì sao từ chối cho sinh viên..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedAppeal(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: resolveStatus === 'ACCEPTED'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Đang lưu...' : 'Xác Nhận Quyết Định'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
