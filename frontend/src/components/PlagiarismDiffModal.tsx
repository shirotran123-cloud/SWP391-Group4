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
          matchedQuirks: match.matchedQuirks,
          matchedTokensJson: {
            matchedQuirks: match.matchedQuirks,
            boilerplateFingerprintsFiltered: match.boilerplateFingerprintsFiltered,
            isShortSubmission: match.isShortSubmission,
          },
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
              matchedQuirks: m.matchedQuirks,
              matchedTokensJson: {
                matchedQuirks: m.matchedQuirks,
                boilerplateFingerprintsFiltered: m.boilerplateFingerprintsFiltered,
                isShortSubmission: m.isShortSubmission,
              },
            });
          }
        }
      }
    }

    const list = Array.from(pairsMap.values()).sort((a, b) => b.similarityRate - a.similarityRate);
    return list;
  }, [clusters, initialPair, match, similarMatches, studentAName]);

  // Phân loại các cặp so với Thầy giáo (Teacher Baseline) và các cặp giữa Sinh viên với nhau
  const { teacherPairs, studentPairs } = useMemo(() => {
    const tPairs: PlagiarismPairItem[] = [];
    const sPairs: PlagiarismPairItem[] = [];

    for (const p of allAvailablePairs) {
      const nA = (p.studentNameA || '').toLowerCase();
      const nB = (p.studentNameB || '').toLowerCase();
      const isTeacher =
        nA.includes('thầy') || nA.includes('teacher') || nA.includes('giảng viên') ||
        nB.includes('thầy') || nB.includes('teacher') || nB.includes('giảng viên');

      if (isTeacher) {
        tPairs.push(p);
      } else {
        sPairs.push(p);
      }
    }

    return { teacherPairs: tPairs, studentPairs: sPairs };
  }, [allAvailablePairs]);

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
      const isInitTeacher =
        (initialPair.studentNameA || '').toLowerCase().includes('thầy') ||
        (initialPair.studentNameB || '').toLowerCase().includes('thầy') ||
        (initialPair.studentNameA || '').toLowerCase().includes('giảng viên') ||
        (initialPair.studentNameB || '').toLowerCase().includes('giảng viên');

      if (isInitTeacher) {
        setActiveTabMode('TEACHER_BASELINE');
        return;
      }

      // Tìm xem initialPair thuộc cluster nào để active tab tương ứng
      const foundCl = clusters.find((c) =>
        c.pairs.some((p) => p.pairId === initialPair.pairId ||
          ([p.submissionAId, p.submissionBId].sort().join('_') === [initialPair.submissionAId, initialPair.submissionBId].sort().join('_'))
        )
      );
      if (foundCl) setActiveTabMode(String(foundCl.clusterId));
      return;
    }

    if (studentPairs.length > 0) {
      setSelectedPair(studentPairs[0]);
    } else if (allAvailablePairs.length > 0) {
      setSelectedPair(allAvailablePairs[0]);
      if (teacherPairs.length > 0) setActiveTabMode('TEACHER_BASELINE');
    }
  }, [isOpen, initialClusterId, initialPair, clusters, allAvailablePairs, studentPairs, teacherPairs]);

  // Cặp đang được chọn đối chiếu
  const currentPair: PlagiarismPairItem | null = useMemo(() => {
    if (activeTabMode === 'CROSS_CHECK' && customStudentAId && customStudentBId) {
      const subA = allSubmissions.find((s) => s.id === customStudentAId || s.studentId === customStudentAId);
      const subB = allSubmissions.find((s) => s.id === customStudentBId || s.studentId === customStudentBId);

      const codeA = subA?.sourceCode || '// Không có mã nguồn bài A';
      const codeB = subB?.sourceCode || '// Không có mã nguồn bài B';

      let sim = 0;
      let status: PlagiarismPairItem['status'] = 'CLEAN';
      let isFlagged = false;
      let matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }> = [];
      let matchedQuirks: PlagiarismPairItem['matchedQuirks'];
      let matchedTokensJson: PlagiarismPairItem['matchedTokensJson'];
      try {
        const res = ASTPlagiarismEngine.compareSubmissions(
          { submissionId: subA?.id || 'A', sourceCode: codeA, language: subA?.language || 'python', studentName: subA?.name },
          { submissionId: subB?.id || 'B', sourceCode: codeB, language: subB?.language || 'python', studentName: subB?.name }
        );
        sim = res.similarityRate;
        status = res.status;
        isFlagged = res.isFlagged;
        matchedTokens = res.matchedTokensJson?.matchedSegments?.map((s) => ({
          lineA: [s.lineRangeA.start, s.lineRangeA.end],
          lineB: [s.lineRangeB.start, s.lineRangeB.end],
        })) || [];
        matchedQuirks = res.matchedQuirks || res.matchedTokensJson?.matchedQuirks;
        matchedTokensJson = res.matchedTokensJson;
      } catch {
        sim = 0;
        status = 'CLEAN';
        isFlagged = false;
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
        status,
        isFlagged,
        sourceCodeA: codeA,
        sourceCodeB: codeB,
        matchedTokens,
        matchedQuirks,
        matchedTokensJson,
      };
    }

    return selectedPair || (activeTabMode === 'TEACHER_BASELINE' ? teacherPairs[0] : studentPairs[0]) || allAvailablePairs[0] || null;
  }, [activeTabMode, customStudentAId, customStudentBId, selectedPair, allAvailablePairs, studentPairs, teacherPairs, allSubmissions]);

  // Lọc sạch tuyệt đối Thầy giáo ra khỏi các cụm nhóm đạo văn (chỉ giữ sinh viên vi phạm chép nhau)
  const cleanedClusters = useMemo<PlagiarismCluster[]>(() => {
    if (!clusters || clusters.length === 0) return [];
    return clusters
      .map((cl) => {
        const cleanStudents = cl.students.filter((st) => {
          const sName = (st.studentName || '').toLowerCase();
          return !sName.includes('thầy') && !sName.includes('giảng viên') && !sName.includes('teacher');
        });
        const cleanPairs = cl.pairs.filter((p) => {
          const nA = (p.studentNameA || '').toLowerCase();
          const nB = (p.studentNameB || '').toLowerCase();
          return (
            !nA.includes('thầy') && !nA.includes('giảng viên') && !nA.includes('teacher') &&
            !nB.includes('thầy') && !nB.includes('giảng viên') && !nB.includes('teacher')
          );
        });
        return {
          ...cl,
          studentCount: cleanStudents.length,
          students: cleanStudents,
          pairs: cleanPairs,
          maxSimilarity: cleanPairs.length > 0 ? Math.max(...cleanPairs.map((p) => p.similarityRate)) : 0,
        };
      })
      .filter((cl) => cl.students.length >= 2 && cl.pairs.length >= 1);
  }, [clusters]);

  // Lấy các cặp thuộc Tab hiện tại
  const pairsInActiveTab: PlagiarismPairItem[] = useMemo(() => {
    if (activeTabMode === 'TEACHER_BASELINE') {
      return teacherPairs;
    }
    if (activeTabMode === 'ALL') {
      return studentPairs.length > 0 ? studentPairs : allAvailablePairs;
    }
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      const found = cleanedClusters.find((c) => c.clusterId === clId);
      return found ? found.pairs : [];
    }
    return [];
  }, [activeTabMode, allAvailablePairs, studentPairs, teacherPairs, cleanedClusters]);

  // Cụm hiện tại nếu activeTabMode là một số
  const currentClusterObj = useMemo(() => {
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      return cleanedClusters.find((c) => c.clusterId === clId) || null;
    }
    return null;
  }, [activeTabMode, cleanedClusters]);

  if (!mounted || !currentPair) return null;

  // Xử lý đổi chiều hiển thị (A ↔ B)
  const displayStudentA = isSwapped
    ? { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB }
    : { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA };

  const displayStudentB = isSwapped
    ? { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA }
    : { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB };

  const similarity = currentPair.similarityRate || 0;
  const nameA = (displayStudentA.name || '').toLowerCase();
  const nameB = (displayStudentB.name || '').toLowerCase();
  const isTeacherMatch =
    nameA.includes('thầy') || nameA.includes('teacher') || nameA.includes('giảng viên') ||
    nameB.includes('thầy') || nameB.includes('teacher') || nameB.includes('giảng viên');

  // Đếm số dòng thực và lấy dấu vết trình bày bổ trợ từ AST Engine
  const codeL = displayStudentA.code || '';
  const codeR = displayStudentB.code || '';
  const linesCountA = codeL.split('\n').filter((l) => l.trim().length > 0).length;
  const linesCountB = codeR.split('\n').filter((l) => l.trim().length > 0).length;
  const maxLines = Math.max(linesCountA, linesCountB);

  const rawMatchedQuirks = (currentPair.matchedQuirks || currentPair.matchedTokensJson?.matchedQuirks || []) as Array<{
    type: string;
    signature: string;
    description: string;
    lineA?: number;
    lineB?: number;
  }>;
  const quirkCount = rawMatchedQuirks.length;
  const boilerplateFilteredCount = currentPair.matchedTokensJson?.boilerplateFingerprintsFiltered ?? 0;
  const hasStrongFormattingEvidence = similarity >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD && quirkCount >= 2;
  const isShortSubmission =
    currentPair.matchedTokensJson?.isShortSubmission ?? (maxLines > 0 && maxLines <= 20);

  // Bài quá ngắn (<= 20 dòng thực, không đủ dấu vết trình bày trùng khớp):
  // Đưa vào diện NGHI VẤN chờ Giảng viên kiểm tra trực tiếp, không auto-0đ.
  const isShortPendingReview =
    !isTeacherMatch &&
    similarity >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD &&
    currentPair.status !== 'FLAGGED_PLAGIARISM' &&
    currentPair.status !== 'FLAGGED_HIGH' &&
    !hasStrongFormattingEvidence &&
    (currentPair.status === 'SUSPECTED' || isShortSubmission);

  const matchedTokensCount =
    currentPair.matchedTokens?.length ||
    (currentPair as any).matchedTokensJson?.matchedSegments?.length ||
    (currentPair as any).commonFingerprintsCount ||
    (similarity > 0 ? Math.max(1, Math.round(similarity / 8)) : 0);

  const isMicroMatch = matchedTokensCount <= 4 && !currentPair.isFlagged && !isTeacherMatch;

  const isSevereZeroScore = !isTeacherMatch && !isMicroMatch && !isShortPendingReview && similarity >= PLAGIARISM_THRESHOLDS.CONFIRMED_ZERO; // >= 80%
  const isFlaggedPlagiarism = !isTeacherMatch && !isMicroMatch && !isShortPendingReview && similarity >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD; // >= 70%
  const isWarningSuspected = !isTeacherMatch && !isMicroMatch && (isShortPendingReview || similarity >= PLAGIARISM_THRESHOLDS.WARNING_SUSPECTED); // >= 50%

  const diffLanguage = resolveLanguage(language, displayStudentA.code, displayStudentB.code);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getStatusBadge = (rate: number, pairOverride?: PlagiarismPairItem) => {
    const pNameA = (pairOverride ? pairOverride.studentNameA : displayStudentA.name || '').toLowerCase();
    const pNameB = (pairOverride ? pairOverride.studentNameB : displayStudentB.name || '').toLowerCase();
    const pIsTeacher =
      pNameA.includes('thầy') || pNameA.includes('teacher') || pNameA.includes('giảng viên') ||
      pNameB.includes('thầy') || pNameB.includes('teacher') || pNameB.includes('giảng viên');

    const pIsShortPending = pairOverride
      ? !pIsTeacher && rate >= PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD && pairOverride.status === 'SUSPECTED'
      : isShortPendingReview;

    const pIsMicro = pairOverride
      ? (pairOverride.matchedTokens?.length || 0) <= 4 && !pairOverride.isFlagged && !pIsTeacher && rate < PLAGIARISM_THRESHOLDS.FLAGGED_FRAUD
      : isMicroMatch;

    if (pIsTeacher) {
      return {
        bg: '#ecfdf5',
        border: '#10b981',
        text: '#047857',
        badgeClass: 'chip-good',
        label: `MÃ NGUỒN MẪU GIẢNG VIÊN (KHÔNG PHẠT)`,
        shortLabel: 'CODE MẪU THẦY',
        icon: CheckCircle2,
      };
    }
    if (pIsShortPending) {
      return {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#b45309',
        badgeClass: 'chip-warn',
        label: `NGHI VẤN · BÀI QUÁ NGẮN ≤ 20 DÒNG (${rate.toFixed(1)}% - CHỜ DUYỆT)`,
        shortLabel: 'CHỜ DUYỆT (≤20 DÒNG)',
        icon: AlertTriangle,
      };
    }
    if (pIsMicro) {
      return {
        bg: '#f0fdf4',
        border: '#86efac',
        text: '#15803d',
        badgeClass: 'chip-good',
        label: `TƯƠNG ĐỒNG THẤP (${rate.toFixed(1)}% - ĐỘC LẬP)`,
        shortLabel: 'ĐỘC LẬP',
        icon: CheckCircle2,
      };
    }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Đối Sánh Mã Nguồn: <span style={{ color: 'var(--blue-600)' }}>{displayStudentA.name}</span> ⇔ <span style={{ color: badge.text }}>{displayStudentB.name}</span>
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                }}
              >
                <BadgeIcon size={13} /> {similarity.toFixed(1)}% · {badge.label}
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
              Bảo mật thông tin: Báo cáo chỉ dành cho Giảng viên / Ban chủ nhiệm bộ môn · Phân tích tương đồng cây cú pháp AST & kiểm định lỗi dị biệt
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

          {/* Tab 1: Tất Cả Cặp Vi Phạm (chỉ giữa sinh viên với nhau) */}
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
            Tất Cả Cặp Vi Phạm ({studentPairs.length})
          </button>

          {/* Tab Riêng Biệt: Đối Chiếu Code Mẫu Giảng Viên (Baseline) */}
          {teacherPairs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTabMode('TEACHER_BASELINE');
                if (teacherPairs.length > 0) {
                  setSelectedPair(teacherPairs[0]);
                }
              }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTabMode === 'TEACHER_BASELINE' ? '#10b981' : '#a7f3d0',
                backgroundColor: activeTabMode === 'TEACHER_BASELINE' ? '#ecfdf5' : '#ffffff',
                color: '#047857',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={13} color="#10b981" />
              <span>Khớp Code Mẫu Giảng Viên ({teacherPairs.length})</span>
            </button>
          )}

          {/* Các Tab cho từng Nhóm Đạo Văn nhỏ (Clusters) - LỌC SẠCH HOÀN TOÀN THẦY GIÁO */}
          {cleanedClusters.map((cl) => {
            const isTabActive = activeTabMode === String(cl.clusterId);
            const isSevere = cl.riskLevel
              ? cl.riskLevel === 'CONFIRMED_ZERO'
              : cl.pairs.some((p) => p.status === 'FLAGGED_PLAGIARISM' || (p.status !== 'SUSPECTED' && p.status !== 'FLAGGED_HIGH' && p.similarityRate >= 80));
            const isFlaggedTab = !isSevere && cl.riskLevel === 'FLAGGED';
            const tabAccent = isSevere ? '#dc2626' : isFlaggedTab ? '#ea580c' : '#d97706';
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
                    ? tabAccent
                    : (isSevere ? '#fecaca' : isFlaggedTab ? '#fed7aa' : '#fde68a'),
                  backgroundColor: isTabActive
                    ? (isSevere ? '#fee2e2' : isFlaggedTab ? '#ffedd5' : '#fef3c7')
                    : '#ffffff',
                  color: isSevere ? '#991b1b' : isFlaggedTab ? '#9a3412' : '#92400e',
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
                    backgroundColor: tabAccent,
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
                const pBadge = getStatusBadge(p.similarityRate, p);
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
                          matchedQuirks: p.matchedQuirks || p.matchedTokensJson?.matchedQuirks,
                          boilerplateFingerprintsFiltered: p.matchedTokensJson?.boilerplateFingerprintsFiltered,
                          isShortSubmission: p.matchedTokensJson?.isShortSubmission,
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
            {currentClusterObj && !isTeacherMatch && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                💡 {currentClusterObj.studentCount} sinh viên sao chép mã nguồn chéo trong nhóm
              </span>
            )}
            {isTeacherMatch && (
              <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                🌿 Đối chiếu chuẩn mực với Mã nguồn mẫu của Giảng viên (Baseline Reference)
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

        {/* THANH TÓM TẮT TRỰC QUAN TINH GỌN (REFINED STATUS STRIP) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '8px',
            padding: '8px 14px',
            backgroundColor: badge.bg,
            border: `1px solid ${badge.border}`,
            borderRadius: '8px',
            flexWrap: 'wrap',
          }}
        >
          {/* Cụm thông số cốt lõi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Tỷ lệ tương đồng */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: badge.text, textTransform: 'uppercase' }}>
                {isTeacherMatch ? 'Mức Khớp Code Mẫu:' : 'Độ Tương Đồng:'}
              </span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: badge.text }}>
                {similarity.toFixed(1)}%
              </span>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: badge.border }} />

            {/* Phán quyết liêm chính */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Quy Chế Liêm Chính:
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: badge.text,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${badge.border}`,
                }}
              >
                {isTeacherMatch
                  ? 'BẢO LƯU ĐIỂM (CODE THẦY)'
                  : isShortPendingReview
                  ? 'CHỜ GIẢNG VIÊN KIỂM TRA'
                  : isMicroMatch
                  ? 'AN TOÀN (TRÙNG THẤP)'
                  : isSevereZeroScore
                  ? 'HỦY ĐIỂM (0.0 / 10.0)'
                  : isFlaggedPlagiarism
                  ? 'GẮN CỜ GIAN LẬN'
                  : isWarningSuspected
                  ? 'CẢNH BÁO NGHI VẤN'
                  : 'AN TOÀN (<50%)'}
              </span>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: badge.border }} />

            {/* Đoạn trùng khớp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Trùng Khớp:
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                {matchedTokensCount} đoạn AST
              </span>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: badge.border }} />

            {/* Cụm nhóm */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Phân Nhóm:
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: isTeacherMatch ? '#047857' : 'var(--blue-600)' }}>
                {isTeacherMatch ? 'Mã Nguồn Mẫu Thầy' : currentClusterObj ? currentClusterObj.clusterName : (similarity < 50 ? 'Độc lập' : 'Cụm toàn lớp')}
              </span>
            </div>
          </div>

          {/* Nhãn trạng thái ngắn gọn */}
          <span style={{ fontSize: '11.5px', color: badge.text, fontWeight: 600 }}>
            {isTeacherMatch
              ? '✓ Trùng khớp với bài nộp / code mẫu của Giảng viên. Tự động bảo lưu điểm.'
              : isShortPendingReview
              ? '⚡ Bài quá ngắn (≤ 20 dòng) — chưa đủ dữ liệu tự triển khai để kết tội tự động, Giảng viên kiểm tra trực tiếp.'
              : isMicroMatch
              ? '✓ Độ tương đồng đoạn nhỏ (≤ 4 đoạn AST). Chưa có dấu hiệu sao chép.'
              : isSevereZeroScore
              ? '⚠️ Tương đồng ≥ 80%: Vi phạm liêm chính học thuật nghiêm trọng'
              : isFlaggedPlagiarism
              ? '⚡ Tương đồng ≥ 70%: Nghi vấn sao chép cao, cần xem xét'
              : isWarningSuspected
              ? 'ℹ️ Tương đồng 50–70%: Cấu trúc logic có phần tương đồng (nên đối chiếu thêm)'
              : '✓ Hai bài làm độc lập, không có dấu hiệu sao chép'}
          </span>
        </div>

        {/* HỘP CHỈ BÁO DẤU VẾT TRÌNH BÀY & DYNAMIC IDF / TEACHER BASELINE */}
        {(() => {
          if (isShortPendingReview) {
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '8px',
                  padding: '8px 14px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#92400e',
                }}
              >
                <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#b45309' }}>Bài quá ngắn ({maxLines} dòng ≤ 20) — Chờ Giảng viên kiểm tra trực tiếp:</strong> Tổng dung lượng mã nguồn thực quá ngắn nên chưa đủ phần tự triển khai để áp phạt tự động 0 điểm (quy chế liêm chính học thuật). Độ tương đồng AST đạt {similarity.toFixed(1)}%{boilerplateFilteredCount > 0 ? ` (đã lọc ${boilerplateFilteredCount} dấu vân tay khung mẫu)` : ''}; giảng viên vui lòng đối chiếu trực tiếp hai bài nộp.
                </div>
              </div>
            );
          }

          const nameL = displayStudentA.name || 'Bên Trái';
          const nameR = displayStudentB.name || 'Bên Phải';
          const traces: string[] = [];

          if (isTeacherMatch) {
            const studentName =
              nameL.toLowerCase().includes('thầy') || nameL.toLowerCase().includes('giảng viên') || nameL.toLowerCase().includes('teacher')
                ? nameR
                : nameL;
            traces.push(
              `Đối chiếu với Mã nguồn mẫu của Giảng viên (Teacher Baseline): phần khung mẫu do Giảng viên cung cấp được loại trừ khỏi ma trận vi phạm của ${studentName}.`,
            );
          } else {
            for (const q of rawMatchedQuirks) {
              const lineL = isSwapped ? q.lineB : q.lineA;
              const lineR = isSwapped ? q.lineA : q.lineB;
              const posInfo = lineL && lineR ? ` (${nameL}: dòng ${lineL} ↔ ${nameR}: dòng ${lineR})` : '';
              traces.push(`${q.description}${posInfo}`);
            }

            if (boilerplateFilteredCount > 0) {
              traces.push(
                `Dynamic IDF / Teacher Baseline đã lọc ${boilerplateFilteredCount} dấu vân tay khung bài chung cả lớp trước khi tính độ tương đồng.`,
              );
            }

            if (rawMatchedQuirks.length === 0 && similarity >= 80) {
              traces.push(
                `Thuật toán và cấu trúc cây cú pháp AST trên ${maxLines} dòng code thực trùng lặp vượt ngưỡng quy chế liêm chính (${similarity.toFixed(1)}% ≥ 80%).`,
              );
            }
          }

          if (traces.length === 0) return null;

          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '8px',
                padding: '6px 12px',
                backgroundColor: isTeacherMatch ? '#f0fdf4' : '#fffbeb',
                border: isTeacherMatch ? '1px solid #bbf7d0' : '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '11.5px',
                color: isTeacherMatch ? '#166534' : '#92400e',
              }}
            >
              <Sparkles size={14} color={isTeacherMatch ? '#16a34a' : '#d97706'} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: isTeacherMatch ? '#15803d' : '#b45309', whiteSpace: 'nowrap' }}>
                Phân tích dấu vết:
              </span>
              <span style={{ flex: 1 }}>
                {traces.join(' · ')}
              </span>
            </div>
          );
        })()}

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
