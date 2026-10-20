import { Injectable, Logger } from '@nestjs/common';
import {
  ASTPlagiarismEngine,
  CodeSubmission,
  PairwisePlagiarismResult,
  ClassPlagiarismMatrixReport,
} from './ast-engine/plagiarism-engine';
import { SubmissionRepository } from '../database/submission.repository';

export interface PlagiarismComparisonMatch {
  matchedStudentName: string;
  matchedStudentId: string;
  matchedSubmissionId: string;
  /** metric chính: maxContainment (0–100) */
  similarityRate: number;
  jaccardSimilarity: number;
  containmentBinA: number;
  containmentAinB: number;
  maxContainment: number;
  sourceCodeA: string;
  sourceCodeB: string;
  matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  executionTimeMs: number;
  isFlagged: boolean;
  status: 'CLEAN' | 'SUSPECTED' | 'FLAGGED_HIGH' | 'FLAGGED_PLAGIARISM';
}

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);
  private readonly GENAI_HUB_URL = 'http://localhost:3001/api/v1/ast/compare';

  constructor(private readonly submissionRepo: SubmissionRepository) {}

  /**
   * So sánh cặp bài nộp.
   * Thử GenAI Hub trước; fallback về in-process AST engine nếu Hub offline.
   */
  public async comparePair(
    subA: CodeSubmission,
    subB: CodeSubmission,
  ): Promise<PairwisePlagiarismResult> {
    try {
      const response = await fetch(this.GENAI_HUB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionA: subA, submissionB: subB }),
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const data = (await response.json()) as PairwisePlagiarismResult;
        return data;
      }
    } catch {
      // Hub offline hoặc timeout → fallback
    }
    return ASTPlagiarismEngine.compareSubmissions(subA, subB);
  }

  /**
   * Đánh giá bài nộp mới đối chiếu với toàn bộ bài cùng assignment.
   * Trả về match có similarityRate cao nhất (nếu có).
   */
  public async evaluateSubmissionAgainstClass(currentSub: {
    submissionId: string;
    studentId: string;
    assignmentId: string;
    language: string;
    sourceCode: string;
    studentName?: string;
  }): Promise<PlagiarismComparisonMatch | null> {
    const allSubs = await this.submissionRepo.findAll({
      assignmentId: currentSub.assignmentId,
    });

    // Chỉ đối chiếu với các bài ĐÃ HOÀN TẤT và CÓ source code
    const candidateSubs = allSubs.filter(
      (s) =>
        s.submissionId !== currentSub.submissionId &&
        s.details?.sourceCode &&
        typeof s.details.sourceCode === 'string' &&
        s.details.sourceCode.trim().length > 0,
    );

    if (candidateSubs.length === 0) {
      this.logger.log(
        `[PlagiarismService] ${currentSub.submissionId} là bài đầu tiên trong assignment ${currentSub.assignmentId} — chưa có bài để đối chiếu.`,
      );
      return null;
    }

    const subA: CodeSubmission = {
      submissionId: currentSub.submissionId,
      studentId: currentSub.studentId,
      studentName: currentSub.studentName || currentSub.studentId,
      sourceCode: currentSub.sourceCode,
      language: currentSub.language,
    };

    let highestMatch: PairwisePlagiarismResult | null = null;
    let matchedCandidate: (typeof candidateSubs)[0] | null = null;

    for (const candidate of candidateSubs) {
      const subB: CodeSubmission = {
        submissionId: candidate.submissionId,
        studentId: candidate.studentId,
        studentName: candidate.studentId,
        sourceCode: candidate.details!.sourceCode,
        language: candidate.language,
      };

      const result = await this.comparePair(subA, subB);

      if (!highestMatch || result.similarityRate > highestMatch.similarityRate) {
        highestMatch = result;
        matchedCandidate = candidate;
      }
    }

    if (!highestMatch || !matchedCandidate) return null;

    const mtJson = highestMatch.matchedTokensJson;
    const matchedTokens = mtJson.matchedSegments.map((s) => ({
      lineA: [s.lineRangeA.start, s.lineRangeA.end] as [number, number],
      lineB: [s.lineRangeB.start, s.lineRangeB.end] as [number, number],
    }));

    return {
      matchedStudentName: matchedCandidate.studentId || 'Sinh viên lớp',
      matchedStudentId: matchedCandidate.studentId,
      matchedSubmissionId: matchedCandidate.submissionId,
      similarityRate: highestMatch.similarityRate,
      jaccardSimilarity: mtJson.jaccardSimilarity,
      containmentBinA: mtJson.containmentBinA,
      containmentAinB: mtJson.containmentAinB,
      maxContainment: mtJson.maxContainment,
      sourceCodeA: currentSub.sourceCode,
      sourceCodeB: matchedCandidate.details!.sourceCode,
      matchedTokens,
      executionTimeMs: highestMatch.executionTimeMs,
      isFlagged: highestMatch.isFlagged,
      status: highestMatch.status,
    };
  }

  /**
   * Tạo ma trận N×N toàn lớp cho một assignment.
   */
  public async getAssignmentMatrix(assignmentId: string): Promise<ClassPlagiarismMatrixReport> {
    const subs = await this.submissionRepo.findAll({ assignmentId });

    const codeSubmissions: CodeSubmission[] = subs
      .filter((s) => s.details?.sourceCode)
      .map((s) => ({
        submissionId: s.submissionId,
        studentId: s.studentId,
        studentName: s.studentId,
        sourceCode: s.details!.sourceCode,
        language: s.language,
      }));

    if (codeSubmissions.length < 2) {
      return {
        assignmentId,
        totalSubmissions: codeSubmissions.length,
        totalPairsCompared: 0,
        flaggedPairsCount: 0,
        submissionsList: codeSubmissions.map((s) => ({
          id: s.submissionId,
          name: s.studentName,
          studentId: s.studentId,
        })),
        similarityMatrix: codeSubmissions.length === 1 ? [[100]] : [],
        flaggedReports: [],
        totalExecutionTimeMs: 0,
      };
    }

    return ASTPlagiarismEngine.computeClassSimilarityMatrix(codeSubmissions, assignmentId);
  }
}
