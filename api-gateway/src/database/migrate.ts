import knex from 'knex';
import knexConfig from './knex.config';

async function run() {
  const action = process.argv[2] || 'latest';
  const db = knex(knexConfig.development);

  try {
    if (action === 'rollback') {
      console.log('🔄 Đang rollback migration phiên bản trước...');
      const [batchNo, log] = await db.migrate.rollback();
      console.log(`✅ Đã rollback thành công Batch ${batchNo}:`, log);
    } else if (action === 'status') {
      console.log('📊 Đang kiểm tra trạng thái migrations...');
      const status = await db.migrate.status();
      console.log(`Số migration chưa chạy: ${status}`);
    } else {
      console.log('🚀 Đang chạy Knex database migrations (latest)...');
      const [batchNo, log] = await db.migrate.latest();
      console.log(`✅ Hoàn tất Migration Batch ${batchNo}:`);
      if (log.length === 0) {
        console.log('   (Tất cả migrations đã được áp dụng, schema đã ở phiên bản mới nhất!)');
      } else {
        log.forEach((m: string) => console.log(`   - ${m}`));
      }
    }
  } catch (err: any) {
    console.error('❌ Lỗi thực thi migration:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
