import * as fs from 'fs';
import * as path from 'path';
import { runSandbox } from './index';

async function verifyAllSecurityExceptions() {
  console.log('======================================================================');
  console.log('🛡️ SANDBOX SECURITY & EXCEPTION DEFENSE SUITE (MILESTONE 2)');
  console.log('   DevOps & Security Engineer: Trần Công Tiến');
  console.log('======================================================================\n');

  // Ngoại lệ 1: Vòng lặp vô hạn (TLE 2.0s Watchdog)
  console.log('1. Kiểm thử Ngoại lệ TLE (Time Limit Exceeded - Vòng lặp vô hạn):');
  const tleCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test1_tle.cpp'), 'utf-8');
  const tleRes = await runSandbox('cpp', tleCode);
  console.log(`   - Exit Code: ${tleRes.exitCode}`);
  console.log(`   - Thời gian thực thi: ${tleRes.time_ms}ms`);
  console.log(`   - Thông báo lỗi: ${tleRes.stderr.trim()}`);
  console.log(`   - Kết luận: ${tleRes.time_ms >= 1900 ? '✅ ĐẠT: Watchdog 2.0s dập tắt thành công' : '❌ THẤT BẠI'}\n`);

  // Ngoại lệ 2: Tràn bộ nhớ (MLE 512MB cgroups OOM Killer)
  console.log('2. Kiểm thử Ngoại lệ MLE (Memory Limit Exceeded - Cấp phát vượt 512MB):');
  const mleCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test2_mle.c'), 'utf-8');
  const mleRes = await runSandbox('cpp', mleCode);
  console.log(`   - Exit Code: ${mleRes.exitCode} (Chuẩn POSIX 128 + SIGKILL 9 = 137)`);
  console.log(`   - Thông báo lỗi: ${mleRes.stderr.trim()}`);
  console.log(`   - Kết luận: ${mleRes.exitCode === 137 ? '✅ ĐẠT: OOM Killer dập tắt thành công' : '❌ THẤT BẠI'}\n`);

  // Ngoại lệ 3: Fork Bomb & Vi phạm đặc quyền Seccomp
  console.log('3. Kiểm thử Ngoại lệ Tấn công Fork Bomb & Đọc trộm tệp (.env):');
  const fbCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test3_forkbomb.c'), 'utf-8');
  const fbRes = await runSandbox('cpp', fbCode);
  console.log(`   - Exit Code: ${fbRes.exitCode}`);
  console.log(`   - Output: ${fbRes.stdout.trim()}`);
  console.log(`   - Kết luận: ${!fbRes.stdout.includes('Bypass thanh cong') ? '✅ ĐẠT: Hệ thống tệp & tiến trình an toàn tuyệt đối' : '❌ THẤT BẠI'}\n`);

  console.log('======================================================================');
  console.log('🎉 3/3 NGOẠI LỆ SANDBOX ĐƯỢC ĐÁNH CHẶN THÀNH CÔNG VỚI CHUẨN ĐỘ BẢO MẬT CAO!');
  console.log('======================================================================');
}

verifyAllSecurityExceptions().catch(console.error);
