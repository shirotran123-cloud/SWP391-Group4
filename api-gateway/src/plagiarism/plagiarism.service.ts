import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as AdmZip from 'adm-zip';
import {
  ASTNormalizer,
} from './ast-engine/ast-normalizer';
import {
  WinnowingEngine,
} from './ast-engine/winnowing';
import {
  ASTPlagiarismEngine,
  ClassPlagiarismMatrixReport,
  CodeSubmission,
  PairwisePlagiarismResult,
  PlagiarismCluster,
  CrossClusterIndependence,
} from './ast-engine/plagiarism-engine';
import { PlagiarismRepository } from '../database/plagiarism.repository';
import { SubmissionRepository } from '../database/submission.repository';
import { UserRepository } from '../database/user.repository';
import { SubmissionRecord } from '../database/submission.entity';
import { PlagiarismReportRecord, PlagiarismStatus as PlagiarismReportStatus } from '../database/plagiarism.entity';
import { AssignmentRepository } from '../database/assignment.repository';

/**
 * How a matched pair relates to the submission under analysis.
 *
 * Academic-integrity guidance separates three situations that all look like "the same code,
 * same student", but carry very different judgements:
 *
 *   SAME_ASSIGNMENT   the student resubmitted the same task (e.g. after a fix). This is
 *                     normal coursework. It must NOT be treated as plagiarism.
 *   CROSS_ASSIGNMENT  the same student reused their work in another task of the SAME course.
 *                     Warn for the lecturer to review; may or may not be allowed by the
 *                     course's own rules.
 *   CROSS_COURSE      the same student submitted the same work to a DIFFERENT course. This is
 *                     self-plagiarism (duplicate submission) in the academic sense.
 */
export type SelfOverlapKind = 'SAME_ASSIGNMENT' | 'CROSS_ASSIGNMENT' | 'CROSS_COURSE';

export interface SelfOverlapInfo {
  kind: SelfOverlapKind;
  /** True only for CROSS_COURSE, which is the case treated as actual self-plagiarism. */
  isSelfPlagiarism: boolean;
  /** Human-readable Vietnamese explanation shown to staff. */
  label: string;
}

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
    /** Set when the matched submission belongs to the SAME student. */
    selfOverlap?: SelfOverlapInfo;
  } | null;
  /** True when the top match is the student's own work in another task. */
  selfOverlap?: SelfOverlapInfo | null;
  /** Per-category counts of peers excluded or kept. */
  peerBreakdown?: {
    otherStudents: number;
    sameAssignmentResubmissions: number;
    crossAssignmentReuse: number;
    crossCourseReuse: number;
  };
  engine: 'GENAI_HUB_HTTP' | 'LOCAL_AST_ENGINE';
  executionTimeMs: number;
}

export interface AssignmentMatrixResult {
  assignmentId: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number;
  similarityMatrix: number[][];
  submissionsList: { id: string; name?: string; studentId?: string; sourceCode?: string; language?: string }[];
  flaggedReports: unknown[];
  clusters: PlagiarismCluster[];
  independentSubmissions: { id: string; name?: string; studentId?: string }[];
  crossClusterIndependence: CrossClusterIndependence[];
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
    private readonly assignmentRepo: AssignmentRepository,
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

    // 2) Peer discovery — same assignment, excluding self.
    //
    // Peers from OTHER students are always compared. Peers from the SAME student are also
    // kept, but tagged with how they relate (resubmission / another task / another course),
    // because "same code from the same person" is only self-plagiarism in the last case.
    const { peers, breakdown } = await this.loadPeerSubmissions(
      params.submissionId,
      params.assignmentId,
      language,
      params.studentId,
    );

