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

import { ASTNormalizer, NormalizedToken } from './ast-normalizer';
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
  isFlagged: boolean;             // similarityRate ≥ PLAGIARISM_THRESHOLD
  status: 'CLEAN' | 'SUSPECTED' | 'FLAGGED_HIGH' | 'FLAGGED_PLAGIARISM';
  matchedTokensJson: MatchedTokensJson;
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
   * Metric chính: maxContainment (Containment Index).
   */
  public static compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions,
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

    // ── 3. Tính Containment Index ─────────────────────────────────────────
    const setA = new Set(fpA.map((f) => f.hashValue));
    const setB = new Set(fpB.map((f) => f.hashValue));

    // Build lookup map cho B để lấy line info khi match
    const mapB = new Map<string, Fingerprint[]>();
    for (const f of fpB) {
      if (!mapB.has(f.hashValue)) mapB.set(f.hashValue, []);
      mapB.get(f.hashValue)!.push(f);
    }

    // Tìm các đoạn trùng khớp
    const matchedSegments: MatchedSegment[] = [];
    const commonHashes = new Set<string>();

    for (const fA of fpA) {
      if (setB.has(fA.hashValue)) {
        commonHashes.add(fA.hashValue);
        const matchesInB = mapB.get(fA.hashValue) || [];
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
    const sizeA = setA.size;
    const sizeB = setB.size;
    const unionSize = new Set([...setA, ...setB]).size || 1;

    // Jaccard = |A ∩ B| / |A ∪ B|  (KHÔNG dùng làm metric chính)
    const jaccardSimilarity = Number(((commonCount / unionSize) * 100).toFixed(2));

    // Containment(B→A): bao nhiêu % fingerprint của B bị chứa trong A
    const containmentBinA = sizeB > 0
      ? Number(((commonCount / sizeB) * 100).toFixed(2))
      : 0.0;

    // Containment(A→B): bao nhiêu % fingerprint của A bị chứa trong B
    const containmentAinB = sizeA > 0
      ? Number(((commonCount / sizeA) * 100).toFixed(2))
      : 0.0;

    // ── 4. similarityRate = maxContainment ───────────────────────────────
    //  Ý nghĩa: "bài nào ngắn hơn bị chứa bao nhiêu % trong bài kia"
    //  Nếu B (2 câu) ⊂ A (4 câu): containmentBinA=100% → similarity=100%
    const maxContainment = Math.max(containmentBinA, containmentAinB);
    const similarityRate = Number(maxContainment.toFixed(2));

    // ── 5. Phân loại theo ngưỡng (BR-03: >= 50% Cảnh báo, >= 70% Gắn cờ, >= 80% Điểm 0) ───
    const isFlagged = similarityRate >= this.PLAGIARISM_THRESHOLD;
    let status: PairwisePlagiarismResult['status'];
    if (similarityRate >= this.CONFIRMED_ZERO_THRESHOLD) status = 'FLAGGED_PLAGIARISM';
    else if (similarityRate >= this.PLAGIARISM_THRESHOLD) status = 'FLAGGED_HIGH';
    else if (similarityRate >= this.SUSPECTED_WARNING_THRESHOLD) status = 'SUSPECTED';
    else status = 'CLEAN';

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
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Ma trận N×N toàn lớp: so sánh mọi cặp bài nộp.
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

    for (let i = 0; i < N; i++) {
      similarityMatrix[i][i] = 100.0;
      for (let j = i + 1; j < N; j++) {
        pairsCount++;
        const result = this.compareSubmissions(submissions[i], submissions[j], options);
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

    // Lọc tất cả các cặp có độ tương đồng >= 50% (nghi vấn, gắn cờ, điểm 0)
    const significantPairs = allPairs.filter((p) => p.similarityRate >= this.SUSPECTED_WARNING_THRESHOLD);
    const flaggedReports = significantPairs.sort((a, b) => b.similarityRate - a.similarityRate);

    // ── Thuật toán phân cụm đồ thị liên thông (Connected Components / Clusters) ──
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

    // Nối các đỉnh có cạnh similarity >= 50.0%
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (similarityMatrix[i][j] >= this.SUSPECTED_WARNING_THRESHOLD) {
          union(i, j);
        }
      }
    }

    // Nhóm các chỉ số theo root
    const componentMap = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
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

        let riskLevel: PlagiarismCluster['riskLevel'] = 'WARNING';
        if (maxSim >= this.CONFIRMED_ZERO_THRESHOLD) riskLevel = 'CONFIRMED_ZERO';
        else if (maxSim >= this.PLAGIARISM_THRESHOLD) riskLevel = 'FLAGGED';

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
      independentSubmissions,
      crossClusterIndependence,
      totalExecutionTimeMs: Date.now() - startTime,
    };
  }
}
