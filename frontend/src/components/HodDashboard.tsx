import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Users,
  FileWarning,
  Scale,
  Info,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000';

type HodTab = 'INTEGRITY' | 'APPEALS';

interface PlagiarismReportRow {
  reportId: string;
  assignmentId: string;
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  flaggedAsFraud?: boolean;
  status?: string;
  commonFingerprintsCount?: number;
  evaluatedAt?: string;
  createdAt?: string;
}

interface AppealRow {
  appealId: string;
  submissionId: string;
  studentId: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewerId?: string;
  resolutionNote?: string;
  adjustedScore?: number;
  createdAt?: string;
}

/**
 * Head-of-Department console.
 *
 * The HOD role existed in the schema and the RBAC list but had no screen at all, so signing
 * in as HOD showed the student view and granted nothing. This gives the role the two powers
 * BR-04 and the appeals workflow imply at department level:
 *
 *   1. academic integrity across the whole department — every flagged AST pair, not just the
 *      ones belonging to a single lecturer's assignment;
 *   2. a second-level approval queue for appeals that a lecturer has not resolved.
 *
 * Access is enforced by the API as well: `/api/v1/plagiarism/*` rejects `role=STUDENT`
 * with HTTP 403 (BR-04), so this component cannot leak plagiarism data to a student even if
 * it were rendered for one.
 */
