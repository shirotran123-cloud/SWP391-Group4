import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiReviewRecord } from './ai-review.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiReviewRepository implements OnModuleInit {
  private readonly logger = new Logger(AiReviewRepository.name);
  private readonly records: Map<string, AiReviewRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'ai_reviews_store.json');
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
        const parsed: AiReviewRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.reviewId, {
            ...record,
            evaluatedAt: new Date(record.evaluatedAt),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        }
        this.logger.log(`[AiReviewRepository] Đã tải ${this.records.size} kết quả AI review từ persistent store.`);
      }
    } catch (err: any) {
      this.logger.warn(`[AiReviewRepository] Lỗi tải store: ${err.message}. Khởi tạo rỗng.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[AiReviewRepository] Lỗi lưu trữ store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT review_id, submission_id, clean_code_score, solid_score, code_smells_count, 
                feedback_json, compiler_explanation, model_used, token_usage, evaluated_at, created_at, updated_at
         FROM ai_review_results ORDER BY evaluated_at DESC`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.review_id, {
            reviewId: r.review_id,
            submissionId: r.submission_id,
            cleanCodeScore: parseFloat(r.clean_code_score),
            solidScore: parseFloat(r.solid_score),
            codeSmellsCount: parseInt(r.code_smells_count, 10) || 0,
            feedbackJson: r.feedback_json,
            compilerExplanation: r.compiler_explanation,
            modelUsed: r.model_used,
            tokenUsage: r.token_usage,
            evaluatedAt: new Date(r.evaluated_at),
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          });
        }
        this.logger.log(`✅ [AiReviewRepository] Đã đồng bộ ${rows.length} kết quả GenAI reviews từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[AiReviewRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  public async create(record: Omit<AiReviewRecord, 'createdAt' | 'updatedAt'>): Promise<AiReviewRecord> {
    const now = new Date();
    const newRecord: AiReviewRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(newRecord.reviewId, newRecord);
    this.persist();

    if (this.postgres.isAvailable()) {
      await this.postgres.safeQuery(
        `INSERT INTO ai_review_results (
           review_id, submission_id, clean_code_score, solid_score, code_smells_count, 
           feedback_json, compiler_explanation, model_used, token_usage, evaluated_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (review_id) DO UPDATE SET
           clean_code_score = EXCLUDED.clean_code_score,
           solid_score = EXCLUDED.solid_score,
           code_smells_count = EXCLUDED.code_smells_count,
           feedback_json = EXCLUDED.feedback_json,
           compiler_explanation = EXCLUDED.compiler_explanation,
           token_usage = EXCLUDED.token_usage,
           updated_at = NOW()`,
        [
          newRecord.reviewId,
          newRecord.submissionId,
          newRecord.cleanCodeScore,
          newRecord.solidScore,
          newRecord.codeSmellsCount,
          JSON.stringify(newRecord.feedbackJson || []),
          newRecord.compilerExplanation || null,
          newRecord.modelUsed,
          newRecord.tokenUsage ? JSON.stringify(newRecord.tokenUsage) : null,
          newRecord.evaluatedAt,
          newRecord.createdAt,
          newRecord.updatedAt,
        ],
      );
    }

    return newRecord;
  }

  public async findBySubmissionId(submissionId: string): Promise<AiReviewRecord | null> {
    if (this.postgres.isAvailable()) {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT review_id, submission_id, clean_code_score, solid_score, code_smells_count, 
                feedback_json, compiler_explanation, model_used, token_usage, evaluated_at, created_at, updated_at
         FROM ai_review_results WHERE submission_id = $1 LIMIT 1`,
        [submissionId],
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        return {
          reviewId: r.review_id,
          submissionId: r.submission_id,
          cleanCodeScore: parseFloat(r.clean_code_score),
          solidScore: parseFloat(r.solid_score),
          codeSmellsCount: parseInt(r.code_smells_count, 10) || 0,
          feedbackJson: r.feedback_json,
          compilerExplanation: r.compiler_explanation,
          modelUsed: r.model_used,
          tokenUsage: r.token_usage,
          evaluatedAt: new Date(r.evaluated_at),
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at),
        };
      }
    }

    for (const r of this.records.values()) {
      if (r.submissionId === submissionId) {
        return r;
      }
    }
    return null;
  }
}
