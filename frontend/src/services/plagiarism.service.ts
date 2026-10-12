import { ASTPlagiarismEngine, type CodeSubmission, type PairwisePlagiarismResult } from "./ast-engine/plagiarism-engine";
import { RBL_BENCHMARK_PAIRS, type BenchmarkPair } from "./ast-engine/rbl-benchmark-pairs";
import type { PlagiarismMatch } from "../types";

const GENAI_API_URLS = [
  "http://localhost:3002/api/v1/ast/compare",
  "http://localhost:3001/api/v1/ast/compare",
];

export class PlagiarismService {
  /**
   * Evaluates pairwise plagiarism between two submissions using REAL AST Normalizer & Winnowing.
   * Tries to call GenAI Hub REST API first; falls back to embedded ASTPlagiarismEngine if offline.
   */
  public static async compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission
  ): Promise<PlagiarismMatch> {
    const startTime = performance.now();

    // 1. Try remote GenAI Hub API
    for (const url of GENAI_API_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionA: subA, submissionB: subB }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data: PairwisePlagiarismResult = await response.json();
          console.log(`[PlagiarismService] Real comparison calculated via GenAI Hub (${url}) in ${Math.round(performance.now() - startTime)}ms: ${data.similarityRate}%`);
          return this.mapResultToMatch(subA, subB, data);
        }
      } catch {
        // Fallback to local embedded engine
      }
    }

    // 2. Embedded Client-side Real AST Engine execution
    console.log("[PlagiarismService] Running embedded AST Normalizer & Winnowing Engine on real code...");
    const result = ASTPlagiarismEngine.compareSubmissions(subA, subB);
    const duration = Math.round(performance.now() - startTime);
    console.log(`[PlagiarismService] Real AST Engine completed in ${duration}ms: Similarity = ${result.similarityRate}%`);

    return this.mapResultToMatch(subA, subB, result);
  }

  /**
   * Helper to evaluate a benchmark pair from the RBL dataset
   */
  public static async evaluateBenchmarkPair(pairId: number): Promise<PlagiarismMatch> {
    const pair = RBL_BENCHMARK_PAIRS.find((p) => p.pairId === pairId) || RBL_BENCHMARK_PAIRS[0];
    const subA: CodeSubmission = {
      submissionId: `STUDENT-${pair.pairId}`,
      studentName: "Văn Thái Trung (Bài nộp của bạn)",
      studentId: "SE170000",
      sourceCode: pair.codeA,
      language: "python",
    };
    const subB: CodeSubmission = {
      submissionId: `BENCHMARK-${pair.pairId}`,
      studentName: `${pair.title}`,
      studentId: `RBL-TEST-0${pair.pairId}`,
      sourceCode: pair.codeB,
      language: "python",
    };

    return this.compareSubmissions(subA, subB);
  }

  public static getBenchmarkPairs(): BenchmarkPair[] {
    return RBL_BENCHMARK_PAIRS;
  }

  private static mapResultToMatch(
    subA: CodeSubmission,
    subB: CodeSubmission,
    result: PairwisePlagiarismResult
  ): PlagiarismMatch {
    const matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }> =
      result.matchedTokensJson.matchedSegments.map((s) => ({
        lineA: [s.lineRangeA.start, s.lineRangeA.end],
        lineB: [s.lineRangeB.start, s.lineRangeB.end],
      }));

    return {
      matchedStudentName: subB.studentName || "Trần Thanh Nguyên (Kho bài lớp)",
      matchedStudentId: subB.studentId || "SE170123",
      similarityRate: result.similarityRate,
      sourceCodeA: subA.sourceCode,
      sourceCodeB: subB.sourceCode,
      matchedTokens,
      executionTimeMs: result.executionTimeMs,
      isFlagged: result.isFlagged,
      jaccardSimilarity: result.matchedTokensJson.jaccardSimilarity,
      winnowingContainment: result.matchedTokensJson.winnowingContainment,
      astStructuralSimilarity: result.matchedTokensJson.astStructuralSimilarity,
      status: result.status,
    };
  }
}
