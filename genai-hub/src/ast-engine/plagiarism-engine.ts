/**
 * Plagiarism Engine Core - RBL Research Core (AITA Autograding Engine)
 *
 * Computes pairwise Jaccard & Hybrid AST similarity matrices over Winnowing digital fingerprints
 * and AST structural token profiles. Flags plagiarized submissions >= 70% threshold,
 * and exports fine-grained token & line mapping coordinates (matched_tokens_json) for Monaco Diff Viewer.
 */

import { ASTNormalizer, NormalizedToken, NormalizationResult } from "./ast-normalizer";
import { Fingerprint, WinnowingEngine, WinnowingOptions } from "./winnowing";
import { parsePythonSources } from "./real-ast-parser";

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
  similarityRate: number; // Ensemble similarity score
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  isFlagged: boolean; // >= 70% threshold
  status: "CLEAN" | "SUSPECTED" | "FLAGGED_HIGH" | "FLAGGED_PLAGIARISM";
  matchedTokensJson: MatchedTokensJson;
  executionTimeMs: number;
}

export interface ClassPlagiarismMatrixReport {
  assignmentId?: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number; // Pairs >= 70%
  submissionsList: { id: string; name?: string }[];
  similarityMatrix: number[][]; // N x N matrix (percentage values)
  flaggedReports: PairwisePlagiarismResult[];
  totalExecutionTimeMs: number;
}

export class ASTPlagiarismEngine {
  public static readonly PLAGIARISM_THRESHOLD = 70.0; // 70% by task spec

  /**
   * Compares two submissions using the REAL Python `ast` module when available.
   *
   * This is the Milestone 2 requirement: *"AST Parser (sử dụng Python `ast` module...)"*. The
   * synchronous `compareSubmissions` above tokenises with regular expressions, which produces
   * AST-shaped labels without a parse tree. Here the source is handed to Python, which walks the
   * genuine tree, and the resulting structural tokens feed the same Winnowing + cosine pipeline.
   *
   * Degradation is deliberate and explicit: when Python is unavailable, or the source is not
   * valid Python (Java/C++ submissions, for instance), the result is computed by the regex
   * normaliser and `astSource` reports `"REGEX_FALLBACK"` so the caller can say which engine
   * actually judged the pair. Silently comparing with the weaker parser would make the
   * plagiarism verdict look stronger than it is.
   */
  public static async compareSubmissionsWithRealAst(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions
  ): Promise<PairwisePlagiarismResult & { astSource: "PYTHON_AST" | "REGEX_FALLBACK" }> {
    const languageA = (subA.language || "python").toLowerCase();
    const languageB = (subB.language || "python").toLowerCase();

    // The Python `ast` module can only judge Python. Anything else uses the regex tokeniser,
    // which is language-agnostic by design.
    if (languageA === "python" && languageB === "python") {
      const parsed = await parsePythonSources({
        A: subA.sourceCode,
        B: subB.sourceCode,
      });

      if (parsed && parsed.A.ok && parsed.B.ok) {
        const result = this.compareNormalizedTokens(
          subA,
          subB,
          {
            tokens: parsed.A.tokens,
            normalizedString: parsed.A.tokens.map((t) => t.token).join(" "),
            totalLines: subA.sourceCode.split("\n").length,
            totalOriginalTokensCount: parsed.A.tokens.length,
          },
          {
            tokens: parsed.B.tokens,
            normalizedString: parsed.B.tokens.map((t) => t.token).join(" "),
            totalLines: subB.sourceCode.split("\n").length,
            totalOriginalTokensCount: parsed.B.tokens.length,
          },
          options
        );
        return { ...result, astSource: "PYTHON_AST" };
      }
    }

    const result = this.compareSubmissions(subA, subB, options);
    return { ...result, astSource: "REGEX_FALLBACK" };
  }

