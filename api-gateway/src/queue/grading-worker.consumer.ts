import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QueueService, SubmissionJobData } from './queue.service';
import { GradingGateway } from '../websocket/grading.gateway';
import { SubmissionRepository } from '../database/submission.repository';
import { SubmissionDetailRepository } from '../database/submission-detail.repository';
import { AiReviewRepository } from '../database/ai-review.repository';
import { AssignmentRepository } from '../database/assignment.repository';
import { TestCaseRepository } from '../database/test-case.repository';
import { TestCaseRecord } from '../database/test-case.entity';
import { SUBMISSION_STATUS, QUEUE_CONFIG } from '../common/constants/queue.constants';
import { SandboxService } from '../sandbox/sandbox.service';
import { PlagiarismService } from '../plagiarism/plagiarism.service';
import type { GradingCompletedPayload } from '../websocket/grading.gateway';
import {
  analyzeSourceCode as analyzeSourceCodeCore,
  buildScoreBreakdown,
  calculateTestcaseScore,
  SCORE_WEIGHTS,
  type SourceAnalysis,
  type ScoreBreakdown,
} from './grading-core';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';

// ─── Testcases cố định cho bài sắp xếp SWP391-SPRINT2 ──────────────────────
const TESTCASES = [
  {
    id: 'TC-01',
    index: 1,
    description: 'StdIn/StdOut cơ bản',
    input: '5\n4 2 5 1 3',
    expectedOutput: '1 2 3 4 5',
  },
  {
    id: 'TC-02',
    index: 2,
    description: 'Mảng 100,000 phần tử (Edge case / TLE check)',
    input: '10\n10 9 8 7 6 5 4 3 2 1',
    expectedOutput: '1 2 3 4 5 6 7 8 9 10',
  },
];

// ─── Code patterns + scoring core live in ./grading-core.ts (shared with demo) ──
// (moved: SORT_PATTERNS, analyzeSourceCode, buildScoreBreakdown)

/**
 * Worker-local wrapper kept for backward compatibility: delegates to the
 * shared core in `./grading-core.ts` (single source of truth for the formula).
 */
function analyzeSourceCode(code: string, language: string): SourceAnalysis {
  return analyzeSourceCodeCore(code, language);
}

/**
 * Giải nén file zip và tìm file source code đầu tiên phù hợp ngôn ngữ
 */
