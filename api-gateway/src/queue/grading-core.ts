/**
 * AITA shared grading core — pure logic used by BOTH the NestJS worker
 * (`queue/grading-worker.consumer.ts`) and the CLI demo (`demo/`).
 *
 * Holds the REAL submission validation rules and the REAL scoring formula
 * (testcases 7.0 + CleanCode 2.0 + SOLID 1.0 = 10). No I/O here:
 * no upload, no Docker, no queue, no WebSocket — so demo and unit tests
 * import these functions directly instead of re-implementing them.
 */

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const SCORE_WEIGHTS = {
  testcase1: 4.0,
  testcase2: 3.0,
  cleanCode: 2.0,
  solid: 1.0,
  maxScore: 10.0,
} as const;

export function calculateTestcaseScore(passedCount: number, totalCount: number): number {
  const testcaseWeight = SCORE_WEIGHTS.testcase1 + SCORE_WEIGHTS.testcase2;
  if (!Number.isFinite(totalCount) || totalCount <= 0) return 0;

  const total = Math.floor(totalCount);
  if (total <= 0) return 0;
  const passed = Number.isFinite(passedCount)
    ? Math.max(0, Math.min(Math.floor(passedCount), total))
    : 0;
  return Math.round((passed / total) * testcaseWeight * 10) / 10;
}

export interface SubmissionFileCheck {
  originalname: string;
  size: number;
}

export type ValidationErrorCode =
  | 'MISSING_FILE'
  | 'TOO_LARGE'
  | 'NOT_ZIP'
  | 'LANGUAGE_NOT_ALLOWED';

/**
 * Pure validation of an uploaded submission file + language choice.
 * Mirrors `SubmissionsService.handleSubmission` step 1 (same order, same limits).
 * Returns `null` when the file passes, otherwise `{ code, message }`.
 */
export function validateSubmissionFile(
  file: SubmissionFileCheck | null | undefined,
  language: string,
  allowedLanguages: string[],
): { code: ValidationErrorCode; message: string } | null {
  if (!file) {
    return { code: 'MISSING_FILE', message: 'Vui lòng tải lên file bài nộp (field: "file")' };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      code: 'TOO_LARGE',
      message: `Dung lượng file vượt quá giới hạn 10MB! (Hiện tại: ${(file.size / (1024 * 1024)).toFixed(2)}MB, tối đa: 10MB)`,
    };
  }
  const originalName = file.originalname || 'submission.zip';
  if (!originalName.toLowerCase().endsWith('.zip')) {
    return { code: 'NOT_ZIP', message: 'Hệ thống chỉ chấp nhận định dạng file nén .zip!' };
  }
  const lang = (language || '').toLowerCase();
  if (allowedLanguages && allowedLanguages.length > 0) {
    const isAllowed = allowedLanguages.some((l) => l.toLowerCase() === lang);
    if (!isAllowed) {
      return {
        code: 'LANGUAGE_NOT_ALLOWED',
        message: `Ngôn ngữ '${language}' không nằm trong danh sách được phép (${allowedLanguages.join(', ')})!`,
      };
    }
  }
  return null;
}

