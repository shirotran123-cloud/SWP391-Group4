import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface PostgresDiagnostics {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  poolTotal: number;
  poolIdle: number;
  poolWaiting: number;
}

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;
  private isConnected = false;

  // Cấu hình kết nối được giữ trong field để getDiagnostics() luôn báo cáo được kể cả khi mất kết nối.
  private readonly host: string = process.env.POSTGRES_HOST || 'localhost';
  private readonly port: number = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  private readonly user: string = process.env.POSTGRES_USER || 'aita_admin';
  private readonly password: string = process.env.POSTGRES_PASSWORD || 'aita_secret_password';
  private readonly database: string = process.env.POSTGRES_DB || 'aita_autograding';

  // 13 bảng nghiệp vụ SSOT (GEMINI.md) + 2 bảng hạ tầng bổ trợ.
  private readonly expectedTables: string[] = [
    'roles',
    'users',
    'classes',
    'class_members',
    'assignments',
    'test_cases',
    'submissions',
    'submission_details',
    'ai_review_results',
    'ast_fingerprints',
    'plagiarism_reports',
    'appeals',
    'teamwork_metrics',
    'dead_letter_jobs',
    'ai_prompt_templates',
  ];

  async onModuleInit() {
    await this.initPostgresConnection();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('[PostgresService] Đã đóng kết nối PostgreSQL connection pool.');
    }
  }

  /**
   * Dò đường dẫn file schema theo nhiều ứng viên, dùng đường dẫn đầu tiên tồn tại.
   * Cần thiết vì cwd có thể là api-gateway, repo root, hoặc thư mục dist khi chạy production.
   */
  private resolveSchemaPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'database', 'init_all_13_tables.sql'),
      path.resolve(process.cwd(), '..', 'database', 'init_all_13_tables.sql'),
      path.resolve(__dirname, '..', '..', '..', 'database', 'init_all_13_tables.sql'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.logger.log(`[PostgresService] Đã tìm thấy file schema tại: ${candidate}`);
        return candidate;
      }
    }

    this.logger.error(
      `[PostgresService] KHÔNG tìm thấy init_all_13_tables.sql. Đã thử ${candidates.length} đường dẫn: ${candidates.join(' | ')}`,
    );
    return null;
  }

  /**
   * Chạy toàn bộ script schema trong MỘT transaction trên client riêng biệt.
   * Mọi câu lệnh đều là CREATE TABLE IF NOT EXISTS / INSERT ... ON CONFLICT DO NOTHING nên idempotent,
   * vì vậy chạy lại nhiều lần là an toàn và không bao giờ để lại schema dang dở (partial schema).
   */
  private async bootstrapSchema(client: PoolClient): Promise<boolean> {
    const sqlPath = this.resolveSchemaPath();
    if (!sqlPath) {
      return false;
    }

    try {
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      await client.query('BEGIN');
      this.logger.log('[PostgresService] Bắt đầu transaction nạp schema (BEGIN)...');
      await client.query(sql);
      await client.query('COMMIT');
      this.logger.log(`✅ [PostgresService] ĐÃ COMMIT toàn bộ schema từ ${sqlPath}.`);
      return true;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
        this.logger.error(`❌ [PostgresService] Bootstrap ROLLBACK 100%: ${err.message}`);
      } catch (rollbackErr: any) {
        this.logger.error(`❌ [PostgresService] ROLLBACK thất bại: ${rollbackErr.message}`);
      }
      return false;
    }
  }

  private async listPublicTables(client: PoolClient): Promise<string[]> {
    try {
      const res = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`);
      return res.rows.map((r) => r.tablename);
    } catch (err: any) {
      this.logger.warn(`[PostgresService] Không đọc được danh sách bảng từ pg_tables: ${err.message}`);
      return [];
    }
  }

  private reportMissingTables(existingTables: string[]): void {
    const missing = this.expectedTables.filter((t) => !existingTables.includes(t));
    if (missing.length > 0) {
      this.logger.warn(
        `⚠️ [PostgresService] Còn thiếu ${missing.length}/${this.expectedTables.length} bảng mong đợi: ${missing.join(', ')}`,
      );
    }
  }

  private async initPostgresConnection(): Promise<void> {
    const { host, port, database } = this;

    this.logger.log(`[PostgresService] Đang thử kết nối PostgreSQL tại ${host}:${port}/${database}...`);

    this.pool = new Pool({
      host,
      port,
      user: this.user,
      password: this.password,
      database,
      connectionTimeoutMillis: 2000, // 2s timeout
      max: 10,
    });

    try {
      const client = await this.pool.connect();
      this.isConnected = true;
      this.logger.log(`✅ [PostgresService] KẾT NỐI THÀNH CÔNG tới PostgreSQL 15 (${host}:${port}/${database})!`);

      try {
        // Kiểm tra số bảng hiện có so với 15 bảng mong đợi (13 SSOT + 2 hạ tầng)
        let existingTables = await this.listPublicTables(client);
        this.logger.log(`[PostgresService] Số lượng bảng hiện có trong PostgreSQL: ${existingTables.length}/${this.expectedTables.length}`);

        // Bootstrap khi số bảng không đạt 15, HOẶC khi thiếu bất kỳ bảng mong đợi nào
        // (trường hợp DB đã có bảng khác nhưng vẫn thiếu bảng của AITA).
        const missingBefore = this.expectedTables.filter((t) => !existingTables.includes(t));
        if (existingTables.length < this.expectedTables.length || missingBefore.length > 0) {
          this.logger.warn(
            `[PostgresService] Chưa nạp đủ schema ${this.expectedTables.length} bảng ` +
            `(hiện có ${existingTables.length}, thiếu ${missingBefore.length}). ` +
            `Đang nạp tự động từ init_all_13_tables.sql...`,
          );
          await this.bootstrapSchema(client);
        }

        // VERIFY sau bootstrap: truy vấn lại pg_tables và log số bảng thực tế.
        existingTables = await this.listPublicTables(client);
        this.logger.log(`[PostgresService] XÁC MINH SAU BOOTSTRAP: PostgreSQL hiện có ${existingTables.length} bảng: ${existingTables.join(', ')}`);
        this.reportMissingTables(existingTables);
      } finally {
        client.release();
      }
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(
        `⚠️ [PostgresService] Không thể kết nối PostgreSQL (${err.message}). ` +
        `Kích hoạt Dual-Mode Architecture: Chuyển sang Embedded JSON File Store (Không làm nghẽn tiến trình!).`,
      );
    }
  }

  public isAvailable(): boolean {
    return this.isConnected && this.pool !== null;
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  /**
   * Chẩn đoán kết nối phục vụ health-check / rubric evidence. Luôn trả về giá trị an toàn khi mất kết nối.
   */
  public getDiagnostics(): PostgresDiagnostics {
    if (!this.pool) {
      return {
        connected: false,
        host: this.host,
        port: this.port,
        database: this.database,
        poolTotal: 0,
        poolIdle: 0,
        poolWaiting: 0,
      };
    }

    return {
      connected: this.isAvailable(),
      host: this.host,
      port: this.port,
      database: this.database,
      poolTotal: this.pool.totalCount || 0,
      poolIdle: this.pool.idleCount || 0,
      poolWaiting: this.pool.waitingCount || 0,
    };
  }

  /**
   * Ping nhẹ: trả về false thay vì ném exception khi PostgreSQL không khả dụng.
   */
  public async ping(): Promise<boolean> {
    if (!this.isConnected || !this.pool) {
      return false;
    }
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (err: any) {
      this.logger.warn(`[PostgresService:ping] Ping thất bại: ${err.message}`);
      return false;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected || !this.pool) {
      throw new Error('PostgreSQL hiện không khả dụng. Đang dùng JSON fallback.');
    }
    return this.pool.query(text, params);
  }

  public async safeQuery<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected || !this.pool) {
      return [];
    }
    try {
      const res = await this.pool.query(text, params);
      return (res.rows || []) as T[];
    } catch (err: any) {
      this.logger.warn(`[PostgresService:safeQuery] Query error (${err.message}). Text: ${text.substring(0, 80)}`);
      return [];
    }
  }
}
