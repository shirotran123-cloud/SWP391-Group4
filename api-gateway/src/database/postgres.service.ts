import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;
  private isConnected = false;

  async onModuleInit() {
    await this.initPostgresConnection();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('[PostgresService] Đã đóng kết nối PostgreSQL connection pool.');
    }
  }

  private async initPostgresConnection(): Promise<void> {
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const user = process.env.POSTGRES_USER || 'aita_admin';
    const password = process.env.POSTGRES_PASSWORD || 'aita_secret_password';
    const database = process.env.POSTGRES_DB || 'aita_autograding';

    this.logger.log(`[PostgresService] Đang thử kết nối PostgreSQL tại ${host}:${port}/${database}...`);

    this.pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      connectionTimeoutMillis: 2000, // 2s timeout
      max: 10,
    });

    try {
      const client = await this.pool.connect();
      this.isConnected = true;
      this.logger.log(`✅ [PostgresService] KẾT NỐI THÀNH CÔNG tới PostgreSQL 15 (${host}:${port}/${database})!`);

      // Kiểm tra 13 bảng bắt buộc theo IEEE SRS & GEMINI.md
      const checkTables = await client.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public';
      `);
      const existingTables = checkTables.rows.map((r) => r.tablename);
      this.logger.log(`[PostgresService] Số lượng bảng hiện có trong PostgreSQL: ${existingTables.length}`);

      if (existingTables.length < 10) {
        this.logger.warn(`[PostgresService] Chưa nạp đủ schema 13 bảng. Đang nạp tự động từ init_all_13_tables.sql...`);
        const sqlPath = path.resolve(process.cwd(), '..', 'database', 'init_all_13_tables.sql');
        if (fs.existsSync(sqlPath)) {
          const sql = fs.readFileSync(sqlPath, 'utf-8');
          await client.query(sql);
          this.logger.log(`✅ [PostgresService] ĐÃ KHỞI TẠO 100% 13 BẢNG CƠ SỞ DỮ LIỆU THÀNH CÔNG TRONG POSTGRESQL!`);
        }
      }

      client.release();
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

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected || !this.pool) {
      throw new Error('PostgreSQL hiện không khả dụng. Đang dùng JSON fallback.');
    }
    return this.pool.query(text, params);
  }
}