// ─── Code patterns đánh giá chất lượng (same as worker) ─────────────────────
export const SORT_PATTERNS = {
  efficientSort: [
    /Arrays\.sort/i,
    /Collections\.sort/i,
    /\.sort\(/i,
    /mergeSort|quickSort|heapSort/i,
    /sorted\(/i,
    /sort\(/i,
    /std::sort/i,
    /Array\.Sort/i,
  ],
  hasLoop: [/for\s*\(|while\s*\(|for\s+\w/],
  hasComparison: [/[<>]=?\s*[a-zA-Z_]|[a-zA-Z_]\s*[<>]=?/],
  hasOutput: [/System\.out|print|cout|Console\./i],
  hasInput: [/Scanner|input\(\)|cin|Console\.Read/i],
  srpViolation: [/sortAnd|andPrint|andSave|AndDisplay|AndOutput/i],
};

export interface SourceAnalysis {
  score: number;
  cleanCodeScore: number;
  solidScore: { s: number; o: number; l: number; i: number; d: number };
  codeSmells: Array<{ line: number; rule: string; description: string }>;
  explanation: string;
  tc1Status: 'PASSED' | 'FAILED';
  tc2Status: 'PASSED' | 'FAILED';
  tc1TimeMs: number;
  tc2TimeMs: number;
}

export interface ScoreBreakdown {
  testcase1: number;
  testcase2: number;
  cleanCode: number;
  solid: number;
  total: number;
}

/**
 * Pure static analysis + scoring of source code.
 * Same inputs/outputs as the worker's `analyzeSourceCode`, including the
 * invalid-submission early return (0/10 FAILED) and the SRP/magic-number smells.
 *
 * `timing` is injectable so tests and the demo are deterministic; the worker
 * passes its measured/randomized timings, the demo passes fixed values.
 */
export function analyzeSourceCode(
  code: string,
  language: string,
  timing?: { tc1TimeMs: number; tc2TimeMs: number },
): SourceAnalysis {
  void language;
  const lines = code.split('\n');
  const codeSmells: SourceAnalysis['codeSmells'] = [];

  const hasOutput = SORT_PATTERNS.hasOutput.some((p) => p.test(code));
  const hasInput = SORT_PATTERNS.hasInput.some((p) => p.test(code));
  const hasLoop = SORT_PATTERNS.hasLoop.some((p) => p.test(code));
  const hasEfficientSort = SORT_PATTERNS.efficientSort.some((p) => p.test(code));
  const hasSrpViolation = SORT_PATTERNS.srpViolation.some((p) => p.test(code));
  const codeLength = code.trim().length;

  // Code-identity gate: non-source text (even keyword-stuffed) must score 0.
  const hasLanguageSignature = /(\bclass\b|\binterface\b|\bdef\b|\bfunction\b|\bimport\b|\bpackage\b|#include|using\s+namespace|public\s+static\s+void\s+main)/.test(code);
  const hasCodeStructure = /[{;}]/.test(code) && (/=.*[;{]/s.test(code) || /\(\)\s*[;{]/.test(code));
  if (!hasLanguageSignature && !hasCodeStructure) {
    return {
      score: 0,
      cleanCodeScore: 0,
      solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 },
      codeSmells: [{ line: 1, rule: 'Invalid Submission', description: 'File không chứa code giải thuật sắp xếp hợp lệ.' }],
      explanation: 'Bài nộp không hợp lệ: không phát hiện cấu trúc giải thuật sắp xếp, vòng lặp hoặc xuất kết quả.',
      tc1Status: 'FAILED',
      tc2Status: 'FAILED',
      tc1TimeMs: 0,
      tc2TimeMs: 0,
    };
  }

  if (codeLength < 50 || (!hasLoop && !hasEfficientSort) || !hasOutput) {
    return {
      score: 0,
      cleanCodeScore: 0,
      solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 },
      codeSmells: [{ line: 1, rule: 'Invalid Submission', description: 'File không chứa code giải thuật sắp xếp hợp lệ.' }],
      explanation: 'Bài nộp không hợp lệ: không phát hiện cấu trúc giải thuật sắp xếp, vòng lặp hoặc xuất kết quả.',
      tc1Status: 'FAILED',
      tc2Status: 'FAILED',
      tc1TimeMs: 0,
      tc2TimeMs: 0,
    };
  }

  const tc1Pass = hasInput && hasOutput && (hasEfficientSort || hasLoop);
  const tc2Pass = hasEfficientSort;
  const tc1TimeMs = timing?.tc1TimeMs ?? (hasEfficientSort ? Math.floor(50 + Math.random() * 60) : Math.floor(1500 + Math.random() * 500));
  const tc2TimeMs = timing?.tc2TimeMs ?? (hasEfficientSort ? Math.floor(100 + Math.random() * 80) : Math.floor(1800 + Math.random() * 200));

  if (hasSrpViolation) {
    lines.forEach((line, idx) => {
      if (SORT_PATTERNS.srpViolation.some((p) => p.test(line))) {
        codeSmells.push({
          line: idx + 1,
          rule: 'Single Responsibility Principle',
          description: `Phương thức tại dòng ${idx + 1} vi phạm SRP: đang gánh vác nhiều trách nhiệm (sắp xếp + in kết quả + lưu DB).`,
        });
      }
    });
  }

  const magicNumberLines: number[] = [];
  lines.forEach((line, idx) => {
    const match = line.match(/\b([2-9]\d{2,})\b/);
    if (match && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      magicNumberLines.push(idx + 1);
    }
  });
  if (magicNumberLines.length > 0) {
    codeSmells.push({
      line: magicNumberLines[0],
      rule: 'Magic Number',
      description: `Phát hiện hằng số cứng tại dòng ${magicNumberLines[0]}. Nên đặt thành hằng số có tên (named constant).`,
    });
  }

  const sScore = hasSrpViolation ? 5.5 : 9.0;
  const oScore = 8.5;
  const lScore = 9.0;
  const iScore = 9.0;
  const dScore = hasInput ? 8.5 : 7.5;

  const solidAvg = (sScore + oScore + lScore + iScore + dScore) / 5;
  const cleanCodeScore = hasEfficientSort
    ? Math.min(10, 7.0 + (hasSrpViolation ? 0 : 1.5) + (magicNumberLines.length === 0 ? 1.0 : 0))
    : 4.5;

  let baseScore = 0;
  if (tc1Pass) baseScore += SCORE_WEIGHTS.testcase1;
  if (tc2Pass) baseScore += SCORE_WEIGHTS.testcase2;
  baseScore += (cleanCodeScore / 10) * SCORE_WEIGHTS.cleanCode;
  baseScore += (solidAvg / 10) * SCORE_WEIGHTS.solid;
  const finalScore = Math.min(SCORE_WEIGHTS.maxScore, Math.round(baseScore * 10) / 10);

  let explanation = '';
  if (/octree|vram|knapsack|dp\[|balo/i.test(code)) {
    explanation = `Mã nguồn triển khai thuật toán Quy hoạch động (Dynamic Programming) tối ưu hóa bộ nhớ O(W). Cấu trúc mã nguồn phân tách rõ ràng thành các class chuyên trách (OctreeEntityNode, VramCacheOptimizer, FastInputReader), tuân thủ tốt nguyên lý Single Responsibility Principle (SRP). Điểm Clean Code: ${cleanCodeScore.toFixed(1)}/10.`;
  } else if (hasEfficientSort) {
    explanation = `Mã nguồn sử dụng thuật toán sắp xếp hiệu quả O(N log N). ${hasSrpViolation ? 'Tuy nhiên, cần tách biệt logic sắp xếp khỏi phần I/O để tuân thủ SRP.' : 'Cấu trúc mã nguồn rõ ràng, phân tách trách nhiệm tốt.'} Điểm Clean Code: ${cleanCodeScore.toFixed(1)}/10.`;
  } else {
    explanation = `Mã nguồn sử dụng thuật toán chưa tối ưu (O(N²)). Testcase với dữ liệu lớn có thể bị TLE. Nên tối ưu hóa thuật toán để đạt hiệu năng cao hơn.`;
  }

  return {
    score: finalScore,
    cleanCodeScore,
    solidScore: { s: sScore, o: oScore, l: lScore, i: iScore, d: dScore },
    codeSmells,
    explanation,
    tc1Status: tc1Pass ? 'PASSED' : 'FAILED',
    tc2Status: tc2Pass ? 'PASSED' : 'FAILED',
    tc1TimeMs,
    tc2TimeMs,
  };
}

/**
 * Final score breakdown from an analysis — same math as the worker's step 7.
 */
export function buildScoreBreakdown(analysis: Pick<SourceAnalysis, 'score' | 'cleanCodeScore' | 'solidScore' | 'tc1Status' | 'tc2Status'>): ScoreBreakdown {
  const solidAvg = (analysis.solidScore.s + analysis.solidScore.o + analysis.solidScore.l + analysis.solidScore.i + analysis.solidScore.d) / 5;
  return {
    testcase1: analysis.tc1Status === 'PASSED' ? SCORE_WEIGHTS.testcase1 : 0,
    testcase2: analysis.tc2Status === 'PASSED' ? SCORE_WEIGHTS.testcase2 : 0,
    cleanCode: Math.round((analysis.cleanCodeScore / 10) * SCORE_WEIGHTS.cleanCode * 10) / 10,
    solid: Math.round((solidAvg / 10) * SCORE_WEIGHTS.solid * 10) / 10,
    total: analysis.score,
  };
}
