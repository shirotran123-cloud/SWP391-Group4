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
  similarityRate: number;
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  isFlagged: boolean;
  status: "CLEAN" | "SUSPECTED" | "FLAGGED_HIGH" | "FLAGGED_PLAGIARISM";
  matchedTokensJson: MatchedTokensJson;
  executionTimeMs: number;
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
}
