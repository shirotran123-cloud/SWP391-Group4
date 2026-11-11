/**
 * ASTPlagiarismEngine – So sánh cặp bài nộp & tạo ma trận N×N toàn lớp
 *
 * ─── CÔNG THỨC SIMILARITY (Containment-First) ───────────────────────────────
 *
 * Vấn đề với Jaccard: bài B có 2/4 câu giống A → Jaccard = 2/4 = 50% (SAI)
 * Giải pháp: dùng Containment Index đo "bao nhiêu % của bài NGẮN HƠN bị chứa
 * trong bài DÀI HƠN".
 *
 *   containment(B→A) = |fingerprints(B) ∩ fingerprints(A)| / |fingerprints(B)|
 *   containment(A→B) = |fingerprints(A) ∩ fingerprints(B)| / |fingerprints(A)|
 *   maxContainment   = max(containment(B→A), containment(A→B))
 *
 * Nếu bài B (2 câu) ⊂ bài A (4 câu) hoàn toàn:
 *   containment(B→A) = 2/2 = 100%  ← đây là giá trị đúng
 *   containment(A→B) = 2/4 = 50%
 *   maxContainment   = 100%         ← plagiarism = 100% ✓
 *
 * Thang phân loại (UC-11):
 *   maxContainment ≥ 80% → FLAGGED_PLAGIARISM (BR-03: điểm = 0)
 *   maxContainment ≥ 65% → FLAGGED_HIGH      (cờ nghi vấn)
 *   maxContainment ≥ 40% → SUSPECTED
 *   else                 → CLEAN
 * ────────────────────────────────────────────────────────────────────────────
 */

import { ASTNormalizer } from './ast-normalizer';
import { Fingerprint, WinnowingEngine, WinnowingOptions } from './winnowing';

export interface CodeSubmission {
  submissionId: string;
  studentName?: string;
  studentId?: string;
  sourceCode: string;
  filePath?: string;
  language?: string;
}

export interface MatchedSegment {
  hashValue: string;
  lineRangeA: { start: number; end: number };
  lineRangeB: { start: number; end: number };
  tokenRangeA: { start: number; end: number };
  tokenRangeB: { start: number; end: number };
  tokenCount: number;
}

export interface MatchedQuirk {
  type: string;
  signature: string;
  description: string;
  lineA: number;
  lineB: number;
}

export interface MatchedTokensJson {
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  jaccardSimilarity: number;
  containmentBinA: number;        // Bao nhiêu % của B bị chứa trong A
  containmentAinB: number;        // Bao nhiêu % của A bị chứa trong B
  maxContainment: number;         // max(containmentBinA, containmentAinB) – metric chính
  totalUniqueFingerprintsA: number;
  totalUniqueFingerprintsB: number;
  commonFingerprintsCount: number;
  matchedSegments: MatchedSegment[];
  matchedQuirks?: MatchedQuirk[];
  quirkCount?: number;
  boilerplateFingerprintsFiltered?: number;
  isShortSubmission?: boolean;
}

export interface PairwisePlagiarismResult {
  submissionAId: string;
  submissionBId: string;
  studentNameA?: string;
  studentNameB?: string;
  studentIdA?: string;
  studentIdB?: string;
  sourceCodeA?: string;
  sourceCodeB?: string;
  similarityRate: number;         // = maxContainment (0–100)
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  isFlagged: boolean;             // similarityRate ≥ PLAGIARISM_THRESHOLD hoặc phát hiện hạt sạn dị biệt
  status: 'CLEAN' | 'SUSPECTED' | 'FLAGGED_HIGH' | 'FLAGGED_PLAGIARISM';
  matchedTokensJson: MatchedTokensJson;
  matchedQuirks?: MatchedQuirk[];
  executionTimeMs: number;
}

export interface PlagiarismCluster {
  clusterId: number;
  clusterName: string;
  studentCount: number;
  students: Array<{ submissionId: string; studentId: string; studentName: string; sourceCode?: string }>;
  pairs: PairwisePlagiarismResult[];
  maxSimilarity: number;
  riskLevel: 'CONFIRMED_ZERO' | 'FLAGGED' | 'WARNING';
}