export const HodDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HodTab>('INTEGRITY');
  const [reports, setReports] = useState<PlagiarismReportRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  // `actionMsg` carries BOTH the "đã chấp thuận/từ chối" confirmations and the "Không xử lý
  // được ..." failures. Without this flag a failed approval rendered in the green success banner
  // with a check mark, telling the HOD the opposite of what happened.
  const [actionFailed, setActionFailed] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = `${API_BASE_URL}/api/v1/plagiarism/reports?role=HOD${flaggedOnly ? '&flaggedOnly=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.message || `Không tải được báo cáo đạo văn (HTTP ${res.status}).`);
        setReports([]);
      } else {
        setReports(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err: any) {
      setErrorMsg('Không kết nối được API Gateway: ' + err.message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [flaggedOnly]);

  const loadAppeals = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appeals`);
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.message || `Không tải được danh sách phúc khảo (HTTP ${res.status}).`);
        setAppeals([]);
      } else {
        setAppeals(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err: any) {
      setErrorMsg('Không kết nối được API Gateway: ' + err.message);
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'INTEGRITY') void loadReports();
    else void loadAppeals();
  }, [activeTab, loadReports, loadAppeals]);

  const handleResolveAppeal = async (appeal: AppealRow, decision: 'ACCEPTED' | 'REJECTED') => {
    setActionMsg(null);
    setActionFailed(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appeals/${appeal.appealId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          status: decision,
          reviewerId: 'HOD001',
          resolutionNote:
            decision === 'ACCEPTED'
              ? 'Trưởng bộ môn phê duyệt sau khi phúc tra kết quả chấm.'
              : 'Trưởng bộ môn xác nhận kết quả chấm đúng, không điều chỉnh điểm.',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionFailed(true);
        setActionMsg(`Không xử lý được ${appeal.appealId}: ${json.message || res.status}`);
      } else {
        setActionMsg(`Đã ${decision === 'ACCEPTED' ? 'chấp thuận' : 'từ chối'} đơn ${appeal.appealId}.`);
        await loadAppeals();
      }
    } catch (err: any) {
      setActionFailed(true);
      setActionMsg('Lỗi kết nối: ' + err.message);
    }
  };

  const pendingAppeals = appeals.filter((a) => a.status === 'PENDING');
  const severePairs = reports.filter((r) => (r.similarityRate ?? 0) >= 80);
  const avgSimilarity = reports.length
    ? Math.round((reports.reduce((sum, r) => sum + (r.similarityRate || 0), 0) / reports.length) * 10) / 10
    : 0;

  const card: React.CSSProperties = {
    background: 'rgba(15, 23, 42, 0.55)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '18px',
  };

  const stat = (label: string, value: string | number, color: string, Icon: any) => (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '190px' }}>
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '11px',
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Cổng Trưởng Bộ Môn (HOD)
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              Giám sát liêm chính học thuật toàn bộ môn và phê duyệt phúc khảo cấp bộ môn
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {([
          { key: 'INTEGRITY', label: 'Liêm chính học thuật', Icon: FileWarning },
          { key: 'APPEALS', label: 'Phúc khảo cấp bộ môn', Icon: Scale },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: activeTab === key ? '1px solid rgba(168, 85, 247, 0.6)' : '1px solid var(--border-color)',
              background: activeTab === key ? 'rgba(168, 85, 247, 0.16)' : 'rgba(255,255,255,0.03)',
              color: activeTab === key ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => (activeTab === 'INTEGRITY' ? void loadReports() : void loadAppeals())}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.04)',
            color: '#e5e7eb',
            fontSize: '12.5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {errorMsg && (
        <div
          style={{
            ...card,
            borderColor: 'rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.08)',
            marginBottom: '16px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={16} color="#f43f5e" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: '#fecdd3' }}>{errorMsg}</div>
        </div>
      )}

      {actionMsg && (
        <div
          style={{
            ...card,
            borderColor: actionFailed ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)',
            background: actionFailed ? 'rgba(244, 63, 94, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            marginBottom: '16px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          {actionFailed ? (
            <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
          )}
          <div style={{ fontSize: '13px', color: actionFailed ? '#fecdd3' : '#bbf7d0' }}>{actionMsg}</div>
        </div>
      )}

      {/* ── TAB 1: academic integrity ── */}
      {activeTab === 'INTEGRITY' && (
        <>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {stat('Cặp bài bị gắn cờ', reports.length, '#f43f5e', FileWarning)}
            {stat('Cặp nghiêm trọng (≥80%)', severePairs.length, '#f59e0b', AlertTriangle)}
            {stat('Tương đồng trung bình', `${avgSimilarity}%`, '#38bdf8', Info)}
          </div>

          <div style={{ ...card, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => setFlaggedOnly(e.target.checked)}
              />
              Chỉ hiển thị cặp đã vượt ngưỡng cảnh báo (≥70%)
            </label>
          </div>

          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 14px' }}>Mã báo cáo</th>
                    <th style={{ padding: '12px 14px' }}>Bài tập</th>
                    <th style={{ padding: '12px 14px' }}>Bài A</th>
                    <th style={{ padding: '12px 14px' }}>Bài B</th>
                    <th style={{ padding: '12px 14px' }}>Tương đồng</th>
                    <th style={{ padding: '12px 14px' }}>Vân tay chung</th>
                    <th style={{ padding: '12px 14px' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Chưa có cặp bài nộp nào bị gắn cờ đạo văn.
                      </td>
                    </tr>
                  )}
                  {reports.map((r) => {
                    const rate = r.similarityRate ?? 0;
                    const color = rate >= 80 ? '#f43f5e' : rate >= 70 ? '#f59e0b' : '#38bdf8';
                    return (
                      <tr key={r.reportId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                          {r.reportId}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#cbd5e1' }}>{r.assignmentId}</td>
                        <td style={{ padding: '11px 14px', color: '#e5e7eb' }}>{r.submissionAId}</td>
                        <td style={{ padding: '11px 14px', color: '#e5e7eb' }}>{r.submissionBId}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ color, fontWeight: 800 }}>{rate}%</span>
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-muted)' }}>
                          {r.commonFingerprintsCount ?? '—'}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: `${color}22`,
                              color,
                            }}
                          >
                            {r.status || (r.flaggedAsFraud ? 'FLAGGED' : 'SUSPECTED')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: appeals ── */}
      {activeTab === 'APPEALS' && (
        <>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {stat('Tổng đơn phúc khảo', appeals.length, '#38bdf8', Users)}
            {stat('Chờ bộ môn xử lý', pendingAppeals.length, '#f59e0b', Scale)}
            {stat(
              'Đã chấp thuận',
              appeals.filter((a) => a.status === 'ACCEPTED').length,
              '#10b981',
              CheckCircle,
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {appeals.length === 0 && !loading && (
              <div style={{ ...card, textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                Chưa có đơn phúc khảo nào.
              </div>
            )}
            {appeals.map((a) => {
              const statusColor =
                a.status === 'ACCEPTED' ? '#10b981' : a.status === 'REJECTED' ? '#f43f5e' : '#f59e0b';
              return (
                <div key={a.appealId} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                        {a.appealId}
                      </span>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: `${statusColor}22`,
                          color: statusColor,
                        }}
                      >
                        {a.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {a.studentId} · bài nộp {a.submissionId}
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.55, marginBottom: '10px' }}>
                    {a.reason}
                  </div>

                  {a.resolutionNote && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#cbd5e1',
                        background: 'rgba(255,255,255,0.03)',
                        borderLeft: `3px solid ${statusColor}`,
                        padding: '8px 11px',
                        borderRadius: '6px',
                        marginBottom: '10px',
                      }}
                    >
                      <strong>Phản hồi{a.reviewerId ? ` (${a.reviewerId})` : ''}:</strong> {a.resolutionNote}
                      {a.adjustedScore !== undefined && (
                        <span style={{ color: '#10b981', fontWeight: 700 }}> · Điểm mới: {a.adjustedScore}</span>
                      )}
                    </div>
                  )}

                  {a.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => void handleResolveAppeal(a, 'ACCEPTED')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'rgba(16, 185, 129, 0.9)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        Chấp thuận
                      </button>
                      <button
                        onClick={() => void handleResolveAppeal(a, 'REJECTED')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid rgba(244, 63, 94, 0.5)',
                          background: 'rgba(244, 63, 94, 0.12)',
                          color: '#fda4af',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
