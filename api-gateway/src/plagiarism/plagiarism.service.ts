import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as AdmZip from 'adm-zip';
import {
  ASTNormalizer,
  ASTPlagiarismEngine,
  ClassPlagiarismMatrixReport,
  CodeSubmission,
  PairwisePlagiarismResult,
  WinnowingEngine,
} from './ast-plagiarism.engine';
import { PlagiarismRepository } from '../database/plagiarism.repository';
import { SubmissionRepository } from '../database/submission.repository';
import { UserRepository } from '../database/user.repository';
import { SubmissionRecord } from '../database/submission.entity';
import { PlagiarismReportRecord, PlagiarismReportStatus } from '../database/plagiarism-report.entity';

export interface PlagiarismDetectionResult {
  submissionId: string;
  comparedCount: number;
  reportsPersisted: number;
  fingerprintsStored: number;
  topMatch: {
    matchedStudentName: string;
    matchedStudentId: string;
    similarityRate: number;
    sourceCodeA: string;
    sourceCodeB: string;
    matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
    isFlagged: boolean;
    status: string;
    jaccardSimilarity: number;
    winnowingContainment: number;
    astStructuralSimilarity: number;
  } | null;
  engine: 'GENAI_HUB_HTTP' | 'LOCAL_AST_ENGINE';
  executionTimeMs: number;
}

export interface AssignmentMatrixResult {
  assignmentId: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number;
  similarityMatrix: number[][];
  submissionsList: { id: string; name?: string }[];
  flaggedReports: unknown[];
  totalExecutionTimeMs: number;
  engine: string;
}

