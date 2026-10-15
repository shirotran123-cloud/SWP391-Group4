import React, { useState, useEffect } from 'react';
import { Scale, Clock, CheckCircle, XCircle, AlertCircle, PlusCircle, RefreshCw, Award } from 'lucide-react';
import type { Appeal } from '../types';
import { AppealModal } from './AppealModal';

interface StudentAppealsViewProps {
  studentId: string;
  studentName: string;
  apiBaseUrl?: string;
}

export const StudentAppealsView: React.FC<StudentAppealsViewProps> = ({
  studentId,
  studentName,
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState('');

  const fetchStudentAppeals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals?studentId=${studentId || 'SE170000'}`);
      if (res.ok) {
        const json = await res.json();
        setAppeals(json.data || []);
      }
    } catch {
      // Sample fallback
      setAppeals([
        {
          appealId: 'APL-001-DEMO',
          submissionId: 'SUB-SWP391-DEMO',
          studentId: studentId || 'SE170000',
          reason: 'Kính gửi Giảng viên, bài của em đã tối ưu O(N log N) bằng QuickSort, mong Thầy xem xét lại điểm Testcase 2.',
          status: 'ACCEPTED',
          reviewerId: 'GV001 (ThS. Đinh Thành Trung)',
          resolutionNote: 'Đã phúc tra: giải thuật đúng chuẩn O(N log N), chấp thuận cộng 1.5 điểm.',
          adjustedScore: 9.5,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 80000000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStudentAppeals();
  }, [studentId]);

  const getStatusBadge = (status: Appeal['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
            <CheckCircle size={14} /> ĐÃ CHẤP THUẬN
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontSize: '12px', fontWeight: 700 }}>
            <XCircle size={14} /> ĐÃ TỪ CHỐI
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>
            <Clock size={14} /> ĐANG CHỜ DUYỆT
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              USE CASE 06 &amp; QUY TẮC BR-05
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', marginBottom: '8px', color: '#ffffff' }}>
              Theo Dõi Khiếu Nại &amp; Phúc Khảo Điểm (Appeals)
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Sinh viên có quyền gửi tối đa <strong>2 đơn phúc khảo cho MỖI bài nộp độc lập</strong> trong vòng <strong>48 giờ</strong> sau khi công bố kết quả (Quy tắc BR-05). Mỗi bài tập đều có hạn mức 2 lượt riêng biệt, không tính gộp toàn khóa học.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchStudentAppeals}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
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
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
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
              <PlusCircle size={16} /> Tạo Đơn Phúc Khảo Mới
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách đơn phúc khảo */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={20} color="#818cf8" /> Danh Sách Đơn Phúc Khảo Của Bạn ({appeals.length})
        </h2>

        {appeals.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Scale size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: '15px', fontWeight: 600 }}>Bạn chưa có đơn phúc khảo nào.</p>
            <p style={{ fontSize: '13px' }}>Nếu điểm số bài nộp chưa chính xác, hãy bấm nút "Tạo Đơn Phúc Khảo Mới" ở trên.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {appeals.map((app, idx) => (
              <div
                key={app.appealId || idx}
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
                      #{app.appealId}
                    </span>
                    <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>
                      Mã bài nộp: <code style={{ color: '#a5b4fc' }}>{app.submissionId}</code>
                    </span>
                  </div>
                  <div>{getStatusBadge(app.status)}</div>
                </div>

                <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5, backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '10px' }}>
                  <strong>Lý do khiếu nại:</strong> {app.reason}
                </div>

                {app.resolutionNote && (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '13px', color: '#c7d2fe' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: '#818cf8' }}>
                      Phản hồi từ Giảng viên ({app.reviewerId || 'Giảng viên phụ trách'}):
                    </div>
                    <div>{app.resolutionNote}</div>
                    {app.adjustedScore !== undefined && (
                      <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800 }}>
                        <Award size={16} /> Điểm số chính thức sau phúc khảo: {app.adjustedScore} / 10.0
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', gap: '16px' }}>
                  <span>Ngày gửi: {new Date(app.createdAt).toLocaleString('vi-VN')}</span>
                  {app.resolvedAt && <span>Ngày giải quyết: {new Date(app.resolvedAt).toLocaleString('vi-VN')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppealModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          void fetchStudentAppeals();
        }}
        submissionId={selectedSubId}
        studentId={studentId}
        currentScore={8.0}
      />
    </div>
  );
};
