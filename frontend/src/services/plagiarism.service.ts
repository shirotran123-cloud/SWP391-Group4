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

  /**
   * Đánh giá đối soát một bài nộp với danh sách bài nộp khác (hoặc tập dữ liệu mẫu).
   * Lọc những bài có độ tương đồng >= 50% (nghi vấn / cảnh báo), sắp xếp giảm dần theo similarityRate.
   */
  public static async getSimilarSubmissions(
    sourceCode: string,
    language: string = "python",
    studentAName: string = "Bài nộp hiện tại",
    customCandidates?: Array<{ studentName: string; studentId: string; sourceCode: string; language?: string }>
  ): Promise<PlagiarismMatch[]> {
    const subA: CodeSubmission = {
      submissionId: "SUB-CURRENT",
      studentName: studentAName,
      studentId: "SE-CURRENT",
      sourceCode,
      language,
    };

    const candidatePool: Array<{ studentName: string; studentId: string; sourceCode: string; language?: string }> = [];

    if (customCandidates && customCandidates.length > 0) {
      candidatePool.push(...customCandidates);
    }

    // Nạp thêm từ benchmark pairs nếu hồ sơ kiểm thử cần thêm mẫu đối chiếu
    if (candidatePool.length < 3) {
      for (const pair of RBL_BENCHMARK_PAIRS) {
        if (!candidatePool.some((c) => c.studentId === `RBL-TEST-0${pair.pairId}`)) {
          candidatePool.push({
            studentName: `${pair.title}`,
            studentId: `RBL-TEST-0${pair.pairId}`,
            sourceCode: pair.codeB,
            language: "python",
          });
        }
      }
    }

    const matches: PlagiarismMatch[] = [];

    for (const c of candidatePool) {
      try {
        const subB: CodeSubmission = {
          submissionId: `CANDIDATE-${c.studentId}`,
          studentName: c.studentName,
          studentId: c.studentId,
          sourceCode: c.sourceCode,
          language: c.language || language,
        };
        const res = ASTPlagiarismEngine.compareSubmissions(subA, subB);
        if (res.similarityRate >= 50.0) {
          matches.push(this.mapResultToMatch(subA, subB, res));
        }
      } catch (err) {
        console.warn(`Lỗi đối soát với candidate ${c.studentId}:`, err);
      }
    }

    // Sắp xếp bài có % tương đồng cao nhất lên đầu (descending)
    matches.sort((a, b) => b.similarityRate - a.similarityRate);
    return matches;
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
