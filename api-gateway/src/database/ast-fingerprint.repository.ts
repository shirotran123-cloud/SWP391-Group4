import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AstFingerprintRecord } from './ast-fingerprint.entity';
import { PostgresService } from './postgres.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AstFingerprintRepository implements OnModuleInit {
  private readonly logger = new Logger(AstFingerprintRepository.name);
  private readonly records: Map<string, AstFingerprintRecord> = new Map();
  private readonly dataDir: string;
  private readonly dataFile: string;

  constructor(private readonly postgres: PostgresService) {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'api-gateway', 'data'),
      path.resolve(__dirname, '..', '..', 'data'),
    ];
    this.dataDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
    this.dataFile = path.join(this.dataDir, 'ast_fingerprints_store.json');
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
        const parsed: AstFingerprintRecord[] = JSON.parse(raw);
        for (const record of parsed) {
          this.records.set(record.fingerprintId, {
            ...record,
            createdAt: new Date(record.createdAt),
          });
        }
        this.logger.log(`[AstFingerprintRepository] Đã tải ${this.records.size} AST fingerprints từ persistent store.`);
      }
    } catch (err: any) {
      this.logger.warn(`[AstFingerprintRepository] Lỗi tải store: ${err.message}. Khởi tạo rỗng.`);
    }
  }

  private persist(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(recordsArray, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`[AstFingerprintRepository] Lỗi lưu trữ store: ${err.message}`);
    }
  }

  private async syncWithPostgres(): Promise<void> {
    if (!this.postgres.isAvailable()) return;
    try {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT fingerprint_id, submission_id, hash_value, token_position, ast_node_type, 
                file_path, line_start, line_end, token_start, token_end, created_at 
         FROM ast_fingerprints LIMIT 5000`,
      );
      if (rows && rows.length > 0) {
        for (const r of rows) {
          this.records.set(r.fingerprint_id, {
            fingerprintId: r.fingerprint_id,
            submissionId: r.submission_id,
            hashValue: r.hash_value,
            tokenPosition: r.token_position,
            astNodeType: r.ast_node_type,
            filePath: r.file_path,
            lineStart: r.line_start,
            lineEnd: r.line_end,
            tokenStart: r.token_start,
            tokenEnd: r.token_end,
            createdAt: new Date(r.created_at),
          });
        }
        this.logger.log(`✅ [AstFingerprintRepository] Đã nạp ${rows.length} AST fingerprints từ PostgreSQL 15.`);
        this.persist();
      }
    } catch (err: any) {
      this.logger.warn(`[AstFingerprintRepository] Lỗi đồng bộ PostgreSQL: ${err.message}`);
    }
  }

  public async create(record: Omit<AstFingerprintRecord, 'createdAt'>): Promise<AstFingerprintRecord> {
    const now = new Date();
    const newRecord: AstFingerprintRecord = {
      ...record,
      createdAt: now,
    };

    this.records.set(newRecord.fingerprintId, newRecord);

    if (this.postgres.isAvailable()) {
      await this.postgres.safeQuery(
        `INSERT INTO ast_fingerprints (
           fingerprint_id, submission_id, hash_value, token_position, ast_node_type, 
           file_path, line_start, line_end, token_start, token_end, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (fingerprint_id) DO NOTHING`,
        [
          newRecord.fingerprintId,
          newRecord.submissionId,
          newRecord.hashValue,
          newRecord.tokenPosition,
          newRecord.astNodeType || null,
          newRecord.filePath,
          newRecord.lineStart,
          newRecord.lineEnd,
          newRecord.tokenStart,
          newRecord.tokenEnd,
          newRecord.createdAt,
        ],
      );
    }

    return newRecord;
  }

  public async createBatch(records: Omit<AstFingerprintRecord, 'createdAt'>[]): Promise<AstFingerprintRecord[]> {
    const created: AstFingerprintRecord[] = [];
    for (const r of records) {
      created.push(await this.create(r));
    }
    this.persist();
    return created;
  }

  public async findBySubmissionId(submissionId: string): Promise<AstFingerprintRecord[]> {
    if (this.postgres.isAvailable()) {
      const rows = await this.postgres.safeQuery<any>(
        `SELECT fingerprint_id, submission_id, hash_value, token_position, ast_node_type, 
                file_path, line_start, line_end, token_start, token_end, created_at 
         FROM ast_fingerprints WHERE submission_id = $1 ORDER BY token_position ASC`,
        [submissionId],
      );
      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          fingerprintId: r.fingerprint_id,
          submissionId: r.submission_id,
          hashValue: r.hash_value,
          tokenPosition: r.token_position,
          astNodeType: r.ast_node_type,
          filePath: r.file_path,
          lineStart: r.line_start,
          lineEnd: r.line_end,
          tokenStart: r.token_start,
          tokenEnd: r.token_end,
          createdAt: new Date(r.created_at),
        }));
      }
    }

    return Array.from(this.records.values())
      .filter((r) => r.submissionId === submissionId)
      .sort((a, b) => a.tokenPosition - b.tokenPosition);
  }
}
