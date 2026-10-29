import React, { useEffect, useMemo, useState } from 'react';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Users,
  Star,
  Scale,
  Sparkles,
  AlertOctagon,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { PlagiarismMatch } from '../types';

export interface PlagiarismDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: PlagiarismMatch | null;
  similarMatches?: PlagiarismMatch[];
  studentAName?: string;
  language?: string;
  onSelectMatch?: (match: PlagiarismMatch) => void;
}

/** Ngưỡng quy định xử lý Đạo văn (Chuẩn BR-03 / SRS IEEE Std 830-1998) */
export const PLAGIARISM_THRESHOLDS = {
  WARNING_SUSPECTED: 50.0, // Trên 50%: Đưa vào danh sách cảnh báo nghi vấn trùng lặp
  FLAGGED_FRAUD: 70.0,     // Trên 70%: Gắn cờ đạo văn mã nguồn
  CONFIRMED_ZERO: 80.0,    // Trên 80%: Hủy kết quả, cho 0.0 điểm toàn bài (Zero-Tolerance)
};

const resolveLanguage = (explicitLang?: string, codeA?: string, codeB?: string): string => {
  if (explicitLang) {
    const l = explicitLang.toLowerCase().trim();
    if (l === 'python' || l === 'py') return 'python';
    if (l === 'cpp' || l === 'c++' || l === 'c') return 'cpp';
    if (l === 'cs' || l === 'csharp' || l === 'c#') return 'csharp';
    if (l === 'java') return 'java';
    if (l === 'javascript' || l === 'js') return 'javascript';
    if (l === 'typescript' || l === 'ts') return 'typescript';
    return l;
  }
  const sample = ((codeA || '') + ' ' + (codeB || '')).slice(0, 1500);
  if (sample.includes('def ') || (sample.includes('import ') && !sample.includes('import java') && !sample.includes('class '))) {
    return 'python';
  }
  if (sample.includes('#include') || sample.includes('std::') || sample.includes('cout <<') || sample.includes('cin >>')) {
    return 'cpp';
  }
  if (sample.includes('using System;') || sample.includes('namespace ') || sample.includes('Console.WriteLine')) {
    return 'csharp';
  }
  return 'java';
};

const AITA_THEME = 'aita-diff-light';

const defineTheme = (monaco: Monaco) => {
  monaco.editor.defineTheme(AITA_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '000000' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267f99' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#237893',
      'diffEditor.insertedTextBackground': '#9bbf3044',
      'diffEditor.removedTextBackground': '#ef444433',
      'diffEditor.insertedLineBackground': '#f2fbf4',
      'diffEditor.removedLineBackground': '#fdf4f4',
    },
  });
};

