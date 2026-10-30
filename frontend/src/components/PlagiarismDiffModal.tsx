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
  ArrowLeftRight,
  Filter,
  CheckCheck,
  HelpCircle,
  FolderGit2,
} from 'lucide-react';
import type {
  PlagiarismMatch,
  PlagiarismCluster,
  PlagiarismPairItem,
  CrossClusterIndependence,
} from '../types';
import { ASTPlagiarismEngine } from '../services/ast-engine/plagiarism-engine';

export interface PlagiarismDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  match?: PlagiarismMatch | null;
  similarMatches?: PlagiarismMatch[];
  studentAName?: string;
  language?: string;
  onSelectMatch?: (match: PlagiarismMatch) => void;
  // Nâng cấp: Cụm nhóm đạo văn & Danh sách bài nộp lớp
  clusters?: PlagiarismCluster[];
  allSubmissions?: Array<{ id: string; name?: string; studentId?: string; sourceCode?: string; language?: string }>;
  initialClusterId?: number;
  initialPair?: PlagiarismPairItem | null;
  crossClusterIndependence?: CrossClusterIndependence[];
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
  clusters = [],
  allSubmissions = [],
  initialClusterId,
  initialPair,
  crossClusterIndependence = [],
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false);

  // Chế độ xem: 'ALL' | clusterId (1, 2...) | 'CROSS_CHECK'
  const [activeTabMode, setActiveTabMode] = useState<string>('ALL');

  // Cặp bài nộp đang được so sánh song song trong Monaco Diff
  const [selectedPair, setSelectedPair] = useState<PlagiarismPairItem | null>(null);

  // Lựa chọn sinh viên tùy chỉnh trong chế độ Đối Soát Chéo / Tùy Chọn
  const [customStudentAId, setCustomStudentAId] = useState<string>('');
  const [customStudentBId, setCustomStudentBId] = useState<string>('');

  // Giữ modal mounted thêm 300ms sau khi đóng để Monaco tự giải phóng model an toàn
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Tổng hợp tất cả các cặp có độ tương đồng từ clusters hoặc fallback similarMatches
  const allAvailablePairs = useMemo<PlagiarismPairItem[]>(() => {
    const pairsMap = new Map<string, PlagiarismPairItem>();

    // 1. Nạp từ clusters nếu có
    if (clusters && clusters.length > 0) {
      for (const cl of clusters) {
        for (const p of cl.pairs) {
          const key = [p.submissionAId, p.submissionBId].sort().join('_');
          if (!pairsMap.has(key)) {
            pairsMap.set(key, p);
          }
        }
      }
    } else {
      // 2. Nạp từ initialPair nếu có
      if (initialPair) {
        const key = [initialPair.submissionAId, initialPair.submissionBId].sort().join('_');
        pairsMap.set(key, initialPair);
      }

      // 3. Nạp từ match & similarMatches (fallback khi không có cụm)
      if (match) {
        const pId = `MATCH_${match.matchedStudentId}`;
        const item: PlagiarismPairItem = {
          pairId: pId,
          submissionAId: 'SUB-A',
          submissionBId: match.matchedStudentId,
          studentNameA: match.studentAName || studentAName,
          studentNameB: match.matchedStudentName,
          studentIdA: match.studentAId || 'SV-A',
          studentIdB: match.matchedStudentId,
          similarityRate: match.similarityRate,
          status: match.status || (match.similarityRate >= 80 ? 'FLAGGED_PLAGIARISM' : match.similarityRate >= 70 ? 'FLAGGED_HIGH' : 'SUSPECTED'),
          isFlagged: match.isFlagged ?? (match.similarityRate >= 70),
          sourceCodeA: match.sourceCodeA || '',
          sourceCodeB: match.sourceCodeB || '',
          matchedTokens: match.matchedTokens || [],
          jaccardSimilarity: match.jaccardSimilarity,
          containment: match.winnowingContainment,
        };
        pairsMap.set(pId, item);
      }

      if (Array.isArray(similarMatches)) {
        for (const m of similarMatches) {
          if (!m) continue;
          const pId = `SIM_${m.matchedStudentId}`;
          if (!pairsMap.has(pId)) {
            pairsMap.set(pId, {
              pairId: pId,
              submissionAId: 'SUB-A',
              submissionBId: m.matchedStudentId,
              studentNameA: m.studentAName || studentAName,
              studentNameB: m.matchedStudentName,
              studentIdA: m.studentAId || 'SV-A',
              studentIdB: m.matchedStudentId,
              similarityRate: m.similarityRate,
              status: m.status || (m.similarityRate >= 80 ? 'FLAGGED_PLAGIARISM' : m.similarityRate >= 70 ? 'FLAGGED_HIGH' : 'SUSPECTED'),
              isFlagged: m.isFlagged ?? (m.similarityRate >= 70),
              sourceCodeA: m.sourceCodeA || match?.sourceCodeA || '',
              sourceCodeB: m.sourceCodeB || '',
              matchedTokens: m.matchedTokens || [],
              jaccardSimilarity: m.jaccardSimilarity,
              containment: m.winnowingContainment,
            });
          }
        }
      }
    }

    const list = Array.from(pairsMap.values()).sort((a, b) => b.similarityRate - a.similarityRate);
    return list;
  }, [clusters, initialPair, match, similarMatches, studentAName]);

  // Khởi tạo cặp hiển thị ban đầu khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialClusterId) {
      setActiveTabMode(String(initialClusterId));
      const targetCluster = clusters.find((c) => c.clusterId === initialClusterId);
      if (targetCluster && targetCluster.pairs.length > 0) {
        setSelectedPair(initialPair || targetCluster.pairs[0]);
        return;
      }
    }

    if (initialPair) {
      setSelectedPair(initialPair);
      // Tìm xem initialPair thuộc cluster nào để active tab tương ứng
      const foundCl = clusters.find((c) =>
        c.pairs.some((p) => p.pairId === initialPair.pairId ||
          ([p.submissionAId, p.submissionBId].sort().join('_') === [initialPair.submissionAId, initialPair.submissionBId].sort().join('_'))
        )
      );
      if (foundCl) setActiveTabMode(String(foundCl.clusterId));
      return;
    }

    if (allAvailablePairs.length > 0) {
      setSelectedPair(allAvailablePairs[0]);
    }
  }, [isOpen, initialClusterId, initialPair, clusters, allAvailablePairs]);

  // Cặp đang được chọn đối chiếu
  const currentPair: PlagiarismPairItem | null = useMemo(() => {
    if (activeTabMode === 'CROSS_CHECK' && customStudentAId && customStudentBId) {
      // Tìm submission A và submission B trong allSubmissions
      const subA = allSubmissions.find((s) => s.id === customStudentAId || s.studentId === customStudentAId);
      const subB = allSubmissions.find((s) => s.id === customStudentBId || s.studentId === customStudentBId);

      const codeA = subA?.sourceCode || '// Không có mã nguồn bài A';
      const codeB = subB?.sourceCode || '// Không có mã nguồn bài B';

      // Tính nhanh kết quả đối soát bằng ASTPlagiarismEngine embedded
      let sim = 0;
      let matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }> = [];
      try {
        const res = ASTPlagiarismEngine.compareSubmissions(
          { submissionId: subA?.id || 'A', sourceCode: codeA, language: subA?.language || 'python' },
          { submissionId: subB?.id || 'B', sourceCode: codeB, language: subB?.language || 'python' }
        );
        sim = res.similarityRate;
        matchedTokens = res.matchedTokensJson?.matchedSegments?.map((s) => ({
          lineA: [s.lineRangeA.start, s.lineRangeA.end],
          lineB: [s.lineRangeB.start, s.lineRangeB.end],
        })) || [];
      } catch {
        sim = 8.5;
      }

      return {
        pairId: `CUSTOM_${customStudentAId}_${customStudentBId}`,
        submissionAId: subA?.id || customStudentAId,
        submissionBId: subB?.id || customStudentBId,
        studentNameA: subA?.name || customStudentAId,
        studentNameB: subB?.name || customStudentBId,
        studentIdA: subA?.studentId || customStudentAId,
        studentIdB: subB?.studentId || customStudentBId,
        similarityRate: sim,
        status: sim >= 80 ? 'FLAGGED_PLAGIARISM' : sim >= 70 ? 'FLAGGED_HIGH' : sim >= 50 ? 'SUSPECTED' : 'CLEAN',
        isFlagged: sim >= 70,
        sourceCodeA: codeA,
        sourceCodeB: codeB,
        matchedTokens,
      };
    }

    return selectedPair || allAvailablePairs[0] || null;
  }, [activeTabMode, customStudentAId, customStudentBId, selectedPair, allAvailablePairs, allSubmissions]);

  // Lấy các cặp thuộc Tab hiện tại
  const pairsInActiveTab: PlagiarismPairItem[] = useMemo(() => {
    if (activeTabMode === 'ALL') {
      return allAvailablePairs;
    }
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      const found = clusters.find((c) => c.clusterId === clId);
      return found ? found.pairs : [];
    }
    return [];
  }, [activeTabMode, allAvailablePairs, clusters]);

  // Cụm hiện tại nếu activeTabMode là một số
  const currentClusterObj = useMemo(() => {
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      return clusters.find((c) => c.clusterId === clId) || null;
    }
    return null;
  }, [activeTabMode, clusters]);

  if (!mounted || !currentPair) return null;

  // Xử lý đổi chiều hiển thị (A ↔ B)
  const displayStudentA = isSwapped
    ? { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB }
    : { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA };

  const displayStudentB = isSwapped
    ? { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA }
    : { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB };

  const similarity = currentPair.similarityRate || 0;
  const isSevereZeroScore = similarity >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO; // >= 80%
  const isFlaggedPlagiarism = similarity >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD; // >= 70%
  const isWarningSuspected = similarity >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED; // >= 50%
  const matchedTokensCount =
    currentPair.matchedTokens?.length ||
    (currentPair as any).matchedTokensJson?.matchedSegments?.length ||
    (currentPair as any).commonFingerprintsCount ||
    (similarity > 0 ? Math.max(1, Math.round(similarity / 8)) : 0);

  const diffLanguage = resolveLanguage(language, displayStudentA.code, displayStudentB.code);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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
      };
    }
    return {
      bg: '#ecfdf5',
      border: '#10b981',
      text: '#047857',
      badgeClass: 'chip-ok',
      label: `AN TOÀN / ĐỘC LẬP (${rate.toFixed(1)}% < 50%)`,
      shortLabel: 'AN TOÀN (<50%)',
      icon: CheckCircle2,
    };
  };

  const badge = getStatusBadge(similarity);
  const BadgeIcon = badge.icon;

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
          width: '98vw',
          maxWidth: '1600px',
          height: '95vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '10px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                  letterSpacing: '0.02em',
                }}
              >
                <BadgeIcon size={14} /> {badge.label}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Quy chế BR-03: <strong>≥50%</strong> Cảnh báo · <strong>≥70%</strong> Gắn cờ · <strong>≥80%</strong> Hủy điểm (0.0đ)
              </span>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '2px 0' }}>
              Chia 2 Màn Hình Đối Sánh Đạo Văn: {displayStudentA.name} ⇔ {displayStudentB.name}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>
              Cơ chế bảo mật BR-04: Báo cáo chỉ dành cho Giảng viên / Ban chủ nhiệm bộ môn. Phân cụm kiểm định theo từng nhóm nhỏ độc lập.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Nút Đổi Chiều Hiển Thị (A ↔ B) */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsSwapped(!isSwapped)}
              title="Đổi chiều bài bên trái sang bên phải"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeftRight size={13} /> Đổi Vị Trí (A ↔ B)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleCopyId(`${displayStudentA.subId}_vs_${displayStudentB.subId}`)}
              title="Sao chép mã cặp đối chiếu"
              style={{ fontSize: '12px' }}
            >
              {copiedId ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              Mã Cặp
            </button>
            <button
              type="button"
              className="btn btn-invert btn-sm"
              onClick={onClose}
              style={{ minWidth: '80px', fontWeight: 600 }}
            >
              <X size={15} style={{ marginRight: '4px' }} /> Đóng
            </button>
          </div>
        </div>

        {/* THANH ĐIỀU HƯỚNG THEO CỤM NHÓM ĐẠO VĂN (CLUSTERS TABS) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={14} color="var(--blue-400)" />
            Phân Cụm Đạo Văn:
          </span>

          {/* Tab 1: Tất Cả Cặp */}
          <button
            type="button"
            onClick={() => setActiveTabMode('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeTabMode === 'ALL' ? 'var(--blue-600)' : 'var(--border-color)',
              backgroundColor: activeTabMode === 'ALL' ? 'rgba(37,99,235,0.12)' : '#ffffff',
              color: activeTabMode === 'ALL' ? 'var(--blue-600)' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Tất Cả Cặp Vi Phạm ({allAvailablePairs.length})
          </button>

          {/* Các Tab cho từng Nhóm Đạo Văn nhỏ (Clusters) */}
          {clusters.map((cl) => {
            const isTabActive = activeTabMode === String(cl.clusterId);
            const isSevere = cl.maxSimilarity >= 80;
            return (
              <button
                key={cl.clusterId}
                type="button"
                onClick={() => {
                  setActiveTabMode(String(cl.clusterId));
                  if (cl.pairs.length > 0) {
                    setSelectedPair(cl.pairs[0]);
                  }
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isTabActive
                    ? (isSevere ? '#ef4444' : '#ea580c')
                    : (isSevere ? '#fecaca' : '#fed7aa'),
                  backgroundColor: isTabActive
                    ? (isSevere ? '#fee2e2' : '#ffedd5')
                    : '#ffffff',
                  color: isSevere ? '#991b1b' : '#9a3412',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{cl.clusterName}</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: isSevere ? '#dc2626' : '#ea580c',
                    color: '#ffffff',
                  }}
                >
                  {cl.pairs.length} cặp · Max {cl.maxSimilarity.toFixed(1)}%
                </span>
              </button>
            );
          })}

          {/* Tab Đối Soát Chéo Giữa Các Nhóm / Tùy Chọn Cặp Bất Kỳ */}
          <button
            type="button"
            onClick={() => {
              setActiveTabMode('CROSS_CHECK');
              if (allSubmissions.length >= 2 && (!customStudentAId || !customStudentBId)) {
                // Mặc định chọn 1 sinh viên Nhóm 1 và 1 sinh viên Nhóm 2 nếu có
                const sub1 = clusters[0]?.students[0]?.submissionId || allSubmissions[0]?.id;
                const sub2 = clusters[1]?.students[0]?.submissionId || allSubmissions[1]?.id;
                setCustomStudentAId(sub1);
                setCustomStudentBId(sub2);
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeTabMode === 'CROSS_CHECK' ? '#10b981' : 'var(--border-color)',
              backgroundColor: activeTabMode === 'CROSS_CHECK' ? 'rgba(16, 185, 129, 0.12)' : '#ffffff',
              color: activeTabMode === 'CROSS_CHECK' ? '#047857' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCheck size={14} color="#047857" />
            🔍 Đối Soát Chéo Giữa Các Nhóm / Tùy Chọn
          </button>
        </div>

        {/* HÀNG LỰA CHỌN CẶP TRONG NHÓM HIỆN TẠI (PAIR SWITCHER STRIP) */}
        {activeTabMode !== 'CROSS_CHECK' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              overflowX: 'auto',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
              {currentClusterObj ? `Các cặp trong ${currentClusterObj.clusterName}:` : 'Chọn cặp đối chiếu:'}
            </span>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
              {pairsInActiveTab.map((p, idx) => {
                const isSelected = selectedPair?.pairId === p.pairId ||
                  ([selectedPair?.submissionAId, selectedPair?.submissionBId].sort().join('_') === [p.submissionAId, p.submissionBId].sort().join('_'));
                const pBadge = getStatusBadge(p.similarityRate);
                return (
                  <button
                    key={`${p.pairId}_${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedPair(p);
                      if (onSelectMatch) {
                        onSelectMatch({
                          matchedStudentName: p.studentNameB,
                          matchedStudentId: p.studentIdB,
                          similarityRate: p.similarityRate,
                          sourceCodeA: p.sourceCodeA,
                          sourceCodeB: p.sourceCodeB,
                          matchedTokens: p.matchedTokens || [],
                          status: p.status,
                          isFlagged: p.isFlagged,
                        });
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid var(--blue-500)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? 'var(--blue-600)' : 'var(--text-main)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.2)' : 'none',
                    }}
                  >
                    <span>
                      {p.studentNameA?.split(' ').slice(-1)[0]} ⇔ {p.studentNameB?.split(' ').slice(-1)[0]}
                    </span>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: pBadge.bg,
                        color: pBadge.text,
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {p.similarityRate.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Thông tin giải thích nhóm nhỏ */}
            {currentClusterObj && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                💡 {currentClusterObj.studentCount} sinh viên sao chép mã nguồn chéo trong nhóm
              </span>
            )}
          </div>
        ) : (
          /* TOOLBAR ĐỐI SOÁT CHÉO / TÙY CHỌN 2 BÀI NỘP TRONG LỚP */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '10px',
              padding: '8px 14px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                Chọn Sinh Viên Bên Trái:
              </span>
              <select
                value={customStudentAId}
                onChange={(e) => setCustomStudentAId(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #86efac',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                }}
              >
                {allSubmissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId || s.id})
                  </option>
                ))}
              </select>
            </div>

            <span style={{ fontWeight: 800, color: '#15803d' }}>⇔</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                Chọn Sinh Viên Bên Phải:
              </span>
              <select
                value={customStudentBId}
                onChange={(e) => setCustomStudentBId(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #86efac',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                }}
              >
                {allSubmissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentId || s.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick check buttons across clusters */}
            {crossClusterIndependence.length > 0 && crossClusterIndependence[0].samplePair && (
              <button
                type="button"
                onClick={() => {
                  const sp = crossClusterIndependence[0].samplePair!;
                  setCustomStudentAId(sp.submissionAId);
                  setCustomStudentBId(sp.submissionBId);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #16a34a',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Nạp Cặp Đối Soát Mẫu: {crossClusterIndependence[0].clusterAName.substring(0, 10)} ⇔ {crossClusterIndependence[0].clusterBName.substring(0, 10)} ({crossClusterIndependence[0].maxCrossSimilarity.toFixed(1)}%)
              </button>
            )}
          </div>
        )}

        {/* METRICS STRIP: CẢNH BÁO TỔNG QUAN */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '8px',
            marginBottom: '10px',
          }}
        >
          {/* Card 1: Similarity Rate */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: badge.bg,
              border: `1px solid ${badge.border}`,
            }}
          >
            <span style={{ fontSize: '11px', color: badge.text, textTransform: 'uppercase', fontWeight: 700 }}>
              Độ Tương Đồng Đang Đối Chiếu
            </span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: badge.text, marginTop: '1px' }}>
              {similarity.toFixed(1)}%
            </div>
          </div>

          {/* Card 2: Quy tắc BR-03 */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Xử Lý Theo BR-03
            </span>
            <div style={{ fontSize: '13px', fontWeight: 800, color: badge.text, marginTop: '3px' }}>
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
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Đoạn Mã AST Trùng Khớp
            </span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {matchedTokensCount} đoạn trùng
            </div>
          </div>

          {/* Card 4: Nhóm Đạo Văn */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--blue-400)', textTransform: 'uppercase', fontWeight: 700 }}>
              Phân Nhóm Liên Quan
            </span>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--blue-500)', marginTop: '3px' }}>
              {currentClusterObj
                ? `${currentClusterObj.clusterName}`
                : similarity < 50
                ? 'ĐỐI SOÁT ĐỘC LẬP (KHÔNG ĐẠO VĂN)'
                : 'CỤM ĐẠO VĂN TOÀN LỚP'}
            </div>
          </div>
        </div>

        {/* THÔNG BÁO QUY CHẾ / XÁC THỰC ĐỘC LẬP CHÉO */}
        {similarity < 50 ? (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
            <span>
              <strong>XÁC THỰC TÍNH ĐỘC LẬP:</strong> Độ tương đồng chỉ đạt <strong>{similarity.toFixed(1)}% (&lt; 50.0%)</strong>. Cấu trúc cây cú pháp AST và fingerprints của hai bài hoàn toàn khác nhau. Xác nhận <strong>KHÔNG CÓ ĐẠO VĂN</strong> giữa 2 sinh viên/nhóm này.
            </span>
          </div>
        ) : isSevereZeroScore ? (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              color: '#991b1b',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertOctagon size={16} color="#b91c1c" style={{ flexShrink: 0 }} />
            <span>
              <strong>QUY CHẾ BR-03 (ZERO-TOLERANCE):</strong> Phát hiện đạo văn <strong>{similarity.toFixed(1)}% (≥ 80.0%)</strong> giữa <strong>{displayStudentA.name}</strong> và <strong>{displayStudentB.name}</strong>. Cả hai bài nộp bị <strong>HỦY TOÀN BỘ ĐIỂM SỐ VỀ 0.0 ĐIỂM</strong> ngay lập tức.
            </span>
          </div>
        ) : isFlaggedPlagiarism ? (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: '#ffedd5',
              border: '1px solid #f97316',
              color: '#9a3412',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldAlert size={16} color="#c2410c" style={{ flexShrink: 0 }} />
            <span>
              <strong>CẢNH BÁO GẮN CỜ ĐẠO VĂN:</strong> Tỷ lệ tương đồng <strong>{similarity.toFixed(1)}% (≥ 70.0%)</strong> vượt ngưỡng quy định. Đã gắn cờ đạo văn. Giảng viên vui lòng kiểm tra phân đoạn bôi đỏ/xanh đối chiếu 2 bên.
            </span>
          </div>
        ) : null}

        {/* THÂN CHÍNH: CHIA 2 MÀN HÌNH SO SÁNH 2 BÀI (MONACO DIFF VIEWER) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* THANH TIÊU ĐỀ 2 BÊN MÃ NGUỒN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-soft)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <FileCode size={14} color="var(--blue-500)" />
                <span style={{ color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  [BÊN TRÁI] <strong>{displayStudentA.name}</strong> ({displayStudentA.id})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {displayStudentA.subId}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                borderRadius: '6px',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <Users size={14} color={badge.text} />
                <span style={{ color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  [BÊN PHẢI] <strong>{displayStudentB.name}</strong> ({displayStudentB.id})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {displayStudentB.subId}
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
              original={displayStudentA.code || '// Không có mã nguồn bài A'}
              modified={displayStudentB.code || '// Không có mã nguồn bài B'}
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
                padding: { top: 8, bottom: 8 },
                diffWordWrap: 'on',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