export interface CrossClusterIndependence {
  clusterAId: number;
  clusterBId: number;
  clusterAName: string;
  clusterBName: string;
  maxCrossSimilarity: number;
  samplePair?: {
    submissionAId: string;
    submissionBId: string;
    studentNameA: string;
    studentNameB: string;
    similarityRate: number;
  };
  isIndependent: boolean;
}

export interface ClassPlagiarismMatrixReport {
  assignmentId?: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number;
  submissionsList: { id: string; name?: string; studentId?: string; sourceCode?: string; language?: string }[];
  similarityMatrix: number[][];
  flaggedReports: PairwisePlagiarismResult[];
  clusters: PlagiarismCluster[];
  teacherBaselinePairs?: PairwisePlagiarismResult[];
  independentSubmissions: { id: string; name?: string; studentId?: string }[];
  crossClusterIndependence: CrossClusterIndependence[];
  totalExecutionTimeMs: number;
}

export class ASTPlagiarismEngine {
  /** Ngưỡng đánh dấu gắn cờ đạo văn (BR-03, UC-11) */
  public static readonly PLAGIARISM_THRESHOLD = 70.0;
  public static readonly CONFIRMED_ZERO_THRESHOLD = 80.0;
  public static readonly SUSPECTED_WARNING_THRESHOLD = 50.0;