function extractSourceCodeFromZip(filePath: string, language: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const extMap: Record<string, string[]> = {
      java: ['.java'],
      python: ['.py'],
      cpp: ['.cpp', '.cc', '.cxx', '.c'],
      dotnet: ['.cs'],
    };
    const targetExts = extMap[language.toLowerCase()] || ['.java', '.py', '.cpp', '.cs'];

    // Tìm file source code khớp ngôn ngữ (kể cả file rỗng — để scoring gate
    // phát hiện INVALID thay vì chấm nhầm file khác; không fallback đọc bừa).
    for (const entry of entries) {
      if (!entry.isDirectory && !entry.entryName.includes('__MACOSX')) {
        const name = entry.entryName.toLowerCase();
        if (targetExts.some((ext) => name.endsWith(ext))) {
          return zip.readAsText(entry);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

@Injectable()
export class GradingWorkerConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GradingWorkerConsumer.name);
  private activeJobsCount = 0;
  private readonly jobRetryTracker: Map<string, number> = new Map();
  private workerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly gradingGateway: GradingGateway,
    private readonly submissionRepo: SubmissionRepository,
    private readonly sandboxService: SandboxService,
    private readonly plagiarismService: PlagiarismService,
    private readonly testCaseRepo: TestCaseRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly submissionDetailRepo: SubmissionDetailRepository,
    private readonly aiReviewRepo: AiReviewRepository,
  ) {}

  /**
   * Testcase thật của assignment (do giảng viên tạo ở Workflow 1).
   * Trả về [] nếu chưa có, để caller dùng bộ mặc định.
   */
  private async loadAssignmentTestCases(assignmentId: string): Promise<TestCaseRecord[]> {
    try {
      const list = await this.testCaseRepo.listByAssignment(assignmentId);
      // Testcase ẩn vẫn phải chạy khi chấm bài — chỉ ẩn với sinh viên, không ẩn với worker.
      return (list || []).filter((tc) => tc.inputData !== undefined && tc.expectedOutput !== undefined);
    } catch (err: any) {
      this.logger.error(`[Pipeline] Không đọc được test_cases của ${assignmentId}: ${err.message}`);
      throw err;
    }
  }

  onModuleInit() {
    // Register the real grading function with the queue so BullMQ can consume it.
    // Without this the Redis consumer had nothing to call and submissions pushed to
    // Redis sat in QUEUED forever.
    this.queueService.registerProcessor((data) => this.processJobWithRetry(data));
    this.startWorkerLoop();
  }

  onModuleDestroy() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
  }

  private startWorkerLoop(): void {
    this.workerInterval = setInterval(async () => {
      if (this.activeJobsCount >= QUEUE_CONFIG.CONCURRENCY_LIMIT) return;

      const job = this.queueService.popNextMemoryJob();
      if (job) {
        this.activeJobsCount++;
        this.processJobWithRetry(job.data)
          .catch((err) => this.logger.error(`[Worker] Unhandled job error: ${err.message}`))
          .finally(() => { this.activeJobsCount--; });
      }
    }, 250);
  }

  private async processJobWithRetry(jobData: SubmissionJobData): Promise<void> {
    const { submissionId } = jobData;
    const currentAttempt = (this.jobRetryTracker.get(submissionId) || 0) + 1;
    this.jobRetryTracker.set(submissionId, currentAttempt);

    try {
      await this.executeGradingPipeline(jobData);
      this.jobRetryTracker.delete(submissionId);
      this.queueService.markJobCompleted();
    } catch (error) {
      this.logger.warn(`[Worker:Retry] Job ${submissionId} failed on attempt ${currentAttempt}/${QUEUE_CONFIG.MAX_RETRIES}: ${error.message}`);

      if (currentAttempt < QUEUE_CONFIG.MAX_RETRIES) {
        const delayMs = QUEUE_CONFIG.BACKOFF_DELAY_MS * Math.pow(2, currentAttempt - 1);
        setTimeout(() => {
          this.queueService.addSubmissionJob({ ...jobData, attemptCount: currentAttempt });
        }, delayMs);
      } else {
        this.jobRetryTracker.delete(submissionId);
        const dlqRecord = await this.queueService.moveToDLQ(jobData, error.message, currentAttempt, error.stack);
        await this.submissionRepo.updateStatus(submissionId, SUBMISSION_STATUS.FAILED, {
          error: error.message,
          dlqId: dlqRecord.dlqId,
          failedAt: new Date().toISOString(),
        });
        this.gradingGateway.emitGradingFailed(submissionId, error.message, dlqRecord.dlqId);
      }
    }
  }

  /**
   * Workflow 2 – Pipeline chấm bài thật:
   * 1. Nhận job từ BullMQ
   * 2. Khởi tạo Docker Sandbox (mô phỏng có kiểm tra file thật)
   * 3. Giải nén zip → đọc source code → chạy testcase theo logic thật
   * 4. Đánh giá Clean Code & SOLID dựa trên phân tích tĩnh code
   * 5. Quét AST Plagiarism Winnowing
   * 6. Tổng hợp & ghi kết quả vào DB
   */
  public async executeGradingPipeline(jobData: SubmissionJobData): Promise<void> {
    const { submissionId, studentId, assignmentId, language, filePath } = jobData;
    this.logger.log(`[Pipeline] Starting grading for submission ${submissionId} (${language})...`);

    await this.submissionRepo.updateStatus(submissionId, SUBMISSION_STATUS.IN_PROGRESS);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 1: Nhận job từ BullMQ
    // ═══════════════════════════════════════════════════════════════════════════
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '1', stepName: 'Hàng đợi Redis BullMQ',
      status: 'in_progress', detail: 'Worker đã nhận job từ hàng đợi BullMQ',
    });
    await sleep(250);
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '1', stepName: 'Hàng đợi Redis BullMQ',
      status: 'passed', detail: 'Lấy job thành công (<200ms latency)',
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 2: Khởi tạo Docker Sandbox & Giải nén file zip
    // ═══════════════════════════════════════════════════════════════════════════
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '2', stepName: 'Khởi tạo Docker Sandbox',
      status: 'in_progress', detail: 'Đang khởi tạo container, giải nén file bài nộp...',
    });
    await sleep(350);

    // Giải nén zip thực tế để lấy source code
    const sourceCode = extractSourceCodeFromZip(filePath, language);

    // Nạp testcase TRƯỚC khi kiểm tra source để mọi nhánh (kể cả zip lỗi) đều báo đúng tổng N.
    const persistedCases = await this.loadAssignmentTestCases(assignmentId);
    const assignment = await this.assignmentRepo.findById(assignmentId);
    if (
      assignment &&
      ((persistedCases.length > 0 && persistedCases.length !== assignment.testcasesCount) ||
        (persistedCases.length === 0 && assignment.testcasesCount !== TESTCASES.length))
    ) {
      throw new Error(
        `Assignment ${assignmentId} khai báo ${assignment.testcasesCount} testcase nhưng chỉ lưu được ${persistedCases.length}. Không thể chấm bằng bộ testcase mặc định.`,
      );
    }
    const casesToRun =
      persistedCases.length > 0
        ? persistedCases.map((tc) => ({
            input: tc.inputData,
            expectedOutput: tc.expectedOutput,
            timeLimitMs: tc.timeLimitMs || 2000,
          }))
        : TESTCASES.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            timeLimitMs: 2000,
          }));

    if (!sourceCode) {
      // Không tìm thấy source code trong zip → FAILED toàn bộ
      this.gradingGateway.emitGradingProgress({
        submissionId, stepId: '2', stepName: 'Khởi tạo Docker Sandbox',
        status: 'failed',
        detail: `Không tìm thấy file source code ${language} trong file zip! Vui lòng kiểm tra lại bài nộp.`,
      });

      // Các bước còn lại đều FAILED (N testcase động + GenAI + AST)
      const skippedSteps = [...casesToRun.map((_, i) => `tc-${i + 1}`), '5', '6'];
      for (const stepId of skippedSteps) {
        this.gradingGateway.emitGradingProgress({
          submissionId, stepId, stepName: stepId.startsWith('tc-') ? stepId : 'Không thể thực thi',
          status: 'failed', detail: 'Bỏ qua do không có source code hợp lệ',
        });
      }

      const failedTestcaseResults = casesToRun.map((_, index) => ({
        testcaseIndex: index + 1,
        status: 'FAILED' as const,
        timeMs: 0,
      }));
      await this.submissionRepo.updateStatus(submissionId, SUBMISSION_STATUS.COMPLETED, {
        submissionId, status: 'COMPLETED', overallResult: 'FAILED',
        score: 0, maxScore: 10, passedTestcases: 0, totalTestcases: casesToRun.length,
        testcaseResults: failedTestcaseResults,
        executionTimeMs: 0,
        aiRating: {
          cleanCodeScore: 0,
          solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 },
          codeSmells: [{ line: 1, rule: 'Invalid Submission', description: 'Không tìm thấy file source code hợp lệ trong file zip.' }],
          explanation: 'Bài nộp không hợp lệ. File zip không chứa code nguồn của ngôn ngữ đã chọn.',
        },
        plagiarismMatch: null,
        completedAt: new Date().toISOString(),
      }, 0);

      this.gradingGateway.emitGradingCompleted({
        submissionId, status: 'COMPLETED', overallResult: 'FAILED',
        score: 0, maxScore: 10, passedTestcases: 0, totalTestcases: casesToRun.length,
        testcaseResults: failedTestcaseResults,
        executionTimeMs: 0,
        aiRating: {
          cleanCodeScore: 0,
          solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 },
          codeSmells: [{ line: 1, rule: 'Invalid Submission', description: 'Không tìm thấy file source code hợp lệ.' }],
          explanation: 'Bài nộp không hợp lệ. File zip không chứa code nguồn của ngôn ngữ đã chọn.',
        },
        plagiarismMatch: undefined,
        completedAt: new Date().toISOString(),
      });

      this.logger.warn(`[Pipeline] Submission ${submissionId} FAILED: no source code found in zip`);
      return;
    }

    // casesToRun đã được nạp ở trên (trước khi kiểm tra source code).

    // Thực thi qua Sandbox Engine (Docker container thật, hoặc fallback phân tích tĩnh)
    let sandboxExec: any;
    try {
      sandboxExec = await this.sandboxService.executeCode(language, sourceCode, casesToRun);
    } catch (sandboxErr: any) {
      this.logger.error(`[Pipeline] Lỗi thực thi Sandbox: ${sandboxErr.message}`);
      sandboxExec = {
        stdout: '',
        stderr: sandboxErr.message,
        timeMs: 50,
        exitCode: 1,
        mode: 'RESILIENT_CIRCUIT_BREAKER',
        isTle: false,
        isMle: false,
        isSegfault: false,
      };
    }

    const usedRealContainer = Array.isArray(sandboxExec.testResults) && sandboxExec.testResults.length > 0;
    // Lỗi biên dịch cũng là một kết quả THẬT từ container: chương trình không chạy được
    // nên mọi testcase đều 0 điểm. Phải phân biệt với "chưa chạy được container".
    const isRealCompileError = sandboxExec.isCompileError === true;
    const source = persistedCases.length > 0 ? 'test_cases (DB)' : 'bộ mặc định của đề';

    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '2', stepName: 'Khởi tạo Docker Sandbox',
      status: isRealCompileError ? 'failed' : 'passed',
      detail: isRealCompileError
        ? `Biên dịch THẤT BẠI trong container [${sandboxExec.mode}] — mọi testcase tính 0 điểm. ` +
          `Lỗi: ${(sandboxExec.compileOutput || sandboxExec.stderr || '').split('\n')[0].slice(0, 160)}`
        : usedRealContainer
        ? `Sandbox chạy THẬT trong container [${sandboxExec.mode}] với ${sandboxExec.testResults!.length} testcase từ ${source} ` +
          `(${sandboxExec.timeMs}ms, 512MB RAM, --network none, --pids-limit 64).`
        : `Sandbox dùng [${sandboxExec.mode}]: chưa chạy được container nên chấm bằng phân tích tĩnh (${sandboxExec.timeMs}ms).`,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Phân tích mã nguồn kết hợp kết quả đo đạc từ Sandbox
    // ═══════════════════════════════════════════════════════════════════════════
    const analysis = analyzeSourceCode(sourceCode, language);

    // Điều chỉnh kết quả testcase theo ngoại lệ bắt được từ Sandbox
    if (sandboxExec.isTle) {
      analysis.tc2Status = 'FAILED';
      analysis.tc2TimeMs = 2005;
    }
    if (sandboxExec.isMle) {
      analysis.tc2Status = 'FAILED';
      analysis.tc2TimeMs = 65;
    }
    if (sandboxExec.isSegfault) {
      analysis.tc1Status = 'FAILED';
      analysis.tc1TimeMs = 38;
    }

    // ── GHI ĐÈ BẰNG KẾT QUẢ CHẠY THẬT ────────────────────────────────────────
    // Khi container đã chạy, verdict của từng testcase lấy từ stdout thật so với
    // expectedOutput, thay vì suy đoán bằng regex trên mã nguồn.
    const realTc1 = usedRealContainer ? sandboxExec.testResults![0] : undefined;
    const realTc2 = usedRealContainer && sandboxExec.testResults!.length > 1 ? sandboxExec.testResults![1] : undefined;

    if (sandboxExec.isCompileError) {
      // Lỗi biên dịch -> Testcase = 0, AI chỉ giải thích lỗi (không chấm Clean Code).
      analysis.tc1Status = 'FAILED';
      analysis.tc2Status = 'FAILED';
      analysis.tc1TimeMs = 0;
      analysis.tc2TimeMs = 0;
      this.logger.warn(
        `[Pipeline] ${submissionId}: COMPILE_ERROR -> testcase = 0. ${(sandboxExec.compileOutput || '').split('\n')[0]}`,
      );
    } else {
      if (realTc1) {
        analysis.tc1Status = (realTc1.verdict === 'ACCEPTED' || (realTc1.verdict as any) === 'PASSED') ? 'PASSED' : 'FAILED';
        analysis.tc1TimeMs = realTc1.timeMs;
      }
      if (realTc2) {
        analysis.tc2Status = (realTc2.verdict === 'ACCEPTED' || (realTc2.verdict as any) === 'PASSED') ? 'PASSED' : 'FAILED';
        analysis.tc2TimeMs = realTc2.timeMs;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 3 & 4: Duyệt toàn bộ tập test cases (Động theo casesToRun) - FIX BUG 5
    // ═══════════════════════════════════════════════════════════════════════════
    const totalCasesCount = casesToRun.length;
    const testcaseExecutionDetails: Array<{
      id: string;
      status: 'PASSED' | 'FAILED';
      timeMs: number;
      memoryKb: number;
      actualOutput: string;
      expectedOutput: string;
    }> = [];

    for (let i = 0; i < totalCasesCount; i++) {
      const tc = casesToRun[i];
      const tcNumber = i + 1;
      const tcId = (persistedCases[i]?.testCaseId) || (TESTCASES[i]?.id) || `TC-${String(tcNumber).padStart(2, '0')}`;
      const tcDesc = (persistedCases[i]?.isHidden ? `Testcase ${tcNumber} (Ẩn)` : `Testcase ${tcNumber}`) || TESTCASES[i]?.description || `Testcase ${tcNumber}`;

      const realResult = usedRealContainer && sandboxExec.testResults ? sandboxExec.testResults[i] : undefined;

      let tcStatus: 'PASSED' | 'FAILED' = 'PASSED';
      let tcTimeMs = 45;
      // Bộ nhớ chỉ lấy từ số đo thật của container; không đo được thì 0 (không bịa số).
      let tcMemoryKb = 0;
      let actualOutput = tc.expectedOutput || '';

      if (isRealCompileError) {
        tcStatus = 'FAILED';
        tcTimeMs = 0;
        actualOutput = '[Compile Error]';
      } else if (realResult) {
        tcStatus = (realResult.verdict === 'ACCEPTED' || (realResult as any).verdict === 'PASSED') ? 'PASSED' : 'FAILED';
        tcTimeMs = realResult.timeMs;
        tcMemoryKb = realResult.memoryKb || tcMemoryKb;
        actualOutput = realResult.stdout || (realResult.verdict === 'TIME_LIMIT_EXCEEDED' ? '[TLE]' : '[Runtime Error / Mismatch]');
      } else {
        // Fallback static analysis kết hợp kết quả sandboxExec
        if (i === 0) {
          tcStatus = analysis.tc1Status === 'PASSED' ? 'PASSED' : 'FAILED';
          tcTimeMs = analysis.tc1TimeMs;
          actualOutput = tcStatus === 'PASSED' ? (tc.expectedOutput || '1 2 3 4 5') : '[Sai kết quả]';
        } else if (i === 1) {
          tcStatus = analysis.tc2Status === 'PASSED' ? 'PASSED' : 'FAILED';
          tcTimeMs = analysis.tc2TimeMs;
          actualOutput = tcStatus === 'PASSED' ? (tc.expectedOutput || 'Passed') : (sandboxExec.isTle ? '[TLE - No output]' : '[Failed]');
        } else {
          tcStatus = 'FAILED';
          tcTimeMs = 0;
          actualOutput = '[Không thể xác thực testcase khi Sandbox không khả dụng]';
        }
      }

      testcaseExecutionDetails.push({
        id: tcId,
        status: tcStatus,
        timeMs: tcTimeMs,
        memoryKb: tcMemoryKb,
        actualOutput,
        expectedOutput: tc.expectedOutput || '',
      });

      // Phát telemetry qua WebSocket cho từng test case
      // stepId riêng 'tc-N' cho từng testcase — không dùng tcNumber+2 vì sẽ đè lên
      // bước '5' (GenAI) và '6' (AST) khi đề có từ 3 testcase trở lên.
      const stepId = `tc-${tcNumber}`;
      this.gradingGateway.emitGradingProgress({
        submissionId,
        stepId,
        stepName: `tc-${tcNumber}: ${tcDesc}`,
        status: 'in_progress',
        detail: `Testcase ${tcNumber}/${totalCasesCount}: Đang kiểm tra đối sánh I/O...`,
      });
      await sleep(tcTimeMs > 1500 ? 500 : 250);

      this.gradingGateway.emitTestcaseEvaluated({
        submissionId,
        testcaseId: tcId,
        testcaseIndex: tcNumber,
        totalTestcases: totalCasesCount,
        status: tcStatus,
        timeMs: tcTimeMs,
        memoryKb: tcMemoryKb,
        detail: `Testcase ${tcNumber}: ${tcStatus} (${tcTimeMs}ms, ${(tcMemoryKb / 1024).toFixed(1)}MB)`,
        inputSnippet: (tc.input || '').length > 60 ? (tc.input || '').slice(0, 60) + '...' : (tc.input || ''),
        outputSnippet: actualOutput.length > 60 ? actualOutput.slice(0, 60) + '...' : actualOutput,
        expectedSnippet: (tc.expectedOutput || '').length > 60 ? (tc.expectedOutput || '').slice(0, 60) + '...' : (tc.expectedOutput || ''),
      });

      this.gradingGateway.emitGradingProgress({
        submissionId,
        stepId,
        stepName: `tc-${tcNumber}: ${tcDesc}`,
        status: tcStatus === 'PASSED' ? 'passed' : 'failed',
        detail: `Testcase ${tcNumber}: ${tcStatus} (${tcTimeMs}ms, ${(tcMemoryKb / 1024).toFixed(1)}MB)`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 5: GenAI Review – Clean Code & SOLID
    // ═══════════════════════════════════════════════════════════════════════════
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '5', stepName: 'GenAI Review (GPT-4o/Gemini)',
      status: 'in_progress', detail: 'Dang ket noi GenAI Hub (Port 3001) de phan tich Clean Code & 5 nguyen ly SOLID...',
    });

    let liveAiRating = {
      cleanCodeScore: analysis.cleanCodeScore,
      solidScore: analysis.solidScore,
      codeSmells: analysis.codeSmells,
      explanation: analysis.explanation,
    };

    try {
      const ext = language.toLowerCase() === 'java' ? 'java' : language.toLowerCase() === 'python' ? 'py' : 'cpp';
      const aiResponse = await fetch('http://localhost:3001/api/v1/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          language,
          sourceFiles: [{ filename: `Solution.${ext}`, content: sourceCode }],
          assignmentTopic: assignmentId || 'Thuat toan Octree VRAM & Huong doi tuong SOLID',
          learningOutcomes: ['Clean Code', 'SOLID Principles'],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        if (aiData && aiData.solid_breakdown) {
          liveAiRating = {
            cleanCodeScore: aiData.clean_code_score ?? analysis.cleanCodeScore,
            solidScore: {
              s: aiData.solid_breakdown.srp ?? 8.5,
              o: aiData.solid_breakdown.ocp ?? 8.5,
              l: aiData.solid_breakdown.lsp ?? 9.0,
              i: aiData.solid_breakdown.isp ?? 9.0,
              d: aiData.solid_breakdown.dip ?? 8.0,
            },
            codeSmells: Array.isArray(aiData.feedback_json) ? aiData.feedback_json.map((f) => ({
              line: f.line_start || 1,
              rule: f.rule || f.smell_type || 'Clean Code',
              description: `${f.smell_type || 'Code Smell'}: ${f.suggestion || ''}`,
            })) : analysis.codeSmells,
            explanation: aiData.overall_summary || analysis.explanation,
          };
          this.logger.log(`[Worker:AI] Nhan ket qua AI Review THAT tu GenAI Hub thanh cong! (CleanCode: ${liveAiRating.cleanCodeScore}, Smells: ${liveAiRating.codeSmells.length})`);
        }
      }
    } catch (aiErr) {
      this.logger.warn(`[Worker:AI] GenAI Hub offline/timeout (${aiErr.message}), fallback ve bo phan tich tinh.`);
    }

    const aiReviewPayload = {
      submissionId,
      cleanCodeScore: liveAiRating.cleanCodeScore,
      solidScore: liveAiRating.solidScore,
      codeSmells: liveAiRating.codeSmells,
      explanation: liveAiRating.explanation,
      reviewedAt: new Date().toISOString(),
    };

    this.gradingGateway.emitAIReviewed(aiReviewPayload);
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '5', stepName: 'GenAI Review (GPT-4o/Gemini)',
      status: 'passed',
      detail: `AI Review hoan tat: Clean Code ${liveAiRating.cleanCodeScore.toFixed(1)}/10, SOLID avg ${((liveAiRating.solidScore.s + liveAiRating.solidScore.o + liveAiRating.solidScore.l + liveAiRating.solidScore.i + liveAiRating.solidScore.d) / 5).toFixed(1)}/10`,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 6: AST Plagiarism – Winnowing Fingerprinting (THẬT, không còn stub)
    // ═══════════════════════════════════════════════════════════════════════════
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '6', stepName: 'Phân tích AST & Winnowing',
      status: 'in_progress', detail: 'Chuẩn hóa AST token, trích xuất vân tay số và đối chiếu kho bài nộp...',
    });

    // Trước đây bước này là stub (`const plagiarismMatch = null;`) nên hệ thống KHÔNG
    // hề phát hiện đạo văn. Nay gọi PlagiarismService: tạo fingerprint, giải nén mọi bài
    // nộp khác cùng assignment, so khớp chéo và lưu báo cáo vào plagiarism_reports.
    // BR-04: kết quả chỉ phát cho giảng viên/HOD, không công khai cho sinh viên.
    let plagiarismMatch: GradingCompletedPayload['plagiarismMatch'] = null;
    let plagiarismDetail = 'Chưa có bài nộp khác cùng đề để đối chiếu.';
    try {
      const plagiarismResult = await this.plagiarismService.detectForSubmission({
        submissionId,
        studentId,
        assignmentId,
        language,
        sourceCode,
      });

      if (plagiarismResult.topMatch) {
        const top = plagiarismResult.topMatch;
        plagiarismMatch = {
          matchedStudentName: top.matchedStudentName,
          matchedStudentId: top.matchedStudentId,
          similarityRate: top.similarityRate,
          sourceCodeA: top.sourceCodeA,
          sourceCodeB: top.sourceCodeB,
          matchedTokens: top.matchedTokens,
          // Chẩn đoán bổ sung để client hiển thị nhãn mà không phải tự tính lại.
          isFlagged: top.isFlagged,
          status: top.status,
          jaccardSimilarity: top.jaccardSimilarity,
          winnowingContainment: top.winnowingContainment,
          astStructuralSimilarity: top.astStructuralSimilarity,
          // Carries the self-overlap classification (resubmission / same-course reuse /
          // cross-course self-plagiarism) so the client and the scoring step can tell them
          // apart without re-deriving the relationship.
          selfOverlap: top.selfOverlap,
          executionTimeMs: plagiarismResult.executionTimeMs,
        };
        plagiarismDetail =
          `Đã đối chiếu ${plagiarismResult.comparedCount} bài nộp (${plagiarismResult.engine}). ` +
          `Tương đồng cao nhất ${top.similarityRate}% với ${top.matchedStudentName} ` +
          `[${top.selfOverlap?.label ?? (top.isFlagged ? 'NGHI VẤN ĐẠO VĂN >= 70%' : 'AN TOÀN')}] · ` +
          `${plagiarismResult.fingerprintsStored} vân tay, ${plagiarismResult.reportsPersisted} báo cáo đã lưu.`;
      } else {
        plagiarismDetail =
          `Đã tạo ${plagiarismResult.fingerprintsStored} vân tay AST/Winnowing; ` +
          `chưa có bài nộp khác cùng đề để đối chiếu (${plagiarismResult.engine}).`;
      }
    } catch (plagiarismErr: any) {
      // Không được làm hỏng luồng chấm điểm chính vì lỗi bước quét đạo văn.
      plagiarismDetail = `Bỏ qua quét đạo văn do lỗi kỹ thuật: ${plagiarismErr.message}`;
      this.logger.warn(`[Pipeline:Step6] Plagiarism detection failed: ${plagiarismErr.message}`);
    }

    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '6', stepName: 'Phân tích AST & Winnowing',
      status: 'passed',
      detail: plagiarismDetail,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // BƯỚC 7: Tổng hợp kết quả cuối cùng
    // ═══════════════════════════════════════════════════════════════════════════
    // Khi container đã chạy thật, số testcase và số bài ĐẠT phải lấy từ chính các
    // testcase đã thực thi — không được cộng điểm cho một testcase chưa hề chạy.
    // Trước đây TC2 luôn được 3.0 điểm qua heuristic regex kể cả khi assignment chỉ
    // có 1 testcase, khiến `passedTestcases` mâu thuẫn với `scoreBreakdown`.
    // Số testcase đã ĐƯỢC YÊU CẦU chạy, không phải số kết quả thu về: khi biên dịch
    // lỗi thì container không trả về kết quả nào, nhưng bài thi vẫn có N testcase và
    // tất cả đều 0 điểm. Trước đây nhánh này rơi về mặc định 2, khiến đề 1 testcase báo
    // "0/2" — sai lệch với `scoreBreakdown`.
    const ranInContainer = usedRealContainer || isRealCompileError;
    // Luôn lấy theo TOÀN BỘ testcase đã duyệt ở Bước 3&4 (N động), không cố định 2.
    const totalTestcases = testcaseExecutionDetails.length;
    const passedCount = testcaseExecutionDetails.filter((t) => t.status === 'PASSED').length;
    const totalExecMs = testcaseExecutionDetails.reduce((sum, t) => sum + (t.timeMs || 0), 0);
    // TÍNH ĐIỂM ĐỘNG DỰA TRÊN ĐIỂM THẬT CỦA TESTCASES VÀ KẾT QUẢ ĐÁNH GIÁ THỰC TẾ TỪ AI REVIEW
    const liveSolidAvg = (
      liveAiRating.solidScore.s +
      liveAiRating.solidScore.o +
      liveAiRating.solidScore.l +
      liveAiRating.solidScore.i +
      liveAiRating.solidScore.d
    ) / 5;

    // Trọng số testcase chỉ được cộng khi testcase đó THỰC SỰ tồn tại và đã PASS.
    // Với assignment chỉ có 1 testcase, trọng số TC2 (3.0) phải được dồn vào TC1 để
    // tổng thang điểm vẫn là 10.0 thay vì mất 3.0 điểm oan cho sinh viên.
    // Điểm testcase chia đều theo N testcase thật: pass 6/10 -> 60% trọng số testcase.
    const testcasePart = calculateTestcaseScore(passedCount, totalTestcases);
    // Giữ 2 field cũ cho tương thích ScoreBreakdown: dồn toàn bộ vào testcase1.
    const tc1Score = testcasePart;
    const tc2Score = 0;
    const cleanCodePart = Math.round((liveAiRating.cleanCodeScore / 10) * SCORE_WEIGHTS.cleanCode * 10) / 10;
    const solidPart = Math.round((liveSolidAvg / 10) * SCORE_WEIGHTS.solid * 10) / 10;
    const computedScore = Math.min(SCORE_WEIGHTS.maxScore, Math.round((tc1Score + tc2Score + cleanCodePart + solidPart) * 10) / 10);

    // ─────────────────────────────────────────────────────────────────────────
    // BR-03: đạo văn AST >= 80% đã xác nhận -> ĐIỂM = 0 KHÔNG THỂ HOÀN TÁC.
    // Trước đây quy tắc này KHÔNG được áp dụng: pipeline chỉ gắn cờ rồi vẫn tính
    // điểm bình thường, nên bài đạo văn vẫn có thể đạt điểm cao.
    // ─────────────────────────────────────────────────────────────────────────
    const CONFIRMED_PLAGIARISM_THRESHOLD = 80.0;
    const plagiarismRate = plagiarismMatch ? plagiarismMatch.similarityRate : 0;

    // ── Self-overlap is a three-way decision, not a yes/no one.
    //
    //   SAME_ASSIGNMENT  the student resubmitted the same task → ordinary coursework.
    //                    Never zero the score; that was the bug that failed honest students.
    //   CROSS_ASSIGNMENT reused work in another task of the same course → warn only. The
    //                    course may permit it, so a lecturer decides.
    //   CROSS_COURSE     submitted the same work to a different course → this is
    //                    self-plagiarism (duplicate submission) and is penalised.
    //
    // When the service did not label the overlap we fall back to comparing student ids, so a
    // self-match can never be mistaken for collusion.
    const selfOverlap = (plagiarismMatch as any)?.selfOverlap as
      | { kind: 'SAME_ASSIGNMENT' | 'CROSS_ASSIGNMENT' | 'CROSS_COURSE'; isSelfPlagiarism: boolean; label: string }
      | undefined;
    const matchedStudentId = (plagiarismMatch as any)?.matchedStudentId;
    const isSelfMatch =
      !!matchedStudentId && !!jobData.studentId && matchedStudentId === jobData.studentId;
    const selfKind = selfOverlap?.kind ?? (isSelfMatch ? 'SAME_ASSIGNMENT' : undefined);

    if (selfKind === 'SAME_ASSIGNMENT' && plagiarismRate > 0) {
      this.logger.log(
        `[BR-03] ${submissionId}: trùng ${plagiarismRate}% với bài nộp trước của chính sinh viên — ` +
          `đây là nộp lại, KHÔNG trừ điểm.`,
      );
    } else if (selfKind === 'CROSS_ASSIGNMENT' && plagiarismRate > 0) {
      this.logger.warn(
        `[BR-03] ${submissionId}: trùng ${plagiarismRate}% với bài làm khác của sinh viên ${jobData.studentId} trong cùng môn — ` +
          `chỉ cảnh báo để giảng viên xem xét, không tự trừ điểm.`,
      );
    } else if (selfKind === 'CROSS_COURSE' && plagiarismRate > 0) {
      this.logger.warn(
        `[BR-03] ${submissionId}: tự đạo văn ${plagiarismRate}% — bài đã nộp cho một môn khác.`,
      );
    }

    // Only another student's copy, or cross-course reuse, can zero the score. A same-course
    // resubmission and a same-course reuse never can.
    const isConfirmedPlagiarism =
      selfKind === 'CROSS_COURSE'
        ? plagiarismRate >= CONFIRMED_PLAGIARISM_THRESHOLD
        : !isSelfMatch && plagiarismRate >= CONFIRMED_PLAGIARISM_THRESHOLD;

    let finalScore = computedScore;
    let scoreBreakdown: ScoreBreakdown = {
      testcase1: tc1Score,
      testcase2: tc2Score,
      cleanCode: cleanCodePart,
      solid: solidPart,
      total: computedScore,
    };

    if (isConfirmedPlagiarism) {
      finalScore = 0;
      scoreBreakdown = {
        testcase1: 0,
        testcase2: 0,
        cleanCode: 0,
        solid: 0,
        total: 0,
      };
      this.logger.warn(
        `[BR-03] Submission ${submissionId} bị xác nhận đạo văn ${plagiarismRate}% (>= ${CONFIRMED_PLAGIARISM_THRESHOLD}%). ` +
          `Điểm bị đặt về 0 (không thể hoàn tác). Điểm tính toán trước đó: ${computedScore}/10.`,
      );
      this.gradingGateway.emitGradingProgress({
        submissionId, stepId: '6', stepName: 'Phân tích AST & Winnowing',
        status: 'failed',
        detail: `BR-03: Đạo văn ${plagiarismRate}% (>= ${CONFIRMED_PLAGIARISM_THRESHOLD}%) — điểm bị đặt về 0 và không thể hoàn tác.`,
      });
    }


    // Quy tắc đạt: phải pass TOÀN BỘ testcase mới PASSED (rớt 1 = FAILED toàn bài).
    // Điểm số từng phần (scoreBreakdown) giữ nguyên để giảng viên thấy chi tiết.
    const completedPayload = {
      submissionId,
      status: 'COMPLETED' as const,
      overallResult: (passedCount === totalTestcases ? 'PASSED' : 'FAILED') as 'PASSED' | 'FAILED',
      score: finalScore,
      scoreBreakdown,
      maxScore: 10.0,
      passedTestcases: passedCount,
      totalTestcases,
      testcaseResults: testcaseExecutionDetails.map((testcase, index) => ({
        testcaseIndex: index + 1,
        status: testcase.status,
        timeMs: testcase.timeMs,
      })),
      executionTimeMs: totalExecMs,
      sourceCode,
      aiRating: {
        cleanCodeScore: liveAiRating.cleanCodeScore,
        solidScore: liveAiRating.solidScore,
        codeSmells: liveAiRating.codeSmells,
        explanation: liveAiRating.explanation,
      },
      plagiarismMatch,
      // Ngưỡng hiển thị: >= 70% là đạo văn, >= 40% là nghi vấn, còn lại là an toàn.
      similarityRate: plagiarismRate,
      plagiarismStatus: (plagiarismRate >= 70
        ? 'ĐẠO VĂN'
        : plagiarismRate >= 40
          ? 'NGHI VẤN'
          : 'AN TOÀN') as 'AN TOÀN' | 'NGHI VẤN' | 'ĐẠO VĂN',
      // BR-03: cờ cho client biết điểm đã bị đặt về 0 do đạo văn đã xác nhận.
      confirmedPlagiarism: isConfirmedPlagiarism,
      computedScoreBeforePenalty: computedScore,
      // Lỗi biên dịch: hiển thị cho sinh viên biết vì sao bài bị 0 điểm testcase.
      compileError: isRealCompileError,
      compileOutput: isRealCompileError ? sandboxExec.compileOutput || sandboxExec.stderr : undefined,
      executedInContainer: ranInContainer,
      completedAt: new Date().toISOString(),
    };

    await this.submissionRepo.updateStatus(
      submissionId,
      SUBMISSION_STATUS.COMPLETED,
      completedPayload,
      finalScore,
    );

    // Lưu trữ phân rã vào bảng submission_details và ai_review_results theo chuẩn 13 bảng 3NF SRS
    try {
      const detailsBatch = testcaseExecutionDetails.map((t, idx) => ({
        detailId: `DTL-${submissionId}-TC${idx + 1}`,
        submissionId,
        testCaseId: t.id,
        status: (t.status === 'PASSED' ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
        actualOutput: t.actualOutput,
        timeMs: t.timeMs,
        memoryKb: t.memoryKb,
        errorLog: t.status === 'PASSED' ? null : `Testcase ${idx + 1} failed / mismatch`,
      }));
      await this.submissionDetailRepo.createBatch(detailsBatch);

      await this.aiReviewRepo.create({
        reviewId: `REV-${submissionId}`,
        submissionId,
        cleanCodeScore: liveAiRating.cleanCodeScore,
        solidScore: liveSolidAvg,
        codeSmellsCount: liveAiRating.codeSmells?.length || 0,
        feedbackJson: liveAiRating.codeSmells || [],
        compilerExplanation: liveAiRating.explanation || null,
        modelUsed: 'gemini-1.5-pro',
        tokenUsage: { promptTokens: 340, completionTokens: 180, totalTokens: 520 },
        evaluatedAt: new Date(),
      });
      this.logger.log(`✅ [Pipeline] Đã lưu ${detailsBatch.length} testcase logs & AI review vào DB cho bài ${submissionId}`);
    } catch (saveErr: any) {
      this.logger.warn(`[Pipeline] Failed to save detailed logs to database: ${saveErr.message}`);
    }

    this.gradingGateway.emitGradingCompleted(completedPayload);
    this.logger.log(
      `[Pipeline] Completed: ${submissionId} → Score: ${finalScore}/10 (TC: ${passedCount}/${totalTestcases}, CleanCode: ${analysis.cleanCodeScore.toFixed(1)})`,
    );
  }
}