    const emptyResult: PlagiarismDetectionResult = {
      submissionId: params.submissionId,
      comparedCount: 0,
      reportsPersisted: 0,
      fingerprintsStored,
      topMatch: null,
      selfOverlap: null,
      peerBreakdown: breakdown,
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
          `(jaccard=${report.matchedTokensJson.jaccardSimilarity}%, containment=${report.matchedTokensJson.maxContainment}%, ` +
          `binA=${report.matchedTokensJson.containmentBinA}%, ainB=${report.matchedTokensJson.containmentAinB}%) -> ${report.status}`,
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
        winnowingContainment: best.matchedTokensJson.maxContainment,
        astStructuralSimilarity: best.matchedTokensJson.containmentAinB,
        // Only set when the match is the student's own work; lets every caller distinguish a
        // resubmission from collusion without re-deriving it.
        selfOverlap: peer?.selfOverlap,
      };

      // A resubmission of the same task must not be surfaced as a plagiarism flag at all.
      if (peer?.selfOverlap?.kind === 'SAME_ASSIGNMENT') {
        this.logger.log(
          `[Plagiarism] ${params.submissionId}: trùng ${best.similarityRate}% với bài nộp trước của cùng sinh viên — ` +
            `đây là nộp lại, không gắn cờ đạo văn.`,
        );
        topMatch.isFlagged = false;
        topMatch.status = 'SELF_RESUBMISSION';
      }
    }

    return {
      submissionId: params.submissionId,
      comparedCount: peers.length,
      reportsPersisted,
      fingerprintsStored,
      topMatch,
      selfOverlap: topMatch?.selfOverlap ?? null,
      peerBreakdown: breakdown,
      engine: comparison.engine,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /** Full class matrix for an assignment or class (BR-04 gated at the controller level). */
  public async getAssignmentMatrix(assignmentId: string): Promise<AssignmentMatrixResult> {
    const startTime = Date.now();
    let records: SubmissionRecord[] = [];

    try {
      if (!assignmentId || assignmentId === 'ALL') {
        records = await this.submissionRepo.findAll({});
      } else if (assignmentId.startsWith('CRS-') || assignmentId.startsWith('CLASS-') || assignmentId.startsWith('COURSE-')) {
        const classAssignments = await this.assignmentRepo.findByCourseId(assignmentId);
        const assignIds = classAssignments.map((a) => a.assignmentId);
        if (assignIds.length > 0) {
          const allRecords = await this.submissionRepo.findAll({});
          records = allRecords.filter((r) => assignIds.includes(r.assignmentId));
        } else {
          records = [];
        }
      } else {
        records = await this.submissionRepo.findAll({ assignmentId });
      }
    } catch {
      records = [];
    }

    const submissions: CodeSubmission[] = [];
    for (const record of records) {
      const code = this.extractSourceCodeFromZip(record.filePath, record.language, record);
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

    // Luôn sử dụng LOCAL_AST_ENGINE (SSOT) để đồng bộ tuyệt đối 100% với kết quả chấm bài của Worker
    const matrix: ClassPlagiarismMatrixReport = ASTPlagiarismEngine.computeClassSimilarityMatrix(submissions, assignmentId);
    const engine: string = 'LOCAL_AST_ENGINE';

    return {
      assignmentId,
      totalSubmissions: matrix.totalSubmissions,
      totalPairsCompared: matrix.totalPairsCompared,
      flaggedPairsCount: matrix.flaggedPairsCount,
      similarityMatrix: matrix.similarityMatrix,
      submissionsList: matrix.submissionsList,
      flaggedReports: matrix.flaggedReports,
      clusters: matrix.clusters,
      independentSubmissions: matrix.independentSubmissions,
      crossClusterIndependence: matrix.crossClusterIndependence,
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

  /**
   * Cung cấp số liệu thực nghiệm đối soát mã nguồn ngụy trang phục vụ Bài báo IEEE (Thành viên 4)
   */
  public async getIEEEOffuscationBenchmark() {
    const { runExperiments } = await import('./ast-engine/ieee-benchmark');
    return runExperiments();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Loads the submissions this one should be compared against, tagging self-overlap.
   *
   * All peers of the same assignment are compared — including the student's own earlier
   * submissions. What changes is the LABEL attached to each, because "same code, same person"
   * has three very different meanings:
   *
   *   • other student            → ordinary plagiarism check
   *   • same student, same task  → a resubmission; legitimate, must never be penalised
   *   • same student, same course, different task → reuse; warn for review
   *   • same student, different course            → self-plagiarism; flag
   *
   * The last case needs the course of the matched assignment, so that lookup happens here.
   */
  private async loadPeerSubmissions(
    currentSubmissionId: string,
    assignmentId: string,
    language: string,
    currentStudentId?: string,
  ): Promise<{
    peers: Array<{ record: SubmissionRecord; sourceCode: string; studentName: string; selfOverlap?: SelfOverlapInfo }>;
    breakdown: { otherStudents: number; sameAssignmentResubmissions: number; crossAssignmentReuse: number; crossCourseReuse: number };
  }> {
    const breakdown = {
      otherStudents: 0,
      sameAssignmentResubmissions: 0,
      crossAssignmentReuse: 0,
      crossCourseReuse: 0,
    };

    let all: SubmissionRecord[] = [];
    try {
      all = await this.submissionRepo.findAll({ assignmentId });
    } catch (err: any) {
      this.logger.warn(`[Plagiarism] Không tải được danh sách bài nộp của ${assignmentId}: ${err.message}`);
      return { peers: [], breakdown };
    }

    // The current assignment's course, needed to tell "another task" from "another course".
    let currentCourseId: string | undefined;
    try {
      currentCourseId = (await this.assignmentRepo.findById(assignmentId))?.courseId;
    } catch {
      currentCourseId = undefined;
    }

    const seenIds = new Set<string>([currentSubmissionId]);
    const seenHashes = new Set<string>();
    const peers: Array<{ record: SubmissionRecord; sourceCode: string; studentName: string; selfOverlap?: SelfOverlapInfo }> = [];

    for (const record of all) {
      // Never compare a submission against itself.
      if (!record || record.submissionId === currentSubmissionId) continue;
      // Duplicate peers (same id, or byte-identical upload already considered).
      if (seenIds.has(record.submissionId)) continue;

      const isSameStudent = !!currentStudentId && record.studentId === currentStudentId;

      // For a same-student peer, decide how it relates. Finding the matched assignment's
      // course is a small extra query, but only for self-peers, which are rare.
      let selfOverlap: SelfOverlapInfo | undefined;
      if (isSameStudent) {
        const matchedCourseId = await this.resolveAssignmentCourse(record.assignmentId);
        selfOverlap = PlagiarismService.classifySelfOverlap(
          assignmentId,
          currentCourseId,
          record.assignmentId,
          matchedCourseId,
        );
        if (selfOverlap.kind === 'SAME_ASSIGNMENT') breakdown.sameAssignmentResubmissions++;
        else if (selfOverlap.kind === 'CROSS_ASSIGNMENT') breakdown.crossAssignmentReuse++;
        else breakdown.crossCourseReuse++;
      }

      // Byte-identical duplicates are noise EXCEPT when they come from another student — two
      // students uploading the same archive is the strongest plagiarism signal there is.
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
      if (!isSameStudent) breakdown.otherStudents++;

      peers.push({
        record,
        sourceCode,
        studentName: await this.resolveStudentName(record.studentId),
        selfOverlap,
      });
    }

    if (breakdown.sameAssignmentResubmissions > 0 || breakdown.crossAssignmentReuse > 0 || breakdown.crossCourseReuse > 0) {
      this.logger.log(
        `[Plagiarism] ${currentSubmissionId}: cùng sinh viên — nộp lại=${breakdown.sameAssignmentResubmissions}, ` +
          `tái sử dụng khác bài=${breakdown.crossAssignmentReuse}, khác môn=${breakdown.crossCourseReuse}; ` +
          `bài của sinh viên khác=${breakdown.otherStudents}.`,
      );
    }

    return { peers, breakdown };
  }

  /** Looks up the course of an assignment, tolerating a missing repository or record. */
  private async resolveAssignmentCourse(assignmentId: string): Promise<string | undefined> {
    try {
      return (await this.assignmentRepo.findById(assignmentId))?.courseId;
    } catch {
      return undefined;
    }
  }

  /**
   * Classifies a same-student match. Pure function so the rule is testable without a DB.
   *
   * Only CROSS_COURSE is genuine self-plagiarism. A resubmission of the same assignment is
   * ordinary coursework, and reuse inside one course is a matter for that course's own rules.
   *
   * Order matters: the COURSE is checked before the assignment id. Two courses can both use
   * an assignment code like "ASM-01", so an id-only comparison would label cross-course
   * reuse as a harmless resubmission — the one case that must be caught.
   */
  public static classifySelfOverlap(
    currentAssignmentId: string,
    currentCourseId: string | undefined,
    matchedAssignmentId: string,
    matchedCourseId: string | undefined,
  ): SelfOverlapInfo {
    // A different course is self-plagiarism regardless of what the assignment is called.
    const bothCoursesKnown = !!currentCourseId && !!matchedCourseId;
    if (bothCoursesKnown && currentCourseId !== matchedCourseId) {
      return {
        kind: 'CROSS_COURSE',
        isSelfPlagiarism: true,
        label: 'Tự đạo văn: dùng lại bài đã nộp cho một môn khác',
      };
    }

    if (matchedAssignmentId === currentAssignmentId) {
      return {
        kind: 'SAME_ASSIGNMENT',
        isSelfPlagiarism: false,
        label: 'Nộp lại cùng một bài tập — không tính là đạo văn',
      };
    }

    // Same course (or the courses are unknown, in which case we do not accuse anyone).
    return {
      kind: 'CROSS_ASSIGNMENT',
      isSelfPlagiarism: false,
      label: 'Dùng lại bài làm của chính mình cho bài tập khác trong cùng môn — giảng viên nên xem xét',
    };
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
        // Self-pairs ARE compared here so the relationship can be classified and reported.
        // Whether the result counts as plagiarism is decided later, from `selfOverlap`:
        // a resubmission of the same task is never flagged, cross-course reuse is.
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

        // Self-pairs are kept for classification, exactly as in the local engine.
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
  public extractSourceCodeFromZip(filePath: string, language: string, fallbackRecord?: any): string | null {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();

        const extMap: Record<string, string[]> = {
          java: ['.java'],
          python: ['.py'],
          cpp: ['.cpp', '.cc', '.cxx', '.c'],
          dotnet: ['.cs'],
        };
        const targetExts = extMap[(language || '').toLowerCase()] || ['.java', '.py', '.cpp', '.cs'];

        // 1. Tìm file source code khớp đuôi mở rộng chuẩn của ngôn ngữ
        for (const entry of entries) {
          if (!entry.isDirectory && !entry.entryName.includes('__MACOSX')) {
            const name = entry.entryName.toLowerCase();
            if (targetExts.some((ext) => name.endsWith(ext))) {
              return zip.readAsText(entry);
            }
          }
        }

        // 2. Fallback thông minh: hỗ trợ khi sinh viên đặt tên file .txt hoặc không có đuôi nhưng chứa mã nguồn hợp lệ
        for (const entry of entries) {
          if (!entry.isDirectory && !entry.entryName.includes('__MACOSX')) {
            const name = entry.entryName.toLowerCase();
            if (name.endsWith('.txt') || !name.includes('.')) {
              const content = zip.readAsText(entry);
              if (
                content &&
                (content.includes('class ') ||
                  content.includes('public static void main') ||
                  content.includes('import java') ||
                  content.includes('def ') ||
                  content.includes('#include') ||
                  content.includes('namespace') ||
                  content.includes('using System'))
              ) {
                return content;
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback trích xuất từ chi tiết bài nộp trong DB nếu file zip không tồn tại trên đĩa
    if (fallbackRecord && fallbackRecord.details) {
      try {
        const parsed = typeof fallbackRecord.details === 'string'
          ? JSON.parse(fallbackRecord.details)
          : fallbackRecord.details;
        if (parsed?.sourceCode) return parsed.sourceCode;
        if (parsed?.plagiarismMatch?.sourceCodeA) return parsed.plagiarismMatch.sourceCodeA;
      } catch {
        // ignore
      }
    }

    return null;
  }
}
