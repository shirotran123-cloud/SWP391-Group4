import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PostgresService } from './postgres.service';
import { AstFingerprintInput, AstFingerprintRecord } from './ast-fingerprint.entity';
import {
  PlagiarismReportFilter,
  PlagiarismReportRecord,
  PlagiarismReportStatus,
} from './plagiarism-report.entity';

/**
 * Persistence layer for the plagiarism subsystem (SRS Entities 10 & 11).
 *
 * Dual-Mode Architecture: JSON file store (`data/plagiarism_store.json`) is always the
 * source of truth for offline operation, while PostgreSQL is written through opportunistically
 * when `PostgresService.isAvailable()` is true. No method ever throws when Postgres is offline
 * or when the JSON store is unreadable — callers always receive a sane value.
 */
@Injectable()
export class PlagiarismRepository {
  private readonly logger = new Logger(PlagiarismRepository.name);
  private readonly reports: Map<string, PlagiarismReportRecord> = new Map();
  private readonly fingerprintsBySubmission: Map<string, AstFingerprintRecord[]> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'plagiarism_store.json');
    this.initStore();
  }

  private initStore(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed: any = JSON.parse(raw);

        const reportList: PlagiarismReportRecord[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.reports)
            ? parsed.reports
            : [];
        for (const record of reportList) {
          this.reports.set(record.reportId, {
            ...record,
            status: (record.status || 'CLEAN') as PlagiarismReportStatus,
            evaluatedAt: record.evaluatedAt ? new Date(record.evaluatedAt) : new Date(),
            createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
          });
        }

        const fingerprintGroups: Record<string, any[]> = !Array.isArray(parsed) && parsed?.fingerprints ? parsed.fingerprints : {};
        for (const [submissionId, rows] of Object.entries(fingerprintGroups)) {
          this.fingerprintsBySubmission.set(
            submissionId,
            (rows || []).map((r: any) => ({
              ...r,
              createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            })),
          );
        }

        this.logger.log(
          `[PlagiarismRepository] Loaded ${this.reports.size} reports and ${this.fingerprintsBySubmission.size} fingerprint groups from store.`,
        );
      } else {
        this.seedInitialStore();
      }
    } catch (err: any) {
      this.logger.warn(`[PlagiarismRepository] Failed to load store: ${err.message}. Seeding empty store.`);
      this.seedInitialStore();
    }
  }

  /** Seed with an EMPTY list — real reports only ever come from actual detection runs. */
  private seedInitialStore(): void {
    this.reports.clear();
    this.fingerprintsBySubmission.clear();
    this.flushToDisk();
    this.logger.log('[PlagiarismRepository] Initialized empty plagiarism store.');
  }

  private flushToDisk(): void {
    try {
      const fingerprints: Record<string, AstFingerprintRecord[]> = {};
      for (const [submissionId, rows] of this.fingerprintsBySubmission.entries()) {
        fingerprints[submissionId] = rows;
      }
      const payload = {
        reports: Array.from(this.reports.values()),
        fingerprints,
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[PlagiarismRepository] Failed to write to store: ${err.message}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // AST_FINGERPRINTS (Entity 10)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Idempotent fingerprint persistence: replaces every stored row for the submission
   * (JSON map entry + PostgreSQL DELETE-then-INSERT) so re-running detection is safe.
   */
  public async saveFingerprints(
    submissionId: string,
    fingerprints: AstFingerprintInput[],
    filePath?: string,
  ): Promise<number> {
    const rows: AstFingerprintRecord[] = (fingerprints || []).map((fp, index) => ({
      fingerprintId: `${submissionId}-${index}-${fp.hashValue.substring(0, 12)}`,
      submissionId,
      hashValue: fp.hashValue,
      tokenPosition: fp.tokenStart != null ? fp.tokenStart : index,
      astNodeType: 'WINNOWING_KGRAM',
      filePath: filePath || 'main',
      lineStart: fp.lineStart || 1,
      lineEnd: fp.lineEnd || fp.lineStart || 1,
      tokenStart: fp.tokenStart || 0,
      tokenEnd: fp.tokenEnd || 0,
      createdAt: new Date(),
    }));

    if (rows.length === 0) {
      this.fingerprintsBySubmission.set(submissionId, []);
      this.flushToDisk();
      return 0;
    }

    this.fingerprintsBySubmission.set(submissionId, rows);
    this.flushToDisk();

    if (this.postgres.isAvailable()) {
      try {
        // Idempotency: wipe previous fingerprints for this submission, then bulk insert.
        await this.postgres.safeQuery(`DELETE FROM ast_fingerprints WHERE submission_id = $1`, [submissionId]);

        const CHUNK = 50;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const values: any[] = [];
          const placeholders: string[] = [];

          chunk.forEach((row, idx) => {
            const base = idx * 9;
            placeholders.push(
              `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
            );
            values.push(
              row.fingerprintId,
              row.submissionId,
              row.hashValue,
              row.tokenPosition,
              row.astNodeType,
              row.filePath,
              row.lineStart,
              row.lineEnd,
              row.tokenStart,
            );
          });

          await this.postgres.safeQuery(
            `INSERT INTO ast_fingerprints
               (fingerprint_id, submission_id, hash_value, token_position, ast_node_type, file_path, line_start, line_end, token_start)
             VALUES ${placeholders.join(', ')}
             ON CONFLICT (fingerprint_id) DO NOTHING`,
            values,
          );
        }
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] PostgreSQL fingerprint write failed: ${err.message}`);
      }
    } else {
      this.logger.debug(`[PlagiarismRepository] PostgreSQL offline — kept ${rows.length} fingerprints in JSON store only.`);
    }

    return rows.length;
  }

  public async findFingerprintsBySubmission(submissionId: string): Promise<AstFingerprintRecord[]> {
    if (this.postgres.isAvailable()) {
      try {
        const rows = await this.postgres.safeQuery<any>(
          `SELECT fingerprint_id, submission_id, hash_value, token_position, ast_node_type, file_path,
                  line_start, line_end, token_start, token_end, created_at
             FROM ast_fingerprints WHERE submission_id = $1 ORDER BY token_position ASC`,
          [submissionId],
        );
        if (rows.length > 0) {
          return rows.map((r) => ({
            fingerprintId: r.fingerprint_id,
            submissionId: r.submission_id,
            hashValue: r.hash_value,
            tokenPosition: Number(r.token_position) || 0,
            astNodeType: r.ast_node_type,
            filePath: r.file_path,
            lineStart: Number(r.line_start) || 1,
            lineEnd: Number(r.line_end) || 1,
            tokenStart: Number(r.token_start) || 0,
            tokenEnd: Number(r.token_end) || 0,
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
          }));
        }
      } catch (err: any) {
        this.logger.warn(`[PlagiarismRepository] PostgreSQL fingerprint read failed: ${err.message}`);
      }
    }

    return this.fingerprintsBySubmission.get(submissionId) || [];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PLAGIARISM_REPORTS (Entity 11)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Insert-or-update a report honouring UNIQUE (submission_a_id, submission_b_id).
   * Callers MUST pass the canonical ordered pair (submissionAId < submissionBId).
   */
  public async upsertReport(record: PlagiarismReportRecord): Promise<PlagiarismReportRecord> {
    const canonical = this.canonicalize(record);
    const stored: PlagiarismReportRecord = {
      ...canonical,
      evaluatedAt: canonical.evaluatedAt ? new Date(canonical.evaluatedAt) : new Date(),
      createdAt: canonical.createdAt ? new Date(canonical.createdAt) : new Date(),
    };

    // 1. JSON store — keyed by canonical (pairKey) so the pair stays unique.
    const pairKey = `${stored.submissionAId}::${stored.submissionBId}`;
    const existing = Array.from(this.reports.values()).find(
      (r) => `${r.submissionAId}::${r.submissionBId}` === pairKey,
    );
    if (existing) {
      stored.reportId = existing.reportId;
      stored.createdAt = existing.createdAt;
    }
    this.reports.set(stored.reportId, stored);
    this.flushToDisk();

    // 2. PostgreSQL write-through (ON CONFLICT honours the pairwise unique constraint).
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
        this.logger.warn(`[PlagiarismRepository] PostgreSQL report upsert failed: ${err.message}`);
      }
    }

    return stored;
  }

  public async findReportsByAssignment(assignmentId: string): Promise<PlagiarismReportRecord[]> {
    return this.findAll({ assignmentId });
  }

  /** Returns both directions of every pair involving the submission (ordered by similarity desc). */
  public async findReportsBySubmission(submissionId: string): Promise<PlagiarismReportRecord[]> {
    const result = Array.from(this.reports.values()).filter(
      (r) => r.submissionAId === submissionId || r.submissionBId === submissionId,
    );
    result.sort((a, b) => b.similarityRate - a.similarityRate);
    return result;
  }

  public async findAll(filter?: PlagiarismReportFilter): Promise<PlagiarismReportRecord[]> {
    let result = Array.from(this.reports.values());

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
    return this.reports.get(reportId) || null;
  }

  /** Total number of persisted pairwise reports. */
  public getReportCount(): number {
    return this.reports.size;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  public newReportId(): string {
    return `PLG-${randomUUID()}`;
  }

  /**
   * Enforces the canonical pair ordering required by UNIQUE (submission_a_id, submission_b_id).
   * When the lexicographic order is swapped, the matched-token line ranges are swapped too so
   * `lineA` still refers to `submissionAId`.
   */
  private canonicalize(record: PlagiarismReportRecord): PlagiarismReportRecord {
    const a = record.matchedTokensJson || ({} as any);
    if (record.submissionAId <= record.submissionBId) {
      return {
        ...record,
        matchedTokensJson: {
          ...a,
          submissionAId: record.submissionAId,
          submissionBId: record.submissionBId,
        },
      };
    }

    const swappedSegments = (a.matchedSegments || []).map((seg: any) => ({
      ...seg,
      lineRangeA: seg.lineRangeB,
      lineRangeB: seg.lineRangeA,
      tokenRangeA: seg.tokenRangeB,
      tokenRangeB: seg.tokenRangeA,
    }));

    return {
      ...record,
      submissionAId: record.submissionBId,
      submissionBId: record.submissionAId,
      matchedTokensJson: {
        ...a,
        submissionAId: record.submissionBId,
        submissionBId: record.submissionAId,
        totalUniqueFingerprintsA: a.totalUniqueFingerprintsB,
        totalUniqueFingerprintsB: a.totalUniqueFingerprintsA,
        matchedSegments: swappedSegments,
      },
    };
  }
}
