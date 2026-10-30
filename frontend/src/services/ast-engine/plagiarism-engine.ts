import { ASTNormalizer, type NormalizedToken } from "./ast-normalizer";
import { WinnowingEngine, type Fingerprint, type WinnowingOptions } from "./winnowing";

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
  winnowingContainment: number;
  astStructuralSimilarity: number;
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
  similarityRate: number;
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  isFlagged: boolean;
  status: "CLEAN" | "SUSPECTED" | "FLAGGED_HIGH" | "FLAGGED_PLAGIARISM";
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
  public static readonly PLAGIARISM_THRESHOLD = 70.0;
  public static readonly CONFIRMED_ZERO_THRESHOLD = 80.0;
  public static readonly SUSPECTED_WARNING_THRESHOLD = 50.0;

  public static compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions
  ): PairwisePlagiarismResult {
    const startTime = Date.now();

    const normA = ASTNormalizer.normalize(subA.sourceCode, subA.language || "python");
    const normB = ASTNormalizer.normalize(subB.sourceCode, subB.language || "python");

    const fingerprintsA = WinnowingEngine.computeFingerprints(normA.tokens, options);
    const fingerprintsB = WinnowingEngine.computeFingerprints(normB.tokens, options);

    const setAHashes = new Set(fingerprintsA.map((f) => f.hashValue));
    const setBHashes = new Set(fingerprintsB.map((f) => f.hashValue));

    const mapB = new Map<string, Fingerprint[]>();
    for (const f of fingerprintsB) {
      if (!mapB.has(f.hashValue)) mapB.set(f.hashValue, []);
      mapB.get(f.hashValue)!.push(f);
    }

    const matchedSegments: MatchedSegment[] = [];

    for (const fA of fingerprintsA) {
      if (setBHashes.has(fA.hashValue)) {
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

    const unionSet = new Set([...setAHashes, ...setBHashes]);
    const unionSize = unionSet.size === 0 ? 1 : unionSet.size;

    const commonHashesSet = new Set(
      [...setAHashes].filter((h) => setBHashes.has(h))
    );
    const commonCount = commonHashesSet.size;

    const jaccardSimilarity = Number(((commonCount / unionSize) * 100).toFixed(2));
    const minSetSize = Math.min(setAHashes.size, setBHashes.size);
    const winnowingContainment = minSetSize > 0 
      ? Number(((commonCount / minSetSize) * 100).toFixed(2)) 
      : 0.0;

    const astStructuralSimilarity = this.computeASTTokenCosineSimilarity(normA.tokens, normB.tokens);

    let similarityRate = 0.0;
    if (winnowingContainment >= 99.0) {
      similarityRate = 100.0;
    } else {
      similarityRate = Number(
        (0.65 * winnowingContainment + 0.35 * astStructuralSimilarity).toFixed(2)
      );
    }

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
      winnowingContainment,
      astStructuralSimilarity,
      totalUniqueFingerprintsA: setAHashes.size,
      totalUniqueFingerprintsB: setBHashes.size,
      commonFingerprintsCount: commonCount,
      matchedSegments,
    };

    const executionTimeMs = Date.now() - startTime;

    return {
      submissionAId: subA.submissionId,
      submissionBId: subB.submissionId,
      similarityRate,
      commonFingerprintsCount: commonCount,
      totalUniqueFingerprints: unionSize,
      isFlagged,
      status,
      matchedTokensJson,
      executionTimeMs,
    };
  }

  private static computeASTTokenCosineSimilarity(tokensA: NormalizedToken[], tokensB: NormalizedToken[]): number {
    const freqA = new Map<string, number>();
    const freqB = new Map<string, number>();

    for (const t of tokensA) freqA.set(t.token, (freqA.get(t.token) || 0) + 1);
    for (const t of tokensB) freqB.set(t.token, (freqB.get(t.token) || 0) + 1);

    const allKeys = new Set([...freqA.keys(), ...freqB.keys()]);
    if (allKeys.size === 0) return 100.0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (const key of allKeys) {
      const valA = freqA.get(key) || 0;
      const valB = freqB.get(key) || 0;
      dotProduct += valA * valB;
      magA += valA * valA;
      magB += valB * valB;
    }

    if (magA === 0 || magB === 0) return 0.0;

    const cosine = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
    return Number((cosine * 100).toFixed(2));
  }

  public static computeClassSimilarityMatrix(
    submissions: CodeSubmission[],
    assignmentId?: string,
    options?: WinnowingOptions
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

    const significantPairs = allPairs.filter((p) => p.similarityRate >= this.SUSPECTED_WARNING_THRESHOLD);
    const flaggedReports = significantPairs.sort((a, b) => b.similarityRate - a.similarityRate);

    // Connected components clustering
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

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (similarityMatrix[i][j] >= this.SUSPECTED_WARNING_THRESHOLD) {
          union(i, j);
        }
      }
    }

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
        const memberSubmissions = memberIndices.map((idx) => ({
          submissionId: submissions[idx].submissionId,
          studentId: submissions[idx].studentId || submissions[idx].submissionId,
          studentName: submissions[idx].studentName || submissions[idx].submissionId,
          sourceCode: submissions[idx].sourceCode,
        }));

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
        const idx = memberIndices[0];
        independentSubmissions.push({
          id: submissions[idx].submissionId,
          name: submissions[idx].studentName || submissions[idx].submissionId,
          studentId: submissions[idx].studentId,
        });
      }
    }

    clusters.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    clusters.forEach((c, idx) => {
      c.clusterId = idx + 1;
      c.clusterName = `Nhóm Đạo Văn ${idx + 1} (${c.studentCount} sinh viên)`;
    });

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
