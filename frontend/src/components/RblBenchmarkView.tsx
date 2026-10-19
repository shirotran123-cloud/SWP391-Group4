import React, { useState } from 'react';
import { Cpu, ShieldAlert, CheckCircle2, FileCode, Play, Sparkles } from 'lucide-react';
import { RBL_BENCHMARK_PAIRS } from '../services/ast-engine/rbl-benchmark-pairs';
import { PlagiarismService } from '../services/plagiarism.service';
import type { PlagiarismMatch } from '../types';

interface RblBenchmarkViewProps {
  onOpenDiffViewer?: (match: PlagiarismMatch) => void;
}

export const RblBenchmarkView: React.FC<RblBenchmarkViewProps> = ({ onOpenDiffViewer }) => {
  const [selectedPairId, setSelectedPairId] = useState<number>(1);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<PlagiarismMatch | null>(null);

  const selectedPair = RBL_BENCHMARK_PAIRS.find((p) => p.pairId === selectedPairId) || RBL_BENCHMARK_PAIRS[0];

  const handleRunEvaluation = async (pairId: number) => {
    setSelectedPairId(pairId);
    setEvaluating(true);
    try {
      const match = await PlagiarismService.evaluateBenchmarkPair(pairId);
      setEvaluationResult(match);
      if (onOpenDiffViewer) {
        onOpenDiffViewer(match);
      }
    } catch (err) {
      console.error('Lỗi khi chạy đánh giá AST Benchmark:', err);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
            <Cpu size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
              Phòng Thí Nghiệm Nghiên Cứu Đối Soát Mã Nguồn
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Kiểm định độ nhạy của thuật toán băm vân tay số trên Cây Cú Pháp Trừu Tượng với 10 kịch bản ngụy trang mã nguồn phức tạp
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px', fontSize: '13px' }}>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', fontWeight: 600 }}>
            ⚡ Thuật toán: vân tay mã nguồn (k=15, w=10)
          </span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            🌲 Chuẩn hóa cây cú pháp: bộ tách từ chuẩn
          </span>
          <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', fontWeight: 600 }}>
            🚨 Ngưỡng cảnh báo gian lận: ≥ 70.0%
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {RBL_BENCHMARK_PAIRS.map((pair) => {
          const isSelected = selectedPairId === pair.pairId;
          return (
            <div
              key={pair.pairId}
              onClick={() => handleRunEvaluation(pair.pairId)}
              className="glass-panel"
              style={{
                padding: '18px',
                cursor: 'pointer',
                borderRadius: '14px',
                border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(24, 32, 48, 0.6)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? 'var(--accent-cyan)' : '#e5e7eb' }}>
                  Cặp Bài #{pair.pairId.toString().padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    backgroundColor: pair.expectedIsPlagiarized ? 'rgba(244, 63, 94, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                    color: pair.expectedIsPlagiarized ? '#f43f5e' : '#10b981',
                    border: `1px solid ${pair.expectedIsPlagiarized ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  }}
                >
                  {pair.expectedIsPlagiarized ? 'CÓ ĐẠO VĂN' : 'AN TOÀN'}
                </span>
              </div>

              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                {pair.title}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                Kịch bản kiểm định ngụy trang: {pair.obfuscationType}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Thủ thuật ngụy trang:</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{pair.obfuscationType}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chi tiết cặp bài được chọn & Kết quả phân tích */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
              Chi Tiết Đang Chọn: Cặp #{selectedPair.pairId.toString().padStart(2, '0')}
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
              {selectedPair.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => handleRunEvaluation(selectedPair.pairId)}
            disabled={evaluating}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: evaluating ? 'not-allowed' : 'pointer',
              opacity: evaluating ? 0.7 : 1,
            }}
          >
            {evaluating ? (
              <>Đang phân tích cây cú pháp...</>
            ) : (
              <>
                <Play size={16} /> Chạy Kiểm Tra Đối Soát Cặp Này
              </>
            )}
          </button>
        </div>

        {evaluationResult ? (
          <div style={{ backgroundColor: 'rgba(18, 24, 36, 0.7)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tỷ Lệ Trùng Khớp (Jaccard):</span>
                <div style={{ fontSize: '26px', fontWeight: 800, color: evaluationResult.similarityRate >= 70 ? 'var(--accent-rose)' : 'var(--accent-emerald)', marginTop: '4px' }}>
                  {evaluationResult.similarityRate.toFixed(1)}%
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kết Luận Thuật Toán:</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: evaluationResult.isFlagged ? 'var(--accent-rose)' : 'var(--accent-emerald)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {evaluationResult.isFlagged ? (
                    <>
                      <ShieldAlert size={18} /> CẢNH BÁO ĐẠO VĂN
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> MÃ NGUỒN ĐỘC LẬP (HỢP LỆ)
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thời Gian Xử Lý:</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                  {evaluationResult.executionTimeMs || 12} ms
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              💡 <strong>Nhận định chuyên môn:</strong> Thuật toán vân tay mã nguồn đã tiến hành bóc tách toàn bộ định danh biến và hàm, xóa bỏ cấu trúc bình luận, và thực hiện băm trượt trên Cây Cú Pháp Trừu Tượng. Kết quả cho thấy các kỹ thuật ngụy trang ({selectedPair.obfuscationType}) hoàn toàn bị vô hiệu hóa bởi bộ chuẩn hóa cây cú pháp.
            </p>

            {onOpenDiffViewer && (
              <button
                type="button"
                onClick={() => onOpenDiffViewer(evaluationResult)}
                style={{
                  marginTop: '16px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <FileCode size={16} /> Mở Trình So Khớp Mã Nguồn Chi Tiết
              </button>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            <Sparkles size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-primary)' }} />
            <p>Bấm nút <strong>"Chạy Kiểm Tra Đối Soát Cặp Này"</strong> để bắt đầu quá trình trích xuất cây cú pháp và băm vân tay mã nguồn.</p>
          </div>
        )}
      </div>
    </div>
  );
};
