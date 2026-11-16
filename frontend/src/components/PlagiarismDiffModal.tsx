import React, { useEffect, useMemo, useState } from 'react';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import {
  X,
  Copy,
  Check,
  FileCode,
  Users,
  Layers,
  ArrowLeftRight,
  CheckCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  PlagiarismMatch,
  PlagiarismCluster,
  PlagiarismPairItem,
  CrossClusterIndependence,
} from '../types';
import { ASTPlagiarismEngine } from '../services/ast-engine/plagiarism-engine';
import {
  analyzePairReasons,
  buildTierVisual,
  classifyClusterTier,
  classifyPairReviewTier,
  formatClusterDisplayName,
  isTeacherAccountName,
  isTeacherPairNames,
  type ReviewTier,
} from '../utils/plagiarism-reason-analyzer';

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

/** Ngưỡng hiển thị xử lý Đạo văn trên UI */
export const PLAGIARISM_THRESHOLDS = {
  WARNING_SUSPECTED: 50.0, // 50% – < 80%: Đưa vào danh sách Cần xem xét / Nghi vấn
  CONFIRMED_ZERO: 80.0,    // Từ 80% trở lên: Áp dụng điểm 0 theo quy chế BR-03, chờ xác nhận
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

  // Chế độ xem: 'ALL' | 'INSUFFICIENT_BASIS' | 'TEACHER_BASELINE' | clusterId (1, 2...) | 'CROSS_CHECK'
  const [activeTabMode, setActiveTabMode] = useState<string>('ALL');
  const [showReasonDetail, setShowReasonDetail] = useState<boolean>(true);

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
          status: match.status || (match.similarityRate >= 80 ? 'FLAGGED_PLAGIARISM' : 'SUSPECTED'),
          isFlagged: match.isFlagged ?? (match.similarityRate >= 50),
          sourceCodeA: match.sourceCodeA || '',
          sourceCodeB: match.sourceCodeB || '',
          matchedTokens: match.matchedTokens || [],
          jaccardSimilarity: match.jaccardSimilarity,
          containment: match.winnowingContainment,
          matchedQuirks: match.matchedQuirks,
          confirmedPlagiarism: match.confirmedPlagiarism,
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
              status: m.status || (m.similarityRate >= 80 ? 'FLAGGED_PLAGIARISM' : 'SUSPECTED'),
              isFlagged: m.isFlagged ?? (m.similarityRate >= 50),
              sourceCodeA: m.sourceCodeA || match?.sourceCodeA || '',
              sourceCodeB: m.sourceCodeB || '',
              matchedTokens: m.matchedTokens || [],
              jaccardSimilarity: m.jaccardSimilarity,
              containment: m.winnowingContainment,
              matchedQuirks: m.matchedQuirks,
              confirmedPlagiarism: m.confirmedPlagiarism,
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

  // Phân loại cặp Teacher Baseline vs Sinh viên, và tách riêng các cặp gắn cờ / không đủ cơ sở / độc lập
  const getPairTier = (p: PlagiarismPairItem): ReviewTier =>
    classifyPairReviewTier({
      similarityRate: p.similarityRate,
      status: p.status,
      isFlagged: p.isFlagged,
      confirmedPlagiarism: p.confirmedPlagiarism,
      studentNameA: p.studentNameA,
      studentNameB: p.studentNameB,
      sourceCodeA: p.sourceCodeA,
      sourceCodeB: p.sourceCodeB,
      matchedTokens: p.matchedTokens,
      matchedTokensJson: p.matchedTokensJson,
      matchedQuirks: p.matchedQuirks,
      boilerplateFilteredCount: p.matchedTokensJson?.boilerplateFingerprintsFiltered,
      isShortSubmission: p.matchedTokensJson?.isShortSubmission,
    });

  const {
    teacherPairs,
    studentPairs,
    flaggedStudentPairs,
    insufficientStudentPairs,
  } = useMemo(() => {
    const tPairs: PlagiarismPairItem[] = [];
    const sPairs: PlagiarismPairItem[] = [];
    const flagged: PlagiarismPairItem[] = [];
    const insufficient: PlagiarismPairItem[] = [];

    for (const p of allAvailablePairs) {
      if (isTeacherPairNames(p.studentNameA, p.studentNameB)) {
        tPairs.push(p);
      } else {
        sPairs.push(p);
        const tier = getPairTier(p);
        if (tier === 'INSUFFICIENT_BASIS') {
          insufficient.push(p);
        } else if (tier === 'HIGH_SUSPICION' || tier === 'NEEDS_REVIEW' || tier === 'CONFIRMED_PLAGIARISM') {
          flagged.push(p);
        }
      }
    }

    return {
      teacherPairs: tPairs,
      studentPairs: sPairs,
      flaggedStudentPairs: flagged,
      insufficientStudentPairs: insufficient,
    };
  }, [allAvailablePairs]);

  // Lọc sạch tuyệt đối Giảng viên ra khỏi các cụm nhóm, đồng thời tách nhóm Không đủ cơ sở ra khỏi nhóm Nghi vấn
  const cleanedClusters = useMemo<PlagiarismCluster[]>(() => {
    if (!clusters || clusters.length === 0) return [];
    return clusters
      .map((cl) => {
        const cleanStudents = cl.students.filter((st) => !isTeacherAccountName(st.studentName));
        const cleanPairs = cl.pairs.filter((p) => !isTeacherPairNames(p.studentNameA, p.studentNameB));
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

  const { actionableClusters, insufficientClusters } = useMemo(() => {
    const actionable: PlagiarismCluster[] = [];
    const insufficient: PlagiarismCluster[] = [];
    for (const cl of cleanedClusters) {
      if (classifyClusterTier(cl) === 'INSUFFICIENT_BASIS') {
        insufficient.push(cl);
      } else {
        actionable.push(cl);
      }
    }
    return { actionableClusters: actionable, insufficientClusters: insufficient };
  }, [cleanedClusters]);

  // Khởi tạo cặp hiển thị ban đầu khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialClusterId) {
      const targetInsufficient = insufficientClusters.find((c) => c.clusterId === initialClusterId);
      if (targetInsufficient && targetInsufficient.pairs.length > 0) {
        setActiveTabMode('INSUFFICIENT_BASIS');
        setSelectedPair(initialPair || targetInsufficient.pairs[0]);
        return;
      }
      const targetCluster = actionableClusters.find((c) => c.clusterId === initialClusterId);
      if (targetCluster && targetCluster.pairs.length > 0) {
        setActiveTabMode(String(initialClusterId));
        setSelectedPair(initialPair || targetCluster.pairs[0]);
        return;
      }
    }

    if (initialPair) {
      setSelectedPair(initialPair);
      if (isTeacherPairNames(initialPair.studentNameA, initialPair.studentNameB)) {
        setActiveTabMode('TEACHER_BASELINE');
        return;
      }

      const initTier = getPairTier(initialPair);
      if (initTier === 'INSUFFICIENT_BASIS') {
        setActiveTabMode('INSUFFICIENT_BASIS');
        return;
      }
      if (initTier === 'NO_EVIDENCE' && allSubmissions.length >= 2) {
        setCustomStudentAId(initialPair.submissionAId);
        setCustomStudentBId(initialPair.submissionBId);
        setActiveTabMode('CROSS_CHECK');
        return;
      }

      const foundCl = actionableClusters.find((c) =>
        c.pairs.some(
          (p) =>
            p.pairId === initialPair.pairId ||
            [p.submissionAId, p.submissionBId].sort().join('_') ===
              [initialPair.submissionAId, initialPair.submissionBId].sort().join('_'),
        ),
      );
      if (foundCl) {
        setActiveTabMode(String(foundCl.clusterId));
      } else {
        setActiveTabMode('ALL');
      }
      return;
    }

    if (flaggedStudentPairs.length > 0) {
      setActiveTabMode('ALL');
      setSelectedPair(flaggedStudentPairs[0]);
    } else if (insufficientStudentPairs.length > 0) {
      setActiveTabMode('INSUFFICIENT_BASIS');
      setSelectedPair(insufficientStudentPairs[0]);
    } else if (studentPairs.length > 0) {
      setActiveTabMode('ALL');
      setSelectedPair(studentPairs[0]);
    } else if (teacherPairs.length > 0) {
      setActiveTabMode('TEACHER_BASELINE');
      setSelectedPair(teacherPairs[0]);
    } else if (allAvailablePairs.length > 0) {
      setActiveTabMode('ALL');
      setSelectedPair(allAvailablePairs[0]);
    }
  }, [
    isOpen,
    initialClusterId,
    initialPair,
    actionableClusters,
    insufficientClusters,
    allAvailablePairs,
    studentPairs,
    flaggedStudentPairs,
    insufficientStudentPairs,
    teacherPairs,
    allSubmissions.length,
  ]);

  // Cặp đang được chọn đối chiếu
  const currentPair: PlagiarismPairItem | null = useMemo(() => {
    if (activeTabMode === 'CROSS_CHECK' && customStudentAId && customStudentBId) {
      // Nếu đang xem lại chính initialPair từ nút kiểm chứng độc lập bên ngoài
      if (
        selectedPair &&
        ((selectedPair.submissionAId === customStudentAId && selectedPair.submissionBId === customStudentBId) ||
          (selectedPair.submissionAId === customStudentBId && selectedPair.submissionBId === customStudentAId))
      ) {
        return selectedPair;
      }

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

    return (
      selectedPair ||
      (activeTabMode === 'TEACHER_BASELINE'
        ? teacherPairs[0]
        : activeTabMode === 'INSUFFICIENT_BASIS'
          ? insufficientStudentPairs[0]
          : flaggedStudentPairs[0] || studentPairs[0]) ||
      allAvailablePairs[0] ||
      null
    );
  }, [
    activeTabMode,
    customStudentAId,
    customStudentBId,
    selectedPair,
    allAvailablePairs,
    studentPairs,
    flaggedStudentPairs,
    insufficientStudentPairs,
    teacherPairs,
    allSubmissions,
  ]);

  // Lấy các cặp thuộc Tab hiện tại
  const pairsInActiveTab: PlagiarismPairItem[] = useMemo(() => {
    if (activeTabMode === 'TEACHER_BASELINE') {
      return teacherPairs;
    }
    if (activeTabMode === 'INSUFFICIENT_BASIS') {
      return insufficientStudentPairs;
    }
    if (activeTabMode === 'ALL') {
      if (flaggedStudentPairs.length > 0) return flaggedStudentPairs;
      return studentPairs.length > 0 ? studentPairs : allAvailablePairs;
    }
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      const found = actionableClusters.find((c) => c.clusterId === clId);
      return found ? found.pairs : [];
    }
    return [];
  }, [
    activeTabMode,
    allAvailablePairs,
    studentPairs,
    flaggedStudentPairs,
    insufficientStudentPairs,
    teacherPairs,
    actionableClusters,
  ]);

  // Cụm hiện tại nếu activeTabMode là một số
  const currentClusterObj = useMemo(() => {
    const clId = parseInt(activeTabMode, 10);
    if (!isNaN(clId)) {
      return actionableClusters.find((c) => c.clusterId === clId) || null;
    }
    return null;
  }, [activeTabMode, actionableClusters]);

  if (!mounted || !currentPair) return null;

  // Xử lý đổi chiều hiển thị (A ↔ B)
  const displayStudentA = isSwapped
    ? { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB }
    : { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA };

  const displayStudentB = isSwapped
    ? { name: currentPair.studentNameA, id: currentPair.studentIdA, subId: currentPair.submissionAId, code: currentPair.sourceCodeA }
    : { name: currentPair.studentNameB, id: currentPair.studentIdB, subId: currentPair.submissionBId, code: currentPair.sourceCodeB };

  const diffLanguage = resolveLanguage(language, displayStudentA.code, displayStudentB.code);
  const similarity = currentPair.similarityRate || 0;
  const isTeacherMatch = isTeacherPairNames(displayStudentA.name, displayStudentB.name);

  // Phân tích chi tiết "Lý do" & Bảng so sánh lựa chọn cách viết (100% Frontend)
  const swappedQuirks = (currentPair.matchedQuirks || currentPair.matchedTokensJson?.matchedQuirks || []).map((q) => ({
    ...q,
    lineA: isSwapped ? q.lineB : q.lineA,
    lineB: isSwapped ? q.lineA : q.lineB,
  }));
  const pairAnalysis = analyzePairReasons({
    similarityRate: similarity,
    status: currentPair.status,
    isFlagged: currentPair.isFlagged,
    confirmedPlagiarism: currentPair.confirmedPlagiarism,
    studentNameA: displayStudentA.name,
    studentNameB: displayStudentB.name,
    sourceCodeA: displayStudentA.code,
    sourceCodeB: displayStudentB.code,
    language: diffLanguage,
    matchedTokens: currentPair.matchedTokens,
    matchedTokensJson: currentPair.matchedTokensJson,
    matchedQuirks: swappedQuirks,
    commonFingerprintsCount: (currentPair as PlagiarismPairItem & { commonFingerprintsCount?: number }).commonFingerprintsCount,
    boilerplateFilteredCount: currentPair.matchedTokensJson?.boilerplateFingerprintsFiltered,
    isShortSubmission: currentPair.matchedTokensJson?.isShortSubmission,
  });
  const visual = pairAnalysis.visual;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const renderTierDot = (tone: 'red' | 'yellow' | 'gray' | 'green' | 'confirmed') => {
    const colorMap = {
      confirmed: '#dc2626',
      red: '#ef4444',
      yellow: '#f59e0b',
      gray: '#94a3b8',
      green: '#22c55e',
    };
    return (
      <span
        style={{
          display: 'inline-block',
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          backgroundColor: colorMap[tone],
          flexShrink: 0,
        }}
      />
    );
  };

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
        {/* HEADER MODAL (Tách biệt Số đo % và Nhãn Đánh giá) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '16.5px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Đối Sánh Mã Nguồn: <span style={{ color: 'var(--blue-600)' }}>{displayStudentA.name}</span> ⇔ <span style={{ color: visual.text }}>{displayStudentB.name}</span>
              </h2>
              {/* Số đo độc lập — không gộp chung kết luận */}
              <span
                title="Chỉ là số đo tương đồng AST Winnowing, không phải kết luận tự động"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Độ tương đồng: {similarity.toFixed(1)}%
              </span>
              {/* Nhãn trạng thái đánh giá theo 3 tầng */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 9px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  backgroundColor: visual.bg,
                  color: visual.text,
                  border: `1px solid ${visual.border}`,
                }}
              >
                {renderTierDot(visual.toneIcon)} {visual.headline}
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
              Báo cáo nội bộ Giảng viên / Bộ môn · Số đo AST tách biệt với kết luận, hiển thị lựa chọn cách viết và dấu vết trình bày
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

        {/* THANH ĐIỀU HƯỚNG NHÓM ĐỐI CHIẾU */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
            <Layers size={14} color="var(--blue-400)" />
            Phân nhóm đối chiếu:
          </span>

          {/* Tab 1: Tất cả các cặp được gắn cờ */}
          <button
            type="button"
            onClick={() => {
              setActiveTabMode('ALL');
              if (flaggedStudentPairs.length > 0) {
                setSelectedPair(flaggedStudentPairs[0]);
              }
            }}
            style={{
              padding: '5px 11px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeTabMode === 'ALL' ? 'var(--blue-600)' : 'var(--border-color)',
              backgroundColor: activeTabMode === 'ALL' ? 'rgba(37,99,235,0.1)' : '#ffffff',
              color: activeTabMode === 'ALL' ? 'var(--blue-600)' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Tất cả các cặp được gắn cờ ({flaggedStudentPairs.length})
          </button>

          {/* Các Tab cho từng Nhóm nghi vấn (Red / Yellow) */}
          {actionableClusters.map((cl) => {
            const isTabActive = activeTabMode === String(cl.clusterId);
            const clusterTier = classifyClusterTier(cl);
            const isRedCluster = clusterTier === 'HIGH_SUSPICION';
            const tabAccent = isRedCluster ? '#dc2626' : '#d97706';
            const displayClusterLabel = formatClusterDisplayName(
              cl.clusterName,
              cl.clusterId,
              cl.studentCount,
              false,
            );
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
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isTabActive
                    ? tabAccent
                    : (isRedCluster ? '#fecaca' : '#fde68a'),
                  backgroundColor: isTabActive
                    ? (isRedCluster ? '#fee2e2' : '#fef3c7')
                    : '#ffffff',
                  color: isRedCluster ? '#991b1b' : '#92400e',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {renderTierDot(isRedCluster ? 'red' : 'yellow')}
                <span>{displayClusterLabel}</span>
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

          {/* Tab Riêng Biệt (Xám): Không đủ cơ sở kết luận (bài ngắn / cấu trúc phổ thông) */}
          {insufficientStudentPairs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTabMode('INSUFFICIENT_BASIS');
                setSelectedPair(insufficientStudentPairs[0]);
              }}
              style={{
                padding: '5px 11px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTabMode === 'INSUFFICIENT_BASIS' ? '#475569' : '#cbd5e1',
                backgroundColor: activeTabMode === 'INSUFFICIENT_BASIS' ? '#f1f5f9' : '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {renderTierDot('gray')}
              <span>Không đủ cơ sở ({insufficientStudentPairs.length})</span>
            </button>
          )}

          {/* Dòng nhỏ màu xám tách biệt: Khớp lời giải mẫu (không nằm trong danh sách nhóm) */}
          {teacherPairs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTabMode('TEACHER_BASELINE');
                setSelectedPair(teacherPairs[0]);
              }}
              title="Khớp lời giải mẫu giảng viên — tách biệt, không nằm trong nhóm nghi vấn"
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTabMode === 'TEACHER_BASELINE' ? '#64748b' : '#e2e8f0',
                backgroundColor: activeTabMode === 'TEACHER_BASELINE' ? '#f1f5f9' : '#f8fafc',
                color: '#64748b',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {renderTierDot('gray')}
              <span>Khớp lời giải mẫu ({teacherPairs.length})</span>
            </button>
          )}

          {/* Tab Đối Soát Chéo Giữa Các Nhóm / Tùy Chọn Cặp Bất Kỳ */}
          <button
            type="button"
            onClick={() => {
              setSelectedPair(null);
              setActiveTabMode('CROSS_CHECK');
              if (allSubmissions.length >= 2 && (!customStudentAId || !customStudentBId)) {
                const sub1 = actionableClusters[0]?.students[0]?.submissionId || allSubmissions[0]?.id;
                const sub2 = actionableClusters[1]?.students[0]?.submissionId || allSubmissions[1]?.id;
                setCustomStudentAId(sub1);
                setCustomStudentBId(sub2);
              }
            }}
            style={{
              padding: '5px 11px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeTabMode === 'CROSS_CHECK' ? '#047857' : 'var(--border-color)',
              backgroundColor: activeTabMode === 'CROSS_CHECK' ? '#f0fdf4' : '#ffffff',
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
            Đối soát chéo / Tùy chọn
          </button>
        </div>

        {/* HÀNG LỰA CHỌN CẶP TRONG NHÓM HIỆN TẠI (PAIR SWITCHER STRIP) */}
        {activeTabMode !== 'CROSS_CHECK' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              overflowX: 'auto',
              padding: '6px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
              {currentClusterObj
                ? `Các cặp trong ${formatClusterDisplayName(currentClusterObj.clusterName, currentClusterObj.clusterId, currentClusterObj.studentCount, false)}:`
                : activeTabMode === 'INSUFFICIENT_BASIS'
                  ? 'Các cặp không đủ cơ sở:'
                  : activeTabMode === 'TEACHER_BASELINE'
                    ? 'Đối chiếu lời giải mẫu:'
                    : 'Chọn cặp đối chiếu:'}
            </span>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
              {pairsInActiveTab.map((p, idx) => {
                const isSelected = selectedPair?.pairId === p.pairId ||
                  ([selectedPair?.submissionAId, selectedPair?.submissionBId].sort().join('_') === [p.submissionAId, p.submissionBId].sort().join('_'));
                const pTier = getPairTier(p);
                const pVis = buildTierVisual(pTier, p.similarityRate);
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
                          confirmedPlagiarism: p.confirmedPlagiarism,
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
                    {renderTierDot(pVis.toneIcon)}
                    <span>
                      {p.studentNameA?.split(' ').slice(-1)[0]} ⇔ {p.studentNameB?.split(' ').slice(-1)[0]}
                    </span>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: pVis.pillBg,
                        color: pVis.pillText,
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
                {currentClusterObj.studentCount === 2
                  ? 'Hai bài có dấu hiệu giống nhau bất thường'
                  : `${currentClusterObj.studentCount} bài có dấu hiệu giống nhau bất thường`}
              </span>
            )}
            {activeTabMode === 'INSUFFICIENT_BASIS' && (
              <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                Bài ngắn (≤ 20 dòng) hoặc cấu trúc chuẩn · Điểm: giữ nguyên
              </span>
            )}
            {(isTeacherMatch || activeTabMode === 'TEACHER_BASELINE') && (
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                Khớp lời giải mẫu · Không nằm trong danh sách nhóm · Điểm: giữ nguyên
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
              marginBottom: '8px',
              padding: '7px 14px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                Bài Nộp Bên Trái:
              </span>
              <select
                value={customStudentAId}
                onChange={(e) => {
                  setSelectedPair(null);
                  setCustomStudentAId(e.target.value);
                }}
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
                Bài Nộp Bên Phải:
              </span>
              <select
                value={customStudentBId}
                onChange={(e) => {
                  setSelectedPair(null);
                  setCustomStudentBId(e.target.value);
                }}
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
                  setSelectedPair(null);
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
                Kiểm chứng chéo: {formatClusterDisplayName(crossClusterIndependence[0].clusterAName).slice(0, 18)} ⇔ {formatClusterDisplayName(crossClusterIndependence[0].clusterBName).slice(0, 18)} ({crossClusterIndependence[0].maxCrossSimilarity.toFixed(1)}%)
              </button>
            )}
          </div>
        )}

        {/* KHỐI 2 PHẦN: SỐ ĐO & QUY CHẾ (TRÁI) + LÝ DO ĐÁNH GIÁ & BẢNG LỰA CHỌN CÁCH VIẾT (GIỮA / PHẢI) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showReasonDetail
              ? '255px minmax(270px, 1fr) minmax(360px, 1.35fr)'
              : '275px 1fr',
            gap: '10px',
            marginBottom: '8px',
            alignItems: 'stretch',
          }}
        >
          {/* Khối 1: Số đo tương đồng thuần túy & Trạng thái quy chế điểm */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {isTeacherMatch ? 'Mức khớp mẫu' : 'Độ tương đồng'}
                </span>
                <span style={{ fontSize: '21px', fontWeight: 900, color: '#0f172a', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {similarity.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                (chỉ là số đo AST, không phải kết luận)
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '5px', fontWeight: 600 }}>
                {pairAnalysis.linesA} vs {pairAnalysis.linesB} dòng thực · {pairAnalysis.matchedSegmentsCount} đoạn AST
                {pairAnalysis.longestContiguousLines > 0 ? ` · dài ~${pairAnalysis.longestContiguousLines} dòng` : ''}
              </div>
            </div>

            <div style={{ paddingTop: '6px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: visual.tier === 'HIGH_SUSPICION' || visual.tier === 'CONFIRMED_PLAGIARISM' ? visual.text : '#334155' }}>
                {visual.scoreRuleLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Trạng thái quy chế:</span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: '4px',
                    backgroundColor: visual.pillBg,
                    color: visual.pillText,
                    border: `1px solid ${visual.border}`,
                  }}
                >
                  {visual.scoreRuleState}
                </span>
              </div>
            </div>
          </div>

          {/* Khối 2: Nhãn đánh giá + Lý do cốt lõi */}
          <div
            style={{
              backgroundColor: visual.bg,
              border: `1px solid ${visual.border}`,
              borderRadius: '8px',
              padding: '9px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '5px',
              maxHeight: '162px',
              overflowY: 'auto',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 900, color: visual.text }}>
                  {renderTierDot(visual.toneIcon)}
                  <span>{visual.headline}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReasonDetail((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: visual.text,
                    backgroundColor: '#ffffff',
                    border: `1px solid ${visual.border}`,
                    borderRadius: '5px',
                    padding: '2px 7px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {showReasonDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showReasonDetail ? 'Thu gọn bảng' : 'Bảng cách viết'}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: visual.text, opacity: 0.9, marginTop: '2px', fontWeight: 600 }}>
                {visual.subStatus}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                Lý do:
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: '#1e293b', lineHeight: 1.42 }}>
                {pairAnalysis.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Khối 3: Bảng so sánh lựa chọn cách viết (hoặc AST Fallback + danh sách hạt sạn) */}
          {showReasonDetail && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 10px',
                maxHeight: '162px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {pairAnalysis.comparableTraitCount >= 2 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                    <span>So sánh lựa chọn cách viết giữa 2 bài</span>
                    <span style={{ color: visual.text, fontFamily: 'var(--font-mono)' }}>
                      Trùng {pairAnalysis.matchedTraitCount}/{pairAnalysis.comparableTraitCount} điểm
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '3px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>Điểm</th>
                        <th style={{ padding: '3px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                          {displayStudentA.name?.split(' ').slice(-1)[0] || 'Bài A'}
                        </th>
                        <th style={{ padding: '3px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                          {displayStudentB.name?.split(' ').slice(-1)[0] || 'Bài B'}
                        </th>
                        <th style={{ padding: '3px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, textAlign: 'center' }}>Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairAnalysis.traits.map((row) => (
                        <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '3px 6px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{row.label}</td>
                          <td style={{ padding: '3px 6px', color: '#1e293b' }}>{row.valueA}</td>
                          <td style={{ padding: '3px 6px', color: '#1e293b' }}>{row.valueB}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: row.matched
                                  ? visual.tier === 'HIGH_SUSPICION' || visual.tier === 'CONFIRMED_PLAGIARISM'
                                    ? '#fee2e2'
                                    : visual.tier === 'INSUFFICIENT_BASIS' || visual.tier === 'TEACHER_BASELINE'
                                      ? '#f1f5f9'
                                      : '#fef3c7'
                                  : '#ecfdf5',
                                color: row.matched
                                  ? visual.tier === 'HIGH_SUSPICION' || visual.tier === 'CONFIRMED_PLAGIARISM'
                                    ? '#991b1b'
                                    : visual.tier === 'INSUFFICIENT_BASIS' || visual.tier === 'TEACHER_BASELINE'
                                      ? '#475569'
                                      : '#92400e'
                                  : '#047857',
                              }}
                            >
                              {row.matched ? 'Trùng hợp' : 'Khác biệt'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', color: '#334155' }}>
                  <div style={{ fontWeight: 800, fontSize: '11px', color: '#334155' }}>
                    Thống kê đoạn AST trùng &amp; hạt sạn trình bày (Fallback)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ padding: '5px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Số đoạn AST trùng lặp</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{pairAnalysis.matchedSegmentsCount} đoạn</div>
                    </div>
                    <div style={{ padding: '5px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>Đoạn trùng dài nhất</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>
                        {pairAnalysis.longestContiguousLines > 0
                          ? `~${pairAnalysis.longestContiguousLines} dòng liên tiếp`
                          : 'Chưa đủ chuỗi liên tiếp'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hạt sạn trình bày (Quirks) & Boilerplate đã lọc */}
              {(pairAnalysis.matchedQuirks.length > 0 || pairAnalysis.boilerplateFilteredCount > 0) && (
                <div style={{ fontSize: '11px', color: '#475569', backgroundColor: '#f8fafc', borderRadius: '5px', padding: '4px 7px', border: '1px solid #e2e8f0' }}>
                  {pairAnalysis.matchedQuirks.length > 0 && (
                    <div>
                      <strong>Hạt sạn trình bày ({pairAnalysis.matchedQuirks.length}):</strong>{' '}
                      {pairAnalysis.matchedQuirks
                        .map((q) => {
                          const pos = q.lineA && q.lineB ? ` (dòng ${q.lineA} ↔ ${q.lineB})` : '';
                          return `${q.description}${pos}`;
                        })
                        .join('; ')}
                    </div>
                  )}
                  {pairAnalysis.boilerplateFilteredCount > 0 && (
                    <div style={{ color: '#64748b', marginTop: pairAnalysis.matchedQuirks.length > 0 ? '2px' : 0 }}>
                      Đã lọc {pairAnalysis.boilerplateFilteredCount} dấu vân tay khung mẫu phổ thông.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
                <Users size={14} color={visual.text} />
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
              minHeight: '340px',
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