  /**
   * Compares two single submissions and computes Jaccard + Winnowing Containment + AST Structural Cosine Similarity
   */
  public static compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions
  ): PairwisePlagiarismResult {
    const startTime = Date.now();

    // 1. AST Normalize
    const normA = ASTNormalizer.normalize(subA.sourceCode, subA.language || "python");
    const normB = ASTNormalizer.normalize(subB.sourceCode, subB.language || "python");

    return this.compareNormalizedTokens(subA, subB, normA, normB, options);
  }

  /**
   * The comparison itself, independent of how the token streams were produced.
   *
   * Split out so the real-AST path and the regex path cannot drift apart: both feed the same
   * fingerprinting, containment and ensemble arithmetic, and only the tokeniser differs.
   */
  private static compareNormalizedTokens(
    subA: CodeSubmission,
    subB: CodeSubmission,
    normA: NormalizationResult,
    normB: NormalizationResult,
    options?: WinnowingOptions
  ): PairwisePlagiarismResult {
    const startTime = Date.now();

    // 2. Compute Winnowing Fingerprints
    const fingerprintsA = WinnowingEngine.computeFingerprints(normA.tokens, options);
    const fingerprintsB = WinnowingEngine.computeFingerprints(normB.tokens, options);

    // 3. Winnowing Containment & Jaccard Calculation
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

    // 4. AST Structural Vector Cosine Similarity
    const astStructuralSimilarity = this.computeASTTokenCosineSimilarity(normA.tokens, normB.tokens);

    // 5. Ensemble Similarity Rate (70% Winnowing + 30% AST Structural Profile)
    // If winnowing containment is 100% (exact match), similarity is 100%
    let similarityRate = 0.0;
    if (winnowingContainment >= 99.0) {
      similarityRate = 100.0;
    } else {
      similarityRate = Number(
        (0.65 * winnowingContainment + 0.35 * astStructuralSimilarity).toFixed(2)
      );
    }

    const isFlagged = similarityRate >= this.PLAGIARISM_THRESHOLD;
    const status = isFlagged ? "FLAGGED_PLAGIARISM" : similarityRate >= 40.0 ? "SUSPECTED" : "CLEAN";

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

  /**
   * Computes Cosine Similarity between AST Token Frequency Distributions
   */
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

  /**
   * Computes full pairwise class Similarity Matrix across all submissions in a class/assignment.
   * Automatically extracts and flags pairs with similarity >= 70%.
   */
  public static computeClassSimilarityMatrix(
    submissions: CodeSubmission[],
    assignmentId?: string,
    options?: WinnowingOptions
  ): ClassPlagiarismMatrixReport {
    const startTime = Date.now();
    const N = submissions.length;
    const similarityMatrix: number[][] = Array.from({ length: N }, () => Array(N).fill(100.0));
    const flaggedReports: PairwisePlagiarismResult[] = [];
    let pairsCount = 0;

    for (let i = 0; i < N; i++) {
      similarityMatrix[i][i] = 100.0;
      for (let j = i + 1; j < N; j++) {
        pairsCount++;
        const result = this.compareSubmissions(submissions[i], submissions[j], options);
        
        similarityMatrix[i][j] = result.similarityRate;
        similarityMatrix[j][i] = result.similarityRate;

        if (result.isFlagged) {
          flaggedReports.push(result);
        }
      }
    }

    const totalExecutionTimeMs = Date.now() - startTime;

    return {
      assignmentId,
      totalSubmissions: N,
      totalPairsCompared: pairsCount,
      flaggedPairsCount: flaggedReports.length,
      submissionsList: submissions.map((s) => ({
        id: s.submissionId,
        name: s.studentName || s.submissionId,
      })),
      similarityMatrix,
      flaggedReports: flaggedReports.sort((a, b) => b.similarityRate - a.similarityRate),
      totalExecutionTimeMs,
    };
  }

  /**
   * Class-wide matrix using the REAL Python `ast` module.
   *
   * The class matrix is what the gateway actually asks for, so this is where the real parser has
   * to be used for the change to matter in grading rather than only in a benchmark.
   *
   * Sources are parsed in ONE batch rather than per pair: an N-submission assignment has
   * N(N-1)/2 pairs, and spawning a Python process per pair would make the parser cost dominate
   * the whole plagiarism stage. The token streams are computed once and then compared
   * pairwise with the same arithmetic as the synchronous version.
   *
   * The report gains `astSource`, so a caller can state which engine judged the class instead of
   * implying the stronger one was used.
   */
  public static async computeClassSimilarityMatrixWithRealAst(
    submissions: CodeSubmission[],
    assignmentId?: string,
    options?: WinnowingOptions
  ): Promise<ClassPlagiarismMatrixReport & { astSource: 'PYTHON_AST' | 'REGEX_FALLBACK' }> {
    const startTime = Date.now();
    const N = submissions.length;

    // Only Python submissions can go through the Python parser. Mixed-language cohorts fall
    // back wholesale rather than mixing engines within one matrix, which would make two pairs
    // in the same table incomparable.
    const allPython = submissions.every(
      (s) => (s.language || 'python').toLowerCase() === 'python',
    );

    let tokenStreams: NormalizationResult[] | null = null;
    let astSource: 'PYTHON_AST' | 'REGEX_FALLBACK' = 'REGEX_FALLBACK';

    if (allPython && N > 0) {
      const payload: Record<string, string> = {};
      for (const s of submissions) payload[s.submissionId] = s.sourceCode;

      const parsed = await parsePythonSources(payload);
      if (parsed && submissions.every((s) => parsed[s.submissionId]?.ok)) {
        tokenStreams = submissions.map((s) => {
          const tokens = parsed[s.submissionId].tokens;
          return {
            tokens,
            normalizedString: tokens.map((t) => t.token).join(' '),
            totalLines: s.sourceCode.split('\n').length,
            totalOriginalTokensCount: tokens.length,
          };
        });
        astSource = 'PYTHON_AST';
      }
    }

    if (!tokenStreams) {
      const fallback = this.computeClassSimilarityMatrix(submissions, assignmentId, options);
      return { ...fallback, astSource: 'REGEX_FALLBACK' };
    }

    const similarityMatrix: number[][] = Array.from({ length: N }, () => Array(N).fill(100.0));
    const flaggedReports: PairwisePlagiarismResult[] = [];
    let pairsCount = 0;

    for (let i = 0; i < N; i++) {
      similarityMatrix[i][i] = 100.0;
      for (let j = i + 1; j < N; j++) {
        pairsCount++;
        const result = this.compareNormalizedTokens(
          submissions[i],
          submissions[j],
          tokenStreams[i],
          tokenStreams[j],
          options,
        );

        similarityMatrix[i][j] = result.similarityRate;
        similarityMatrix[j][i] = result.similarityRate;

        if (result.isFlagged) flaggedReports.push(result);
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
      })),
      similarityMatrix,
      flaggedReports: flaggedReports.sort((a, b) => b.similarityRate - a.similarityRate),
      totalExecutionTimeMs: Date.now() - startTime,
      astSource,
    };
  }
}