export const PlagiarismDiffModal: React.FC<PlagiarismDiffModalProps> = ({
  isOpen,
  onClose,
  match,
  similarMatches = [],
  studentAName = 'Bài Nộp Hiện Tại',
  language,
  onSelectMatch,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ZERO_SCORE' | 'FLAGGED' | 'WARNING'>('ALL');
  const [activeMatch, setActiveMatch] = useState<PlagiarismMatch | null>(null);

  // Giữ modal mounted thêm 300ms sau khi đóng để Monaco tự giải phóng model an toàn
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Tập hợp danh sách các bài có độ tương đồng >= 50% (danh sách cảnh báo / nghi vấn)
  // và tự động chọn bài có % tương đồng cao nhất để đối chiếu trực tiếp
  const candidateList = useMemo(() => {
    const map = new Map<string, PlagiarismMatch>();

    // 1. Thêm match chính nếu có độ tương đồng >= 50% (hoặc bài đang xét)
    if (match) {
      const key = `${match.matchedStudentId}_${match.matchedStudentName}`;
      map.set(key, match);
    }

    // 2. Thêm các bài tương đồng khác >= 50%
    if (Array.isArray(similarMatches)) {
      for (const item of similarMatches) {
        if (!item) continue;
        const key = `${item.matchedStudentId}_${item.matchedStudentName}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      }
    }

    // Chuyển sang mảng, lọc những bài >= 50% đạo văn và sắp xếp giảm dần theo similarityRate
    const list = Array.from(map.values())
      .filter((m) => (m.similarityRate ?? 0) >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED)
      .sort((a, b) => (b.similarityRate ?? 0) - (a.similarityRate ?? 0));

    // Nếu match gốc < 50% (an toàn), vẫn giữ match đó để đối chiếu
    if (list.length === 0 && match) {
      list.push(match);
    }

    return list;
  }, [match, similarMatches]);

  // Khi modal mở hoặc danh sách candidate thay đổi:
  // Bài có % đạo văn cao nhất sẽ được so sánh đối chiếu trực tiếp với bài đang xem
  useEffect(() => {
    if (isOpen && candidateList.length > 0) {
      // candidateList đã được sort giảm dần -> phần tử đầu tiên là bài có % cao nhất
      const highestMatch = candidateList[0];
      setActiveMatch(highestMatch);
    } else if (match) {
      setActiveMatch(match);
    }
  }, [isOpen, candidateList, match]);

  if (!mounted || (!activeMatch && !match)) return null;

  const currentMatch = activeMatch || match!;
  const similarity = currentMatch.similarityRate || 0;
  const isSevereZeroScore = similarity >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO; // >= 80%
  const isFlaggedPlagiarism = similarity >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD; // >= 70%
  const isWarningSuspected = similarity >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED; // >= 50%
  const matchedTokensCount = currentMatch.matchedTokens?.length || 0;

  const diffLanguage = resolveLanguage(
    language || (currentMatch as any)?.language,
    currentMatch.sourceCodeA,
    currentMatch.sourceCodeB
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSelectCandidate = (cand: PlagiarismMatch) => {
    setActiveMatch(cand);
    if (onSelectMatch) {
      onSelectMatch(cand);
    }
  };

  const getStatusBadge = (rate: number) => {
    if (rate >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO) {
      return {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#b91c1c',
        badgeClass: 'chip-bad',
        label: `HỦY KẾT QUẢ - ĐIỂM 0.0 (${rate.toFixed(1)}% ≥ 80%)`,
        shortLabel: 'ĐIỂM 0.0 (≥80%)',
        icon: AlertOctagon,
        ruleText: 'Vi phạm nghiêm trọng quy chế liêm chính BR-03: HỦY KẾT QUẢ VÀ CHO 0.0 ĐIỂM HOÀN TOÀN.',
      };
    }
    if (rate >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD) {
      return {
        bg: '#ffedd5',
        border: '#f97316',
        text: '#c2410c',
        badgeClass: 'chip-warn',
        label: `GẮN CỜ ĐẠO VĂN (${rate.toFixed(1)}% ≥ 70%)`,
        shortLabel: 'GẮN CỜ (≥70%)',
        icon: ShieldAlert,
        ruleText: 'Vượt ngưỡng 70%: Hệ thống đã gắn cờ đạo văn. Giảng viên cần kiểm định đối soát mã nguồn.',
      };
    }
    if (rate >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED) {
      return {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#b45309',
        badgeClass: 'chip-warn',
        label: `CẢNH BÁO NGHI VẤN (${rate.toFixed(1)}% ≥ 50%)`,
        shortLabel: 'CẢNH BÁO (≥50%)',
        icon: AlertTriangle,
        ruleText: 'Vượt ngưỡng 50%: Đưa vào danh sách cảnh báo nghi vấn trùng lặp cấu trúc thuật toán.',
      };
    }
    return {
      bg: '#ecfdf5',
      border: '#10b981',
      text: '#047857',
      badgeClass: 'chip-ok',
      label: `AN TOÀN (${rate.toFixed(1)}% < 50%)`,
      shortLabel: 'AN TOÀN (<50%)',
      icon: CheckCircle2,
      ruleText: 'Mức độ tương đồng thấp dưới 50%, mã nguồn hợp lệ.',
    };
  };

  const badge = getStatusBadge(similarity);
  const BadgeIcon = badge.icon;

  // Lọc candidate theo tab nhanh
  const filteredCandidates = candidateList.filter((c) => {
    const rate = c.similarityRate || 0;
    if (activeFilter === 'ZERO_SCORE') return rate >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO;
    if (activeFilter === 'FLAGGED') return rate >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD && rate < PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO;
    if (activeFilter === 'WARNING') return rate >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED && rate < PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD;
    return true;
  });

  const zeroScoreCount = candidateList.filter((c) => (c.similarityRate || 0) >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO).length;
  const flaggedCount = candidateList.filter((c) => (c.similarityRate || 0) >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD && (c.similarityRate || 0) < PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO).length;
  const warningCount = candidateList.filter((c) => (c.similarityRate || 0) >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED && (c.similarityRate || 0) < PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD).length;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 9999,
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div
        className="modal-card fade-up"
        style={{
          width: '97vw',
          maxWidth: '1540px',
          height: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '14px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 11px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                  letterSpacing: '0.02em',
                }}
              >
                <BadgeIcon size={15} /> {badge.label}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Quy tắc xử lý BR-03: <strong>≥50%</strong> Cảnh báo · <strong>≥70%</strong> Gắn cờ · <strong>≥80%</strong> Hủy điểm (0.0đ)
              </span>
            </div>

            <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', margin: '3px 0' }}>
              Đối Sánh & Giám Sát Đạo Văn Mã Nguồn: {studentAName} ⇔ {currentMatch.matchedStudentName || currentMatch.matchedStudentId}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', margin: 0 }}>
              Cơ chế bảo mật BR-04: Báo cáo đạo văn tuyệt đối bảo mật, chỉ dành cho Giảng viên / Ban chủ nhiệm bộ môn. Bài nộp có % cao nhất được tự động chọn đối chiếu trực tiếp.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleCopyId(currentMatch.matchedStudentId)}
              title="Sao chép mã bài đối chiếu"
              style={{ fontSize: '12px' }}
            >
              {copiedId ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              {currentMatch.matchedStudentId}
            </button>
            <button
              type="button"
              className="btn btn-invert btn-sm"
              onClick={onClose}
              style={{ minWidth: '85px', fontWeight: 600 }}
            >
              <X size={15} style={{ marginRight: '4px' }} /> Đóng
            </button>
          </div>
        </div>

        {/* METRICS STRIP: CẢNH BÁO TỔNG QUAN */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          {/* Card 1: Similarity Rate */}
          <div
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: badge.bg,
              border: `1px solid ${badge.border}`,
            }}
          >
            <span style={{ fontSize: '11px', color: badge.text, textTransform: 'uppercase', fontWeight: 700 }}>
              Độ Tương Đồng Đang Đối Chiếu
            </span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: badge.text, marginTop: '1px' }}>
              {similarity.toFixed(1)}%
            </div>
          </div>

          {/* Card 2: Quy tắc BR-03 */}
          <div
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Xử Lý Điểm Theo BR-03
            </span>
            <div style={{ fontSize: '14px', fontWeight: 800, color: badge.text, marginTop: '4px' }}>
              {isSevereZeroScore
                ? 'HỦY ĐIỂM: CHẤM 0.0 / 10.0'
                : isFlaggedPlagiarism
                ? 'GẮN CỜ ĐẠO VĂN (TRỪ ĐIỂM)'
                : isWarningSuspected
                ? 'ĐƯA VÀO DANH SÁCH CẢNH BÁO'
                : 'MÃ NGUỒN AN TOÀN (<50%)'}
            </div>
          </div>

          {/* Card 3: Matched Segments */}
          <div
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Đoạn Mã AST Trùng Khớp
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {matchedTokensCount} đoạn trùng
            </div>
          </div>

          {/* Card 4: Tổng số bài nghi vấn trong danh sách */}
          <div
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--blue-300)', textTransform: 'uppercase', fontWeight: 700 }}>
              Bài Nghi Vấn Trong Danh Sách (≥50%)
            </span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--blue-400)', marginTop: '2px' }}>
              {candidateList.length} bài nộp
            </div>
          </div>
        </div>

        {/* THÔNG BÁO QUY CHẾ ĐẶC BIỆT KHI ĐẠO VĂN >= 80% HOẶC >= 70% */}
        {isSevereZeroScore ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              color: '#991b1b',
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertOctagon size={18} color="#b91c1c" style={{ flexShrink: 0 }} />
            <span>
              <strong>QUY CHẾ BR-03 (ZERO-TOLERANCE):</strong> Phát hiện đạo văn <strong>{similarity.toFixed(1)}% (≥ 80.0%)</strong> so với bài của sinh viên <strong>{currentMatch.matchedStudentName}</strong>. Bài nộp này <strong>BỊ HỦY TOÀN BỘ ĐIỂM SỐ VỀ 0.0 ĐIỂM</strong> ngay lập tức, không được chấp thuận khiếu nại.
            </span>
          </div>
        ) : isFlaggedPlagiarism ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffedd5',
              border: '1px solid #f97316',
              color: '#9a3412',
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldAlert size={18} color="#c2410c" style={{ flexShrink: 0 }} />
            <span>
              <strong>CẢNH BÁO GẮN CỜ ĐẠO VĂN:</strong> Tỷ lệ tương đồng <strong>{similarity.toFixed(1)}% (≥ 70.0%)</strong> vượt ngưỡng quy định. Bài thi đã bị <strong>GẮN CỜ ĐẠO VĂN</strong>. Giảng viên vui lòng kiểm tra các phân đoạn bôi đỏ/xanh trong trình so sánh.
            </span>
          </div>
        ) : isWarningSuspected ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              fontSize: '12.5px',
              fontWeight: 600,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0 }} />
            <span>
              <strong>DANH SÁCH CẢNH BÁO:</strong> Tỷ lệ tương đồng <strong>{similarity.toFixed(1)}% (≥ 50.0%)</strong> nằm trong danh sách cảnh báo nghi vấn trùng lặp cấu trúc thuật toán.
            </span>
          </div>
        ) : null}

        {/* THÂN CHÍNH: BỐ CỤC 2 CỘT (CỘT TRÁI: DANH SÁCH BÀI TƯƠNG ĐỒNG CAO >= 50% | CỘT PHẢI: MONACO DIFF VIEWER) */}
        <div style={{ display: 'flex', gap: '14px', flex: 1, minHeight: 0 }}>
          {/* CỘT TRÁI: DANH SÁCH BÀI CÓ TÍNH TƯƠNG ĐỒNG CAO (≥ 50%) */}
          <div
            style={{
              width: '350px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#fafbfc',
              overflow: 'hidden',
            }}
          >
            {/* TIÊU ĐỀ KHỐI DANH SÁCH */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="var(--blue-400)" />
                  Bài Nghi Vấn Trùng Lặp (≥50%)
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    color: 'var(--blue-300)',
                  }}
                >
                  {candidateList.length} bài
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                Sắp xếp theo % giảm dần. Nhấp vào bài để đối chiếu trực tiếp.
              </p>

              {/* BỘ LỌC NHANH THEO NGƯỠNG */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '5px',
                    border: '1px solid',
                    borderColor: activeFilter === 'ALL' ? 'var(--blue-500)' : '#cbd5e1',
                    backgroundColor: activeFilter === 'ALL' ? 'var(--blue-500)' : '#ffffff',
                    color: activeFilter === 'ALL' ? '#ffffff' : '#334155',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tất cả ({candidateList.length})
                </button>
                {zeroScoreCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('ZERO_SCORE')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: activeFilter === 'ZERO_SCORE' ? '#dc2626' : '#fecaca',
                      backgroundColor: activeFilter === 'ZERO_SCORE' ? '#dc2626' : '#fee2e2',
                      color: activeFilter === 'ZERO_SCORE' ? '#ffffff' : '#991b1b',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Điểm 0 ({zeroScoreCount})
                  </button>
                )}
                {flaggedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('FLAGGED')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: activeFilter === 'FLAGGED' ? '#ea580c' : '#fed7aa',
                      backgroundColor: activeFilter === 'FLAGGED' ? '#ea580c' : '#ffedd5',
                      color: activeFilter === 'FLAGGED' ? '#ffffff' : '#9a3412',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Gắn cờ ({flaggedCount})
                  </button>
                )}
                {warningCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('WARNING')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: activeFilter === 'WARNING' ? '#d97706' : '#fde68a',
                      backgroundColor: activeFilter === 'WARNING' ? '#d97706' : '#fef3c7',
                      color: activeFilter === 'WARNING' ? '#ffffff' : '#92400e',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Nghi vấn ({warningCount})
                  </button>
                )}
              </div>
            </div>

            {/* DANH SÁCH BÀI CUỘN ĐƯỢC */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredCandidates.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                  Không có bài nộp nào thuộc bộ lọc này (ngưỡng tương đồng &lt; 50%).
                </div>
              ) : (
                filteredCandidates.map((cand, index) => {
                  const candRate = cand.similarityRate || 0;
                  const isCandZero = candRate >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO;
                  const isCandFlagged = candRate >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD;
                  const isCandWarning = candRate >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED;
                  const isSelected = cand === currentMatch || (cand.matchedStudentId === currentMatch.matchedStudentId && cand.matchedStudentName === currentMatch.matchedStudentName);
                  const isHighest = index === 0 && candRate >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED;

                  const candBadge = getStatusBadge(candRate);

                  return (
                    <div
                      key={`${cand.matchedStudentId}_${index}`}
                      onClick={() => handleSelectCandidate(cand)}
                      style={{
                        padding: '11px 13px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '2px solid var(--blue-500)'
                          : isCandZero
                          ? '1px solid #fca5a5'
                          : isCandFlagged
                          ? '1px solid #fdba74'
                          : '1px solid var(--border-color)',
                        backgroundColor: isSelected
                          ? '#eff6ff'
                          : isCandZero
                          ? '#fff5f5'
                          : isCandFlagged
                          ? '#fffaf5'
                          : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.18)' : '0 1px 2px rgba(0,0,0,0.03)',
                        position: 'relative',
                      }}
                    >
                      {/* BADGE CAO NHẤT (ĐỐI CHIẾU MẶC ĐỊNH) */}
                      {isHighest && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                          }}
                        >
                          <Star size={10} fill="#ffffff" /> CAO NHẤT &mdash; ĐỐI CHIẾU MẶC ĐỊNH
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <h4
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: isSelected ? 'var(--blue-500)' : 'var(--text-main)',
                              margin: '0 0 2px 0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {cand.matchedStudentName || cand.matchedStudentId}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Mã SV: {cand.matchedStudentId}
                          </span>
                        </div>

                        {/* PHẦN TRĂM TƯƠNG ĐỒNG */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '17px',
                              fontWeight: 800,
                              color: candBadge.text,
                              fontFamily: 'var(--font-mono)',
                              display: 'block',
                              lineHeight: 1,
                            }}
                          >
                            {candRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* BADGE PHÂN LOẠI NGƯỠNG */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '5px',
                            backgroundColor: candBadge.bg,
                            color: candBadge.text,
                            border: `1px solid ${candBadge.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {candBadge.shortLabel}
                        </span>

                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {cand.matchedTokens?.length || 0} đoạn trùng
                        </span>
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--blue-400)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ArrowRight size={12} /> Đang đối chiếu song song
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CỘT PHẢI: MONACO DIFF VIEWER */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* THANH TIÊU ĐỀ 2 BÊN MÃ NGUỒN */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-soft)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <FileCode size={14} color="var(--blue-500)" />
                <span style={{ color: 'var(--text-main)' }}>
                  [BÊN TRÁI] Bài Nộp Hiện Tại: <strong>{studentAName}</strong>
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Users size={14} color={badge.text} />
                <span style={{ color: 'var(--text-main)' }}>
                  [BÊN PHẢI] Bài Đối Chiếu: <strong>{currentMatch.matchedStudentName || currentMatch.matchedStudentId}</strong> ({currentMatch.matchedStudentId})
                </span>
              </div>
            </div>

            {/* TRÌNH DIFF MONACO */}
            <div
              style={{
                flex: 1,
                minHeight: '400px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
              }}
            >
              <DiffEditor
                height="100%"
                language={diffLanguage}
                theme={AITA_THEME}
                beforeMount={defineTheme}
                original={currentMatch.sourceCodeA || '// Không có mã nguồn bài A'}
                modified={currentMatch.sourceCodeB || '// Không có mã nguồn bài B'}
                keepCurrentOriginalModel
                keepCurrentModifiedModel
                options={{
                  readOnly: true,
                  automaticLayout: true,
                  renderSideBySide: true,
                  scrollBeyondLastLine: false,
                  minimap: { enabled: true },
                  lineNumbersMinChars: 3,
                  wordWrap: 'on',
                  padding: { top: 10, bottom: 10 },
                  diffWordWrap: 'on',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
