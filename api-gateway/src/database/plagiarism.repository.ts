import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlagiarismReportRecord, PlagiarismStatus } from './plagiarism.entity';
import { AstFingerprintRepository } from './ast-fingerprint.repository';
import { AstFingerprintRecord } from './ast-fingerprint.entity';
import { Fingerprint } from '../plagiarism/ast-engine/winnowing';
import { randomUUID } from 'crypto';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

export interface PlagiarismReportFilter {
  assignmentId?: string;
  flaggedOnly?: boolean;
  limit?: number;
}

@Injectable()
export class PlagiarismRepository implements OnModuleInit {
  private readonly logger = new Logger(PlagiarismRepository.name);
  private readonly records: Map<string, PlagiarismReportRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(
    private readonly postgres: PostgresService,
    private readonly fingerprintRepo: AstFingerprintRepository,
  ) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'plagiarism_reports_store.json');
    this.initStore();
  }

  public async onModuleInit(): Promise<void> {
    await this.syncWithPostgres();
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: PlagiarismReportRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.reportId, {
            ...record,
            evaluatedAt: new Date(record.evaluatedAt),
            createdAt: new Date(record.createdAt),
          });
        }
        this.logger.log(`[PlagiarismRepository] Đã tải ${this.records.size} báo cáo đạo văn từ persistent store.`);
      }
    } catch (err: any) {
      this.logger.warn(`[PlagiarismRepository] Lỗi tải store: ${err.message}. Khởi tạo rỗng.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[PlagiarismRepository] Lỗi lưu trữ store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT report_id, assignment_id, submission_a_id, submission_b_id, similarity_rate, 
                flagged_as_fraud, common_fingerprints_count, total_unique_fingerprints, 
                matched_tokens_json, status, evaluated_at, created_at 
         FROM plagiarism_reports ORDER BY similarity_rate DESC`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.report_id, {
            reportId: r.report_id,
            assignmentId: r.assignment_id,
            submissionAId: r.submission_a_id,
            submissionBId: r.submission_b_id,
            similarityRate: parseFloat(r.similarity_rate),
            flaggedAsFraud: r.flagged_as_fraud,
            commonFingerprintsCount: parseInt(r.common_fingerprints_count, 10) || 0,
            totalUniqueFingerprints: parseInt(r.total_unique_fingerprints, 10) || 0,
            matchedTokensJson: r.matched_tokens_json,
            status: r.status,
            evaluatedAt: new Date(r.evaluated_at),
            createdAt: new Date(r.created_at),
          });
        }
        this.logger.log(`✅ [PlagiarismRepository] Đã đồng bộ ${rows.length} báo cáo đạo văn từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[PlagiarismRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  public async create(record: Omit<PlagiarismReportRecord, 'createdAt'>): Promise<PlagiarismReportRecord> {
    const now = new Date();
    const newRecord: PlagiarismReportRecord = {
      ...record,
      createdAt: now,
    };

    this.records.set(newRecord.reportId, newRecord);
    this.persist();

    if (this.postgres.isAvailable()) {
      await this.postgres.safeQuery(
        `INSERT INTO plagiarism_reports (
           report_id, assignment_id, submission_a_id, submission_b_id, similarity_rate, 
           flagged_as_fraud, common_fingerprints_count, total_unique_fingerprints, 
           matched_tokens_json, status, evaluated_at, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (submission_a_id, submission_b_id) DO UPDATE SET
           similarity_rate = EXCLUDED.similarity_rate,
           flagged_as_fraud = EXCLUDED.flagged_as_fraud,
           common_fingerprints_count = EXCLUDED.common_fingerprints_count,
           total_unique_fingerprints = EXCLUDED.total_unique_fingerprints,
           matched_tokens_json = EXCLUDED.matched_tokens_json,
           status = EXCLUDED.status,
           evaluated_at = NOW()`,
        [
          newRecord.reportId,
          newRecord.assignmentId || null,
          newRecord.submissionAId,
          newRecord.submissionBId,
          newRecord.similarityRate,
          newRecord.flaggedAsFraud,
          newRecord.commonFingerprintsCount,
          newRecord.totalUniqueFingerprints,
          JSON.stringify(newRecord.matchedTokensJson || {}),
          newRecord.status,
          newRecord.evaluatedAt,
          newRecord.createdAt,
        ],
      );
    }

    return newRecord;
  }

  public async findByAssignmentId(assignmentId: string): Promise<PlagiarismReportRecord[]> {
    if (this.postgres.isAvailable()) {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT report_id, assignment_id, submission_a_id, submission_b_id, similarity_rate, 
                flagged_as_fraud, common_fingerprints_count, total_unique_fingerprints, 
                matched_tokens_json, status, evaluated_at, created_at 
         FROM plagiarism_reports WHERE assignment_id = $1 ORDER BY similarity_rate DESC`,
        [assignmentId],
      );
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          reportId: r.report_id,
          assignmentId: r.assignment_id,
          submissionAId: r.submission_a_id,
          submissionBId: r.submission_b_id,
          similarityRate: parseFloat(r.similarity_rate),
          flaggedAsFraud: r.flagged_as_fraud,
          commonFingerprintsCount: parseInt(r.common_fingerprints_count, 10) || 0,
          totalUniqueFingerprints: parseInt(r.total_unique_fingerprints, 10) || 0,
          matchedTokensJson: r.matched_tokens_json,
          status: r.status,
          evaluatedAt: new Date(r.evaluated_at),
          createdAt: new Date(r.created_at),
        }));
      }
    }

    return Array.from(this.records.values())
      .filter((r) => r.assignmentId === assignmentId)
      .sort((a, b) => b.similarityRate - a.similarityRate);
  }

  public async findBySubmission(submissionId: string): Promise<PlagiarismReportRecord[]> {
    if (this.postgres.isAvailable()) {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT report_id, assignment_id, submission_a_id, submission_b_id, similarity_rate, 
                flagged_as_fraud, common_fingerprints_count, total_unique_fingerprints, 
                matched_tokens_json, status, evaluated_at, created_at 
         FROM plagiarism_reports 
         WHERE submission_a_id = $1 OR submission_b_id = $1 
         ORDER BY similarity_rate DESC`,
        [submissionId],
      );
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          reportId: r.report_id,
          assignmentId: r.assignment_id,
          submissionAId: r.submission_a_id,
          submissionBId: r.submission_b_id,
          similarityRate: parseFloat(r.similarity_rate),
          flaggedAsFraud: r.flagged_as_fraud,
          commonFingerprintsCount: parseInt(r.common_fingerprints_count, 10) || 0,
          totalUniqueFingerprints: parseInt(r.total_unique_fingerprints, 10) || 0,
          matchedTokensJson: r.matched_tokens_json,
          status: r.status,
          evaluatedAt: new Date(r.evaluated_at),
          createdAt: new Date(r.created_at),
        }));
      }
    }

    return Array.from(this.records.values())
      .filter((r) => r.submissionAId === submissionId || r.submissionBId === submissionId)
      .sort((a, b) => b.similarityRate - a.similarityRate);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // AST FINGERPRINTS — vân tay Winnowing dùng để đối soát đạo văn
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Lưu vân tay AST/Winnowing của một bài nộp.
   *
   * Idempotent: xoá toàn bộ vân tay cũ của bài nộp rồi ghi lại, nên chạy lại phát
   * hiện đạo văn nhiều lần vẫn cho kết quả nhất quán.
   */
  public async saveFingerprints(
    submissionId: string,
    fingerprints: Fingerprint[],
    filePath?: string,
  ): Promise<number> {
    const list = fingerprints || [];
    if (list.length === 0) {
      return 0;
    }

    const rows: Omit<AstFingerprintRecord, 'createdAt'>[] = list.map((fp, index) => ({
      fingerprintId: `${submissionId}-${index}-${String(fp.hashValue).substring(0, 12)}`,
      submissionId,
      hashValue: fp.hashValue,
      tokenPosition: fp.tokenStart != null ? fp.tokenStart : index,
      astNodeType: 'WINNOWING_KGRAM',
      filePath: filePath || 'main',
      lineStart: fp.lineStart || 1,
      lineEnd: fp.lineEnd || fp.lineStart || 1,
      tokenStart: fp.tokenStart || 0,
      tokenEnd: fp.tokenEnd || 0,
    }));

    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.safeQuery(`DELETE FROM ast_fingerprints WHERE submission_id = $1`, [submissionId]);
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] Không xoá được vân tay cũ: ${err.message}`);
      }
    }

    await this.fingerprintRepo.createBatch(rows);
    this.logger.log(`[PlagiarismRepository] Đã lưu ${rows.length} vân tay AST cho ${submissionId}.`);
    return rows.length;
  }

  public async findFingerprintsBySubmission(submissionId: string): Promise<AstFingerprintRecord[]> {
    return this.fingerprintRepo.findBySubmissionId(submissionId);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PLAGIARISM REPORTS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Insert-or-update a report honouring UNIQUE (submission_a_id, submission_b_id).
   * The pair is canonicalised so the same comparison is never stored twice.
   */
  public async upsertReport(record: PlagiarismReportRecord): Promise<PlagiarismReportRecord> {
    const canonical = this.canonicalize(record);
    const stored: PlagiarismReportRecord = {
      ...canonical,
      evaluatedAt: canonical.evaluatedAt ? new Date(canonical.evaluatedAt) : new Date(),
      createdAt: canonical.createdAt ? new Date(canonical.createdAt) : new Date(),
    };

    const pairKey = `${stored.submissionAId}::${stored.submissionBId}`;
    const existing = Array.from(this.records.values()).find(
      (r) => `${r.submissionAId}::${r.submissionBId}` === pairKey,
    );
    if (existing) {
      stored.reportId = existing.reportId;
      stored.createdAt = existing.createdAt;
    }
    this.records.set(stored.reportId, stored);
    this.persist();

    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.safeQuery(
          `INSERT INTO plagiarism_reports
             (report_id, assignment_id, submission_a_id, submission_b_id, similarity_rate, flagged_as_fraud,
              common_fingerprints_count, total_unique_fingerprints, matched_tokens_json, status, evaluated_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
           ON CONFLICT (submission_a_id, submission_b_id) DO UPDATE SET
             similarity_rate = EXCLUDED.similarity_rate,
             flagged_as_fraud = EXCLUDED.flagged_as_fraud,
             common_fingerprints_count = EXCLUDED.common_fingerprints_count,
             total_unique_fingerprints = EXCLUDED.total_unique_fingerprints,
             matched_tokens_json = EXCLUDED.matched_tokens_json,
             status = EXCLUDED.status,
             evaluated_at = EXCLUDED.evaluated_at`,
          [
            stored.reportId,
            stored.assignmentId || null,
            stored.submissionAId,
            stored.submissionBId,
            stored.similarityRate,
            stored.flaggedAsFraud,
            stored.commonFingerprintsCount,
            stored.totalUniqueFingerprints,
            JSON.stringify(stored.matchedTokensJson || {}),
            stored.status,
            stored.evaluatedAt,
            stored.createdAt,
          ],
        );
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] Lỗi ghi báo cáo đạo văn: ${err.message}`);
      }
    }

    return stored;
  }

  public async findReportsByAssignment(assignmentId: string): Promise<PlagiarismReportRecord[]> {
    return this.findAll({ assignmentId });
  }

  public async findAll(filter?: PlagiarismReportFilter): Promise<PlagiarismReportRecord[]> {
    let result = Array.from(this.records.values());

    if (filter?.assignmentId) {
      result = result.filter((r) => r.assignmentId === filter.assignmentId);
    }
    if (filter?.flaggedOnly) {
      result = result.filter((r) => r.flaggedAsFraud);
    }

    result.sort((a, b) => b.similarityRate - a.similarityRate);

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  public async findReportById(reportId: string): Promise<PlagiarismReportRecord | null> {
    return this.records.get(reportId) || null;
  }

  /** Total number of persisted pairwise reports. */
  public getReportCount(): number {
    return this.records.size;
  }

  public newReportId(): string {
    return `PLG-${randomUUID()}`;
  }

  /**
   * Enforces the canonical pair ordering required by UNIQUE (submission_a_id, submission_b_id).
   * When the lexicographic order is swapped, the matched-token line ranges are swapped too so
   * `lineA` still refers to `submissionAId`.
   */
  private canonicalize(record: PlagiarismReportRecord): PlagiarismReportRecord {
    if (record.submissionAId <= record.submissionBId) {
      return record;
    }

    const tokens = record.matchedTokensJson as any;
    const swapped = tokens && typeof tokens === 'object'
      ? {
          ...tokens,
          submissionAId: record.submissionBId,
          submissionBId: record.submissionAId,
          matchedSegments: Array.isArray(tokens.matchedSegments)
            ? tokens.matchedSegments.map((seg: any) => ({
                ...seg,
                lineRangeA: seg.lineRangeB,
                lineRangeB: seg.lineRangeA,
                tokenRangeA: seg.tokenRangeB,
                tokenRangeB: seg.tokenRangeA,
              }))
            : tokens.matchedSegments,
        }
      : tokens;

    return {
      ...record,
      submissionAId: record.submissionBId,
      submissionBId: record.submissionAId,
      matchedTokensJson: swapped,
    };
  }

  public async deleteReportsBySubmission(submissionId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, r] of this.records.entries()) {
      if (r.submissionAId === submissionId || r.submissionBId === submissionId) {
        this.records.delete(id);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.persist();
    }
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.safeQuery(
          `DELETE FROM plagiarism_reports WHERE submission_a_id = $1 OR submission_b_id = $1`,
          [submissionId],
        );
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] Lỗi xoá reports của ${submissionId}: ${err.message}`);
      }
    }
    return deletedCount;
  }

  public async deleteFingerprintsBySubmission(submissionId: string): Promise<number> {
    if (this.postgres.isAvailable()) {
      try {
        await this.postgres.safeQuery(`DELETE FROM ast_fingerprints WHERE submission_id = $1`, [submissionId]);
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] Lỗi xoá fingerprints của ${submissionId}: ${err.message}`);
      }
    }
    return this.fingerprintRepo.deleteBySubmissionId(submissionId);
  }
}