  /**
   * So sánh 2 bài nộp, trả về PairwisePlagiarismResult.
   * Metric chính: maxContainment (Containment Index kết hợp Quirks & Boilerplate Filtering).
   */
  public static compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions & { commonTemplateHashes?: Set<string> },
  ): PairwisePlagiarismResult {
    const startTime = Date.now();

    // ── 1. Chuẩn hóa AST ──────────────────────────────────────────────────
    const langA = (subA.language || 'java').toLowerCase();
    const langB = (subB.language || 'java').toLowerCase();
    const normA = ASTNormalizer.normalize(subA.sourceCode, langA);
    const normB = ASTNormalizer.normalize(subB.sourceCode, langB);

    // ── 2. Sinh Winnowing fingerprints ────────────────────────────────────
    const fpA = WinnowingEngine.computeFingerprints(normA.tokens, options);
    const fpB = WinnowingEngine.computeFingerprints(normB.tokens, options);

    // ── 3. Khử Boilerplate của Giảng viên (Dynamic IDF / Common Template) ──
    const templateHashes = options?.commonTemplateHashes || new Set<string>();
    let boilerplateFilteredCount = 0;

    const rawSetA = new Set(fpA.map((f) => f.hashValue));
    const rawSetB = new Set(fpB.map((f) => f.hashValue));

    // Lọc bỏ những hash thuộc về code mẫu / kiến thức chung phổ biến của thầy
    const setA = new Set<string>();
    for (const h of rawSetA) {
      if (templateHashes.has(h)) boilerplateFilteredCount++;
      else setA.add(h);
    }
    const setB = new Set<string>();
    for (const h of rawSetB) {
      if (!templateHashes.has(h)) setB.add(h);
    }

    // Build lookup map cho B để lấy line info khi match
    const rawMapB = new Map<string, Fingerprint[]>();
    const mapB = new Map<string, Fingerprint[]>();
    for (const f of fpB) {
      if (!rawMapB.has(f.hashValue)) rawMapB.set(f.hashValue, []);
      rawMapB.get(f.hashValue)!.push(f);

      if (!templateHashes.has(f.hashValue)) {
        if (!mapB.has(f.hashValue)) mapB.set(f.hashValue, []);
        mapB.get(f.hashValue)!.push(f);
      }
    }

    // Nếu sau khi lọc boilerplate mà code không còn gì (ví dụ bài nộp hoàn toàn trùng template), fallback về raw set
    const effectiveSetA = setA.size > 0 ? setA : rawSetA;
    const effectiveSetB = setB.size > 0 ? setB : rawSetB;
    const effectiveMapB = setB.size > 0 ? mapB : rawMapB;

    // Tìm các đoạn trùng khớp
    const matchedSegments: MatchedSegment[] = [];
    const commonHashes = new Set<string>();

    for (const fA of fpA) {
      if (effectiveSetA.has(fA.hashValue) && effectiveSetB.has(fA.hashValue)) {
        commonHashes.add(fA.hashValue);
        const matchesInB = effectiveMapB.get(fA.hashValue) || [];
        for (const fB of matchesInB) {
          matchedSegments.push({
            hashValue: fA.hashValue,
            lineRangeA: { start: fA.lineStart, end: fA.lineEnd },
            lineRangeB: { start: fB.lineStart, end: fB.lineEnd },
            tokenRangeA: { start: fA.tokenStart, end: fA.tokenEnd },
            tokenRangeB: { start: fB.tokenStart, end: fB.tokenEnd },
            tokenCount: fA.tokenCount,
          });
        }
      }
    }

    const commonCount = commonHashes.size;
    const sizeA = effectiveSetA.size;
    const sizeB = effectiveSetB.size;
    const unionSize = new Set([...effectiveSetA, ...effectiveSetB]).size || 1;

    // Jaccard = |A ∩ B| / |A ∪ B|
    const jaccardSimilarity = Number(((commonCount / unionSize) * 100).toFixed(2));

    // Containment(B→A): bao nhiêu % fingerprint của B bị chứa trong A
    const containmentBinA = sizeB > 0
      ? Number(((commonCount / sizeB) * 100).toFixed(2))
      : 0.0;

    // Containment(A→B): bao nhiêu % fingerprint của A bị chứa trong B
    const containmentAinB = sizeA > 0
      ? Number(((commonCount / sizeA) * 100).toFixed(2))
      : 0.0;

    // ── 4. similarityRate = maxContainment trên phần mã nguồn tự viết ───────
    // Kiểm tra xem có phải là so sánh với bài của Giảng viên (Teacher Baseline) không
    const nameA = (subA.studentName || '').toLowerCase();
    const nameB = (subB.studentName || '').toLowerCase();
    const isTeacherMatch =
      nameA.includes('thầy') || nameA.includes('teacher') || nameA.includes('giảng viên') ||
      nameB.includes('thầy') || nameB.includes('teacher') || nameB.includes('giảng viên');

    let maxContainment = Math.max(containmentBinA, containmentAinB);
    let similarityRate = Number(maxContainment.toFixed(2));

    // ── 4.1. So khớp Dấu vết trình bày bổ trợ (Presentation Quirks - khớp 1-1) ───────────
    const quirksA = ASTNormalizer.extractQuirks(subA.sourceCode, langA);
    const quirksB = ASTNormalizer.extractQuirks(subB.sourceCode, langB);

    const matchedQuirks: MatchedQuirk[] = [];
    const quirksPoolB = new Map<string, typeof quirksB>();
    for (const q of quirksB) {
      if (!quirksPoolB.has(q.signature)) quirksPoolB.set(q.signature, []);
      quirksPoolB.get(q.signature)!.push(q);
    }

    for (const qA of quirksA) {
      const bucketB = quirksPoolB.get(qA.signature);
      if (bucketB && bucketB.length > 0) {
        const qB = bucketB.shift()!;
        matchedQuirks.push({
          type: qA.type,
          signature: qA.signature,
          description: qA.description,
          lineA: qA.line,
          lineB: qB.line,
        });
      }
    }

    const quirkCount = matchedQuirks.length;

    // ── 4.2. Cơ Chế So Phần Dư (Residual Matching) Sau Khi Trừ Code Thầy ────
    // Nếu cả hai đều là sinh viên, và sau khi trừ code Thầy/Boilerplate mà phần tự viết
    // còn lại quá ít (<= 3 fingerprints) và không có dấu vết trình bày trùng khớp:
    // -> Không đủ dữ liệu phần tự triển khai để kết tội đạo văn.
    const isResidualNegligible = !isTeacherMatch && setA.size <= 3 && setB.size <= 3 && templateHashes.size > 0;
    if (isResidualNegligible && quirkCount === 0) {
      similarityRate = 0.0;
    }

    // ── 5. Tiêu chuẩn xác định Đạo Văn (Chuẩn BR-03 + Bảo vệ bài quá ngắn <= 20 dòng) ──
    const linesCountA = (subA.sourceCode || '').split('\n').filter((l) => l.trim().length > 0).length;
    const linesCountB = (subB.sourceCode || '').split('\n').filter((l) => l.trim().length > 0).length;
    const maxLines = Math.max(linesCountA, linesCountB);

    // Chỉ bài cực ngắn (<= 20 dòng code thực ở cả hai bài) mới thiếu phần tự triển khai để auto-0đ
    const isShortSubmission = maxLines <= 20;
    // Dấu vết trình bày bổ trợ chỉ có giá trị khi AST đã >= 70% VÀ trùng >= 2 vị trí hình thức
    const hasStrongFormattingEvidence = similarityRate >= this.PLAGIARISM_THRESHOLD && quirkCount >= 2;

    let isFlagged = false;
    let status: PairwisePlagiarismResult['status'] = 'CLEAN';

    if (isTeacherMatch) {
      // Đối chiếu với bài mẫu Giảng viên -> Luôn sạch, tự động bảo lưu điểm
      status = 'CLEAN';
      isFlagged = false;
    } else if (similarityRate >= this.PLAGIARISM_THRESHOLD) {
      // Đạt ngưỡng cảnh báo/đạo văn (>= 70% hoặc >= 80%):
      // - Bài quá ngắn (<= 20 dòng) và không đủ >= 2 dấu vết trình bày trùng khớp:
      //   -> Giữ mức 'SUSPECTED' (Nghi vấn chờ Giảng viên kiểm tra trực tiếp, không auto-0đ)
      // - Bài đủ dài (> 20 dòng, đặc biệt bài 60+ dòng) HOẶC bài ngắn nhưng có >= 2 dấu vết trình bày:
      //   -> Áp chuẩn BR-03: FLAGGED_PLAGIARISM (0đ nếu >= 80%) hoặc FLAGGED_HIGH (>= 70%)
      if (isShortSubmission && !hasStrongFormattingEvidence) {
        status = 'SUSPECTED';
      } else {
        status = similarityRate >= this.CONFIRMED_ZERO_THRESHOLD ? 'FLAGGED_PLAGIARISM' : 'FLAGGED_HIGH';
      }
      isFlagged = true;
    } else if (similarityRate >= this.SUSPECTED_WARNING_THRESHOLD) {
      status = 'SUSPECTED';
      isFlagged = true;
    } else {
      status = 'CLEAN';
      isFlagged = false;
    }

    const matchedTokensJson: MatchedTokensJson = {
      submissionAId: subA.submissionId,
      submissionBId: subB.submissionId,
      similarityRate,
      jaccardSimilarity,
      containmentBinA,
      containmentAinB,
      maxContainment,
      totalUniqueFingerprintsA: sizeA,
      totalUniqueFingerprintsB: sizeB,
      commonFingerprintsCount: commonCount,
      matchedSegments,
      matchedQuirks,
      quirkCount,
      boilerplateFingerprintsFiltered: boilerplateFilteredCount,
      isShortSubmission,
    };

    return {
      submissionAId: subA.submissionId,
      submissionBId: subB.submissionId,
      similarityRate,
      commonFingerprintsCount: commonCount,
      totalUniqueFingerprints: unionSize,
      isFlagged,
      status,
      matchedTokensJson,
      matchedQuirks,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Ma trận N×N toàn lớp: so sánh mọi cặp bài nộp.
   * Tự động áp dụng Dynamic IDF lọc mã nguồn mẫu của thầy giáo.
   */
  public static computeClassSimilarityMatrix(
    submissions: CodeSubmission[],
    assignmentId?: string,
    options?: WinnowingOptions,
  ): ClassPlagiarismMatrixReport {
    const startTime = Date.now();
    const N = submissions.length;
    const similarityMatrix: number[][] = Array.from({ length: N }, () => Array(N).fill(100.0));
    const allPairs: PairwisePlagiarismResult[] = [];
    let pairsCount = 0;

    // ── 1. Dynamic IDF: Phát hiện các fingerprint boilerplate phổ biến cả lớp ──
    const hashDocFrequency = new Map<string, number>();
    for (const sub of submissions) {
      const norm = ASTNormalizer.normalize(sub.sourceCode, (sub.language || 'java').toLowerCase());
      const fps = WinnowingEngine.computeFingerprints(norm.tokens, options);
      const uniqueInDoc = new Set(fps.map((f) => f.hashValue));
      for (const h of uniqueInDoc) {
        hashDocFrequency.set(h, (hashDocFrequency.get(h) || 0) + 1);
      }
    }

    const commonTemplateHashes = new Set<string>();

    // Tự động phát hiện bài nộp của Thầy giáo / Giảng viên làm Template chuẩn để loại bỏ khỏi so sánh
    for (const sub of submissions) {
      const name = (sub.studentName || '').toLowerCase();
      if (name.includes('thầy') || name.includes('teacher') || name.includes('giảng viên')) {
        const norm = ASTNormalizer.normalize(sub.sourceCode, (sub.language || 'java').toLowerCase());
        const fps = WinnowingEngine.computeFingerprints(norm.tokens, options);
        for (const f of fps) {
          commonTemplateHashes.add(f.hashValue);
        }
      }
    }

    if (N >= 6) {
      // Chỉ khi lớp có >= 6 bài nộp và fingerprint xuất hiện ở >= 60% số bài (ít nhất 4 bài)
      // thì mới được coi là boilerplate khung bài của cả lớp
      const frequencyThreshold = Math.max(4, Math.ceil(N * 0.6));
      for (const [h, count] of hashDocFrequency.entries()) {
        if (count >= frequencyThreshold) {
          commonTemplateHashes.add(h);
        }
      }
    }

    const enhancedOptions = {
      ...(options || {}),
      commonTemplateHashes,
    };

    // ── 2. So sánh từng cặp (i, j) với bộ lọc boilerplate ─────────────────
    for (let i = 0; i < N; i++) {
      similarityMatrix[i][i] = 100.0;
      for (let j = i + 1; j < N; j++) {
        pairsCount++;
        const result = this.compareSubmissions(submissions[i], submissions[j], enhancedOptions);
        result.studentNameA = submissions[i].studentName || submissions[i].submissionId;
        result.studentNameB = submissions[j].studentName || submissions[j].submissionId;
        result.studentIdA = submissions[i].studentId || submissions[i].submissionId;
        result.studentIdB = submissions[j].studentId || submissions[j].submissionId;
        result.sourceCodeA = submissions[i].sourceCode;
        result.sourceCodeB = submissions[j].sourceCode;

        similarityMatrix[i][j] = result.similarityRate;
        similarityMatrix[j][i] = result.similarityRate;
        allPairs.push(result);
      }
    }

    // Phân loại các cặp so với Thầy giáo (Teacher Baseline) và các cặp giữa Sinh viên với nhau
    const teacherBaselinePairs: PairwisePlagiarismResult[] = [];
    for (const p of allPairs) {
      const isTeacher = (p.studentNameA || '').toLowerCase().includes('thầy') ||
                        (p.studentNameA || '').toLowerCase().includes('giảng viên') ||
                        (p.studentNameA || '').toLowerCase().includes('teacher') ||
                        (p.studentNameB || '').toLowerCase().includes('thầy') ||
                        (p.studentNameB || '').toLowerCase().includes('giảng viên') ||
                        (p.studentNameB || '').toLowerCase().includes('teacher');
      if (isTeacher) {
        teacherBaselinePairs.push(p);
      }
    }

    // Lọc tất cả các cặp có độ tương đồng >= 50% hoặc bị gắn cờ (CHỈ GIỮA CÁC SINH VIÊN VỚI NHAU)
    const significantPairs = allPairs.filter((p) => {
      const isTeacher = (p.studentNameA || '').toLowerCase().includes('thầy') ||
                        (p.studentNameA || '').toLowerCase().includes('giảng viên') ||
                        (p.studentNameA || '').toLowerCase().includes('teacher') ||
                        (p.studentNameB || '').toLowerCase().includes('thầy') ||
                        (p.studentNameB || '').toLowerCase().includes('giảng viên') ||
                        (p.studentNameB || '').toLowerCase().includes('teacher');
      if (isTeacher) return false;
      return p.similarityRate >= this.SUSPECTED_WARNING_THRESHOLD || p.isFlagged;
    });
    const flaggedReports = significantPairs.sort((a, b) => b.similarityRate - a.similarityRate);

    // ── 3. Thuật toán phân cụm đồ thị liên thông (Union-Find) ────────────
    const parent = new Map<number, number>();
    for (let i = 0; i < N; i++) parent.set(i, i);

    const find = (i: number): number => {
      let root = i;
      while (root !== parent.get(root)!) root = parent.get(root)!;
      let curr = i;
      while (curr !== root) {
        const nxt = parent.get(curr)!;
        parent.set(curr, root);
        curr = nxt;
      }
      return root;
    };

    const union = (i: number, j: number) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent.set(rootI, rootJ);
    };

    // Nối các đỉnh nếu thực sự bị gắn cờ gian lận (pair.isFlagged === true)
    // TUYỆT ĐỐI LOẠI BỎ THẦY GIÁO khỏi mạng lưới phân cụm đạo văn!
    for (let i = 0; i < N; i++) {
      const nameI = (submissions[i].studentName || '').toLowerCase();
      const isTeacherI = nameI.includes('thầy') || nameI.includes('teacher') || nameI.includes('giảng viên');
      if (isTeacherI) continue;

      for (let j = i + 1; j < N; j++) {
        const nameJ = (submissions[j].studentName || '').toLowerCase();
        const isTeacherJ = nameJ.includes('thầy') || nameJ.includes('teacher') || nameJ.includes('giảng viên');
        if (isTeacherJ) continue;

        const pair = allPairs.find(
          (p) =>
            (p.submissionAId === submissions[i].submissionId && p.submissionBId === submissions[j].submissionId) ||
            (p.submissionAId === submissions[j].submissionId && p.submissionBId === submissions[i].submissionId),
        );
        if (pair?.isFlagged) {
          union(i, j);
        }
      }
    }

    // Nhóm các chỉ số theo root (bỏ qua bài mẫu của Thầy/Giảng viên)
    const componentMap = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      const nameI = (submissions[i].studentName || '').toLowerCase();
      const isTeacherI = nameI.includes('thầy') || nameI.includes('teacher') || nameI.includes('giảng viên');
      if (isTeacherI) continue;

      const r = find(i);
      if (!componentMap.has(r)) componentMap.set(r, []);
      componentMap.get(r)!.push(i);
    }

    const clusters: PlagiarismCluster[] = [];
    const independentSubmissions: { id: string; name?: string; studentId?: string }[] = [];

    let clusterIdx = 1;
    for (const [, memberIndices] of componentMap.entries()) {
      if (memberIndices.length >= 2) {
        // Nhóm có từ 2 sinh viên trở lên chép bài nhau
        const memberSubmissions = memberIndices.map((idx) => ({
          submissionId: submissions[idx].submissionId,
          studentId: submissions[idx].studentId || submissions[idx].submissionId,
          studentName: submissions[idx].studentName || submissions[idx].submissionId,
          sourceCode: submissions[idx].sourceCode,
        }));

        // Tìm tất cả các cặp trong nhóm này
        const clusterPairs: PairwisePlagiarismResult[] = [];
        let maxSim = 0;
        for (let a = 0; a < memberIndices.length; a++) {
          for (let b = a + 1; b < memberIndices.length; b++) {
            const idxA = memberIndices[a];
            const idxB = memberIndices[b];
            const nameA = (submissions[idxA].studentName || '').toLowerCase();
            const nameB = (submissions[idxB].studentName || '').toLowerCase();
            const isTeacher = nameA.includes('thầy') || nameA.includes('giảng viên') || nameA.includes('teacher') ||
                              nameB.includes('thầy') || nameB.includes('giảng viên') || nameB.includes('teacher');
            if (isTeacher) continue;

            const subAId = submissions[idxA].submissionId;
            const subBId = submissions[idxB].submissionId;
            const pairMatch = allPairs.find(
              (p) =>
                (p.submissionAId === subAId && p.submissionBId === subBId) ||
                (p.submissionAId === subBId && p.submissionBId === subAId),
            );
            if (pairMatch) {
              clusterPairs.push(pairMatch);
              if (pairMatch.similarityRate > maxSim) maxSim = pairMatch.similarityRate;
            }
          }
        }

        clusterPairs.sort((a, b) => b.similarityRate - a.similarityRate);

        const hasConfirmedZero = clusterPairs.some((p) => p.status === 'FLAGGED_PLAGIARISM');
        const hasFlagged = clusterPairs.some((p) => p.status === 'FLAGGED_HIGH' || p.status === 'FLAGGED_PLAGIARISM');
        let riskLevel: PlagiarismCluster['riskLevel'] = 'WARNING';
        if (hasConfirmedZero) riskLevel = 'CONFIRMED_ZERO';
        else if (hasFlagged) riskLevel = 'FLAGGED';

        clusters.push({
          clusterId: clusterIdx,
          clusterName: `Nhóm Đạo Văn ${clusterIdx} (${memberIndices.length} sinh viên)`,
          studentCount: memberIndices.length,
          students: memberSubmissions,
          pairs: clusterPairs,
          maxSimilarity: maxSim,
          riskLevel,
        });
        clusterIdx++;
      } else {
        // Sinh viên nộp bài độc lập, an toàn
        const idx = memberIndices[0];
        independentSubmissions.push({
          id: submissions[idx].submissionId,
          name: submissions[idx].studentName || submissions[idx].submissionId,
          studentId: submissions[idx].studentId,
        });
      }
    }

    // Sắp xếp các cụm theo maxSimilarity giảm dần (nhóm nghiêm trọng nhất lên đầu)
    clusters.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    // Cập nhật lại số thứ tự clusterId
    clusters.forEach((c, idx) => {
      c.clusterId = idx + 1;
      c.clusterName = `Nhóm Đạo Văn ${idx + 1} (${c.studentCount} sinh viên)`;
    });

    // ── Tính đối soát độc lập chéo giữa các nhóm (Cross-Cluster Independence) ──
    const crossClusterIndependence: CrossClusterIndependence[] = [];
    for (let c1 = 0; c1 < clusters.length; c1++) {
      for (let c2 = c1 + 1; c2 < clusters.length; c2++) {
        const cluster1 = clusters[c1];
        const cluster2 = clusters[c2];
        let maxCrossSim = 0;
        let samplePair: CrossClusterIndependence['samplePair'] | undefined;

        for (const s1 of cluster1.students) {
          for (const s2 of cluster2.students) {
            const pairMatch = allPairs.find(
              (p) =>
                (p.submissionAId === s1.submissionId && p.submissionBId === s2.submissionId) ||
                (p.submissionAId === s2.submissionId && p.submissionBId === s1.submissionId),
            );
            const sim = pairMatch ? pairMatch.similarityRate : 0;
            if (sim >= maxCrossSim) {
              maxCrossSim = sim;
              if (pairMatch) {
                samplePair = {
                  submissionAId: s1.submissionId,
                  submissionBId: s2.submissionId,
                  studentNameA: s1.studentName,
                  studentNameB: s2.studentName,
                  similarityRate: sim,
                };
              }
            }
          }
        }

        crossClusterIndependence.push({
          clusterAId: cluster1.clusterId,
          clusterBId: cluster2.clusterId,
          clusterAName: cluster1.clusterName,
          clusterBName: cluster2.clusterName,
          maxCrossSimilarity: maxCrossSim,
          samplePair,
          isIndependent: maxCrossSim < this.SUSPECTED_WARNING_THRESHOLD,
        });
      }
    }

    return {
      assignmentId,
      totalSubmissions: N,
      totalPairsCompared: pairsCount,
      flaggedPairsCount: flaggedReports.length,
      submissionsList: submissions.map((s) => ({
        id: s.submissionId,
        name: s.studentName || s.submissionId,
        studentId: s.studentId,
        sourceCode: s.sourceCode,
        language: s.language,
      })),
      similarityMatrix,
      flaggedReports,
      clusters,
      teacherBaselinePairs,
      independentSubmissions,
      crossClusterIndependence,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }
}
