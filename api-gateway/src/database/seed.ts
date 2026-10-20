import knex from 'knex';
import knexConfig from './knex.config';
import { seed } from './seeds/01_master_demo_seed';

async function runSeed() {
  const db = knex(knexConfig.development);
  try {
    console.log('🚀 Đang kết nối tới PostgreSQL 15 để nạp dữ liệu demo quy mô lớn...');
    await seed(db);
    console.log('✅ Hoàn tất Seed Database thành công 100%!');
  } catch (err: any) {
    console.error('❌ Lỗi khi seed dữ liệu:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runSeed();
