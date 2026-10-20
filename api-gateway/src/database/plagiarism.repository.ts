import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlagiarismReportRecord } from './plagiarism.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PlagiarismRepository implements OnModuleInit {
  private readonly logger = new Logger(PlagiarismRepository.name);
  private readonly records: Map<string, PlagiarismReportRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
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
}
