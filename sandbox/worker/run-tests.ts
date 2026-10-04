import * as fs from 'fs';
import * as path from 'path';
import { runSandbox } from './index';

async function testHacks() {
    console.log("=== BẮT ĐẦU CHẠY CÁC BÀI TEST TẤN CÔNG SANDBOX ===");

    // 1. Test TLE (Vòng lặp vô hạn)
    console.log("\n--- [Test 1] Chạy thử mã TLE (Vòng lặp vô hạn) ---");
    const tleCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test1_tle.cpp'), 'utf-8');
    const result1 = await runSandbox('cpp', tleCode);
    console.log("Kết quả Test 1:", result1);
    if (result1.time_ms && result1.time_ms >= 2000) {
        console.log("✅ THÀNH CÔNG: Watchdog đã bắt được vòng lặp vô hạn và kill process (TLE).");
    } else {
        console.log("❌ THẤT BẠI: Sandbox không bắt được TLE.");
    }

    // 2. Test MLE (Xin cấp phát 5GB RAM)
    console.log("\n--- [Test 2] Chạy thử mã MLE (Xin cấp phát nhiều RAM) ---");
    const mleCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test2_mle.c'), 'utf-8');
    const result2 = await runSandbox('cpp', mleCode); // Dùng chung compiler C++ (gcc) cho C
    console.log("Kết quả Test 2:", result2);
    if (result2.exitCode === 137) {
        console.log("✅ THÀNH CÔNG: OOM Killer đã hoạt động (exit code 137). RAM được bảo vệ.");
    } else {
        console.log("❌ THẤT BẠI: Sandbox không chặn được cấp phát RAM (MLE).");
    }

    // 3. Test Fork Bomb và Đọc trộm file (Seccomp)
    console.log("\n--- [Test 3] Chạy thử mã Fork Bomb + Đọc trộm file .env ---");
    const fbCode = fs.readFileSync(path.join(__dirname, '../test-hacks/test3_forkbomb.c'), 'utf-8');
    const result3 = await runSandbox('cpp', fbCode);
    console.log("Kết quả Test 3:", result3);
    
    // Nếu output chứa "Bypass thanh cong" thì là toang.
    if (result3.stdout && result3.stdout.includes("Bypass thanh cong")) {
        console.log("❌ THẤT BẠI: Mã độc đã đọc được file hệ thống.");
    } else if (result3.exitCode !== 0) {
         console.log("✅ THÀNH CÔNG: Seccomp đã chặn lệnh fork và file hệ thống thành công.");
    } else {
         console.log("⚠️ CHÚ Ý: Cần kiểm tra kỹ hơn.");
    }

    console.log("\n=== HOÀN TẤT BÀI TEST ===");
}

testHacks().catch(console.error);