/** Business rule BR-04: plagiarism reports are visible to INSTRUCTOR/HOD only, never to students. */
const PLAGIARISM_HUB_MATRIX_URL = 'http://localhost:3001/api/v1/ast/matrix';
const HUB_TIMEOUT_MS = 4000;

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);

  constructor(
    private readonly plagiarismRepo: PlagiarismRepository,
    private readonly submissionRepo: SubmissionRepository,
    private readonly userRepo: UserRepository,
  ) {}

  public static readonly PLAGIARISM_THRESHOLD = ASTPlagiarismEngine.PLAGIARISM_THRESHOLD;

  /**
   * Full Workflow 2 step 6 (BR-04 gated at the controller level):
   *   1) normalize + winnow the current submission, persist AST fingerprints (idempotent)
   *   2) load every OTHER submission of the same assignment, unzip its source code
   *   3) compare all pairs — GenAI Hub HTTP first, LOCAL_AST_ENGINE on any failure
   *   4) persist one canonical plagiarism_report per compared pair
   *   5) return the highest-similarity peer mapped to GradingCompletedPayload.plagiarismMatch
   *
   * Never throws for 0/1 peers, missing or corrupt peer zips, or an offline hub.
   */
  public async detectForSubmission(params: {
    submissionId: string;
    studentId: string;
    assignmentId: string;
    language: string;
    sourceCode: string;
  }): Promise<PlagiarismDetectionResult> {
    const startTime = Date.now();
    const language = params.language || 'python';
    const sourceCode = params.sourceCode || '';

    // 1) Fingerprints for the current submission.
    const normalized = ASTNormalizer.normalize(sourceCode, language);
    const fingerprints = WinnowingEngine.computeFingerprints(normalized.tokens);
    const fingerprintsStored = await this.plagiarismRepo.saveFingerprints(
      params.submissionId,
      fingerprints,
      'main',
    );
    this.logger.log(
      `[Plagiarism] ${params.submissionId}: ${normalized.tokens.length} AST tokens, ${fingerprints.length} winnowing fingerprints stored.`,
    );

    // 2) Peer discovery — same assignment, excluding self, deduplicated.
    const peers = await this.loadPeerSubmissions(params.submissionId, params.assignmentId, language);

    const emptyResult: PlagiarismDetectionResult = {
      submissionId: params.submissionId,
      comparedCount: 0,
      reportsPersisted: 0,
      fingerprintsStored,
      topMatch: null,
      engine: 'LOCAL_AST_ENGINE',
      executionTimeMs: Date.now() - startTime,
    };

    if (peers.length === 0) {
      this.logger.log(
        `[Plagiarism] ${params.submissionId}: không có bài nộp nào khác trong assignment ${params.assignmentId} để so khớp.`,
      );
      return emptyResult;
    }

    // 3) Compare all pairs (current first so pair (i=0, j) is always current-vs-peer).
    const submissions: CodeSubmission[] = [
      {
        submissionId: params.submissionId,
        studentName: await this.resolveStudentName(params.studentId),
        studentId: params.studentId,
        sourceCode,
        language,
        filePath: 'main',
      },
      ...peers.map((p) => ({
        submissionId: p.record.submissionId,
        studentName: p.studentName,
        studentId: p.record.studentId,
        sourceCode: p.sourceCode,
        language: p.record.language || language,
        filePath: p.record.filePath,
      })),
    ];

    const comparison = await this.compareAllPairs(submissions, params.assignmentId);

    for (const report of comparison.flaggedOrAll) {
      this.logger.log(
        `[Plagiarism] So khớp ${report.submissionAId} <-> ${report.submissionBId}: ${report.similarityRate}% ` +
          `(jaccard=${report.matchedTokensJson.jaccardSimilarity}%, containment=${report.matchedTokensJson.winnowingContainment}%, ` +
          `ast=${report.matchedTokensJson.astStructuralSimilarity}%) -> ${report.status}`,
      );
    }

    // 4) Persist one canonical report per compared pair.
    let reportsPersisted = 0;
    for (const pair of comparison.pairs) {
      const persisted = await this.persistPairReport(pair, params.assignmentId);
      if (persisted) reportsPersisted++;
    }

    // 5) Top match = highest-similarity pair that actually involves the current submission.
    const involved = comparison.pairs
      .filter((p) => p.submissionAId === params.submissionId || p.submissionBId === params.submissionId)
      .sort((a, b) => b.similarityRate - a.similarityRate);

    let topMatch: PlagiarismDetectionResult['topMatch'] = null;
    if (involved.length > 0) {
      const best = involved[0];
      const peerId = best.submissionAId === params.submissionId ? best.submissionBId : best.submissionAId;
      const peer = peers.find((p) => p.record.submissionId === peerId);

      // Orient the diff so A is ALWAYS the submission under analysis (matches the websocket payload).
      const aIsCurrent = best.submissionAId === params.submissionId;
      const sourceCodeA = aIsCurrent ? sourceCode : peer ? peer.sourceCode : '';
      const sourceCodeB = aIsCurrent ? (peer ? peer.sourceCode : '') : sourceCode;
      // Websocket payload expects [startLine, endLine] tuples, not {start,end} objects.
      const toTuple = (range: { start: number; end: number }): [number, number] => [
        range ? range.start : 1,
        range ? range.end : 1,
      ];
      const matchedTokens = best.matchedTokensJson.matchedSegments.map((seg) => ({
        lineA: toTuple(aIsCurrent ? seg.lineRangeA : seg.lineRangeB) as [number, number],
        lineB: toTuple(aIsCurrent ? seg.lineRangeB : seg.lineRangeA) as [number, number],
      }));

      topMatch = {
        matchedStudentName: peer ? peer.studentName : peerId,
        matchedStudentId: peer ? peer.record.studentId : peerId,
        similarityRate: best.similarityRate,
        sourceCodeA,
        sourceCodeB,
        matchedTokens,
        isFlagged: best.isFlagged,
        status: best.status,
        jaccardSimilarity: best.matchedTokensJson.jaccardSimilarity,
        winnowingContainment: best.matchedTokensJson.winnowingContainment,
        astStructuralSimilarity: best.matchedTokensJson.astStructuralSimilarity,
      };
    }

    return {
      submissionId: params.submissionId,
      comparedCount: peers.length,
      reportsPersisted,
      fingerprintsStored,
      topMatch,
      engine: comparison.engine,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /** Full class matrix for an assignment (BR-04 gated at the controller level). */
  public async getAssignmentMatrix(assignmentId: string): Promise<AssignmentMatrixResult> {
    const startTime = Date.now();
    const records = await this.submissionRepo.findAll({ assignmentId });

    const submissions: CodeSubmission[] = [];
    for (const record of records) {
      const code = this.extractSourceCodeFromZip(record.filePath, record.language);
      if (code === null) {
        this.logger.warn(`[Plagiarism] Bỏ qua ${record.submissionId}: không giải nén được source code (${record.filePath}).`);
        continue;
      }
      submissions.push({
        submissionId: record.submissionId,
        studentName: await this.resolveStudentName(record.studentId),
        studentId: record.studentId,
        sourceCode: code,
        language: record.language || 'python',
        filePath: record.filePath,
      });
    }

    let matrix: ClassPlagiarismMatrixReport;
    let engine: string = 'LOCAL_AST_ENGINE';

    const hubReport = submissions.length >= 2 ? await this.requestHubMatrix(submissions, assignmentId) : null;
    if (hubReport) {
      matrix = hubReport;
      engine = 'GENAI_HUB_HTTP';
    } else {
      matrix = ASTPlagiarismEngine.computeClassSimilarityMatrix(submissions, assignmentId);
    }

    return {
      assignmentId,
      totalSubmissions: matrix.totalSubmissions,
      totalPairsCompared: matrix.totalPairsCompared,
      flaggedPairsCount: matrix.flaggedPairsCount,
      similarityMatrix: matrix.similarityMatrix,
      submissionsList: matrix.submissionsList,
      flaggedReports: matrix.flaggedReports,
      totalExecutionTimeMs: matrix.totalExecutionTimeMs || Date.now() - startTime,
      engine,
    };
  }

  public async getReports(filter?: { assignmentId?: string; flaggedOnly?: boolean; limit?: number }): Promise<unknown[]> {
    const reports = await this.plagiarismRepo.findAll(filter);
    return reports.map((r) => this.toApiReport(r));
  }

  public async getFingerprints(submissionId: string): Promise<{ submissionId: string; count: number; fingerprints: unknown[] }> {
    const fingerprints = await this.plagiarismRepo.findFingerprintsBySubmission(submissionId);
    return { submissionId, count: fingerprints.length, fingerprints };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────────

  /** Loads every OTHER submission of the assignment, unzipping valid source code. */
  private async loadPeerSubmissions(
    currentSubmissionId: string,
    assignmentId: string,
    language: string,
  ): Promise<Array<{ record: SubmissionRecord; sourceCode: string; studentName: string }>> {
    let all: SubmissionRecord[] = [];
    try {
      all = await this.submissionRepo.findAll({ assignmentId });
    } catch (err: any) {
      this.logger.warn(`[Plagiarism] Không tải được danh sách bài nộp của ${assignmentId}: ${err.message}`);
      return [];
    }

    const seenIds = new Set<string>([currentSubmissionId]);
    const seenHashes = new Set<string>();
    const peers: Array<{ record: SubmissionRecord; sourceCode: string; studentName: string }> = [];

    for (const record of all) {
      // Guard: never compare a submission against itself.
      if (!record || record.submissionId === currentSubmissionId) continue;
      // Guard: duplicate peers (same id, or byte-identical upload seen twice).
      if (seenIds.has(record.submissionId)) continue;
      if (record.sha256Hash && seenHashes.has(record.sha256Hash)) continue;

      const sourceCode = this.extractSourceCodeFromZip(record.filePath, record.language || language);
      if (sourceCode === null) {
        this.logger.warn(
          `[Plagiarism] Bỏ qua bài nộp ${record.submissionId}: file zip thiếu/hỏng (${record.filePath}).`,
        );
        continue;
      }

      seenIds.add(record.submissionId);
      if (record.sha256Hash) seenHashes.add(record.sha256Hash);

      peers.push({
        record,
        sourceCode,
        studentName: await this.resolveStudentName(record.studentId),
      });
    }

    return peers;
  }

  /**
   * Compares every unordered pair. Hub HTTP first; on transport error / non-200 / missing
   * flaggedReports the LOCAL_AST_ENGINE mirror takes over (identical algorithm).
   */
  private async compareAllPairs(
    submissions: CodeSubmission[],
    assignmentId: string,
  ): Promise<{ pairs: PairwisePlagiarismResult[]; engine: 'GENAI_HUB_HTTP' | 'LOCAL_AST_ENGINE'; flaggedOrAll: PairwisePlagiarismResult[] }> {
    if (submissions.length >= 2) {
      const hubReport = await this.requestHubMatrix(submissions, assignmentId);
      if (hubReport) {
        const pairs = this.rebuildPairsFromMatrix(submissions, hubReport);
        return { pairs, engine: 'GENAI_HUB_HTTP', flaggedOrAll: pairs };
      }
    }

    const pairs: PairwisePlagiarismResult[] = [];
    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        pairs.push(ASTPlagiarismEngine.compareSubmissions(submissions[i], submissions[j]));
      }
    }
    return { pairs, engine: 'LOCAL_AST_ENGINE', flaggedOrAll: pairs };
  }

  /**
   * The hub returns only flagged pairs inside `flaggedReports` plus the full N x N
   * `similarityMatrix`. Rebuild every pair with exact per-pair metrics so persistence is
   * complete (non-flagged pairs inherit their matrix similarity).
   */
  private rebuildPairsFromMatrix(
    submissions: CodeSubmission[],
    matrix: ClassPlagiarismMatrixReport,
  ): PairwisePlagiarismResult[] {
    const pairs: PairwisePlagiarismResult[] = [];
    const flaggedIndex = new Map<string, PairwisePlagiarismResult>();
    for (const r of matrix.flaggedReports || []) {
      flaggedIndex.set(`${r.submissionAId}::${r.submissionBId}`, r);
      flaggedIndex.set(`${r.submissionBId}::${r.submissionAId}`, r);
    }

    for (let i = 0; i < submissions.length; i++) {
      for (let j = i + 1; j < submissions.length; j++) {
        const a = submissions[i];
        const b = submissions[j];
        const exact = flaggedIndex.get(`${a.submissionId}::${b.submissionId}`);
        if (exact) {
          pairs.push(exact);
          continue;
        }

        // Not flagged on the hub side — recompute locally for exact segment/metric detail.
        pairs.push(ASTPlagiarismEngine.compareSubmissions(a, b));
      }
    }
    return pairs;
  }

  /** POST the class matrix to the GenAI Hub; returns null on ANY failure so the caller can fall back. */
  private async requestHubMatrix(
    submissions: CodeSubmission[],
    assignmentId?: string,
  ): Promise<ClassPlagiarismMatrixReport | null> {
    try {
      const res = await fetch(PLAGIARISM_HUB_MATRIX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions, assignmentId }),
        signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
      });

      if (!res || res.status !== 200) {
        this.logger.warn(
          `[Plagiarism] GenAI Hub trả về HTTP ${res ? res.status : 'N/A'} — chuyển sang LOCAL_AST_ENGINE (offline fallback).`,
        );
        return null;
      }

      const body: any = await res.json();
      if (!body || typeof body !== 'object' || !Array.isArray(body.similarityMatrix)) {
        this.logger.warn('[Plagiarism] GenAI Hub trả về payload không hợp lệ — chuyển sang LOCAL_AST_ENGINE.');
        return null;
      }

      this.logger.log(
        `[Plagiarism] GenAI Hub matrix OK: ${body.totalSubmissions} bài, ${body.totalPairsCompared} cặp, ${body.flaggedPairsCount} cặp bị gắn cờ.`,
      );
      return body as ClassPlagiarismMatrixReport;
    } catch (err: any) {
      this.logger.warn(
        `[Plagiarism] Không gọi được GenAI Hub (${err.message}) — chuyển sang LOCAL_AST_ENGINE (offline fallback).`,
      );
      return null;
    }
  }

  /** Persist one canonical (submissionAId < submissionBId) report row. Never throws. */
  private async persistPairReport(pair: PairwisePlagiarismResult, assignmentId: string): Promise<boolean> {
    try {
      const status: PlagiarismReportStatus =
        pair.status === 'CLEAN' || pair.status === 'SUSPECTED' || pair.status === 'FLAGGED_PLAGIARISM'
          ? pair.status
          : pair.isFlagged
            ? 'FLAGGED_PLAGIARISM'
            : 'CLEAN';

      const record: PlagiarismReportRecord = {
        reportId: this.plagiarismRepo.newReportId(),
        assignmentId,
        submissionAId: pair.submissionAId,
        submissionBId: pair.submissionBId,
        similarityRate: pair.similarityRate,
        flaggedAsFraud: pair.isFlagged,
        commonFingerprintsCount: pair.commonFingerprintsCount,
        totalUniqueFingerprints: pair.totalUniqueFingerprints,
        matchedTokensJson: pair.matchedTokensJson,
        status,
        evaluatedAt: new Date(),
        createdAt: new Date(),
      };

      await this.plagiarismRepo.upsertReport(record);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `[Plagiarism] Không lưu được báo cáo cặp ${pair.submissionAId}/${pair.submissionBId}: ${err.message}`,
      );
      return false;
    }
  }

  private async resolveStudentName(studentId: string): Promise<string> {
    if (!studentId) return 'Không xác định';
    try {
      const user = await this.userRepo.findById(studentId);
      return (user && user.fullName) || studentId;
    } catch {
      return studentId;
    }
  }

  private toApiReport(r: PlagiarismReportRecord): unknown {
    return {
      reportId: r.reportId,
      assignmentId: r.assignmentId,
      submissionAId: r.submissionAId,
      submissionBId: r.submissionBId,
      similarityRate: r.similarityRate,
      flaggedAsFraud: r.flaggedAsFraud,
      commonFingerprintsCount: r.commonFingerprintsCount,
      totalUniqueFingerprints: r.totalUniqueFingerprints,
      status: r.status,
      matchedTokensJson: r.matchedTokensJson,
      evaluatedAt: r.evaluatedAt,
      createdAt: r.createdAt,
    };
  }

  /**
   * Giải nén file zip và tìm file source code đầu tiên phù hợp ngôn ngữ.
   * Mirrors the exact working pattern of `extractSourceCodeFromZip` in grading-worker.consumer.ts.
   */
  public extractSourceCodeFromZip(filePath: string, language: string): string | null {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();

      const extMap: Record<string, string[]> = {
        java: ['.java'],
        python: ['.py'],
        cpp: ['.cpp', '.cc', '.cxx', '.c'],
        dotnet: ['.cs'],
      };
      const targetExts = extMap[(language || '').toLowerCase()] || ['.java', '.py', '.cpp', '.cs'];

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
}
