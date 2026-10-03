import createGenAIHub, { ReviewRequest, AIReviewResult } from "../index";

export interface SandboxGradingResult {
  passed: boolean;
  exitCode: number;
  testCasesPassed: number;
  totalTestCases: number;
  compilerOutput?: string;
  executionStdout?: string;
  executionStderr?: string;
  executionTimeMs?: number;
  memoryUsedKb?: number;
}

export interface SubmissionJobPayload {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  assignmentTopic?: string;
  learningOutcomes?: string[];
  language: string;
  sourceFiles: Array<{ filename: string; content: string }>;
  sandboxResult?: SandboxGradingResult;
}

export interface ProcessedReviewEnvelope {
  submissionId: string;
  aiReview: AIReviewResult;
  compilerDiagnostic?: {
    errorType: string;
    simpleExplanation: string;
    suspectedCause: string;
    actionableHints: string[];
  };
  processedAt: string;
}

/**
 * Worker Consumer compatible with Redis / BullMQ or in-memory queues (Phân hệ 5).
 * Connects Docker Sandbox output (Phân hệ 2) to GenAI Core (Phân hệ 3).
 */
export class SubmissionConsumerWorker {
  private hub = createGenAIHub;

  /**
   * Processes a submission job after the Docker sandbox has completed test case execution.
   */
  public async processJob(job: SubmissionJobPayload): Promise<ProcessedReviewEnvelope> {
    const { submissionId, language, sourceFiles, assignmentTopic, learningOutcomes, sandboxResult } = job;

    // 1. Prepare review request
    const reviewReq: ReviewRequest = {
      submissionId,
      language,
      sourceFiles,
      compilerOutput: sandboxResult?.compilerOutput || sandboxResult?.executionStderr,
      assignmentTopic,
      learningOutcomes,
    };

    // 2. Perform Clean Code & SOLID Review
    const aiReview = await this.hub.codeReviewer.reviewCode(reviewReq);

    // 3. If compilation failed or runtime crashed, generate Socratic diagnostic
    let compilerDiagnostic: ProcessedReviewEnvelope["compilerDiagnostic"] | undefined;
    const hasCrash =
      (sandboxResult && !sandboxResult.passed && sandboxResult.exitCode !== 0) ||
      (sandboxResult?.compilerOutput && sandboxResult.compilerOutput.trim().length > 0);

    if (hasCrash) {
      const errorLog = sandboxResult?.compilerOutput || sandboxResult?.executionStderr || "Execution failed";
      compilerDiagnostic = await this.hub.compilerExplainer.explainError(
        errorLog,
        language,
        sourceFiles[0]?.content
      );

      // Harmonize with review result
      if (!aiReview.compiler_explanation) {
        aiReview.compiler_explanation = `${compilerDiagnostic.errorType}: ${compilerDiagnostic.simpleExplanation}`;
      }
    }

    return {
      submissionId,
      aiReview,
      compilerDiagnostic,
      processedAt: new Date().toISOString(),
    };
  }
}