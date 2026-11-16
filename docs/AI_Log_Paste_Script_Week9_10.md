# BẢN COPY-PASTE — TIN NHẮN THẬT AI LOG TUẦN 9 & TUẦN 10 (EVIDENCE SCRIPT)

> Toàn bộ nội dung dưới đây là kịch bản các câu lệnh và tin nhắn nhóm đã yêu cầu AI thực hiện trong **Tuần 9 (Kiểm thử chịu tải BullMQ, Nâng Unit Test Coverage >80%, Kiểm thử tích hợp 4 ngôn ngữ, Cấu hình Vercel + Ngrok)** và **Tuần 10 (Đồng bộ Atomic Testcases PostgreSQL 15, Chốt chặn điểm 0 khi lỗi biên dịch, Bảo mật GitHub Push Protection & Tổng duyệt Final Defense)**.

---

## PHẦN 1: TUẦN 9 (WEEK 9)

### SESSION 71 — KIỂM THỬ CHỊU TẢI 100 CONCURRENT SUBMISSIONS & REDIS BULLMQ (Tuần 9)
*Đối chiếu commit:* `38cbe5c`, `1404ece` | *Mã Evidence Excel:* `Group4_Session43_Stress_Week9`

**Tin 1 — paste:**
```
viết script stress test bắn 100 bài nộp cùng lúc vào api-gateway và hàng đợi Redis BullMQ để kiểm tra SLA < 100ms, giải thích chi tiết các thông số p50, p95, p99 và tối ưu nếu bị nghẽn I/O
```

📸 **Chụp khi:** AI phản hồi kết quả chạy `node tools/stress-test-queue.mjs` đạt `100 / 100 accepted (2xx)`, `wall clock: 0.16 s`, `p50: 7.2 ms`, `p95: 14.6 ms (< 100 ms SLA)` và giải thích 3 pha kiểm thử.  
📁 **Tên ảnh:** `Session71_StressTest_100Concurrent_Week9.png`

---

### SESSION 72 — ĐO VÀ NÂNG ĐỘ BAO PHỦ UNIT TEST COVERAGE > 80% (Tuần 9)
*Đối chiếu commit:* `38cbe5c` | *Mã Evidence Excel:* `Group4_Session47_LintCov_Week9`

**Tin 2 — paste:**
```
chạy đo Unit Test Coverage bằng c8 cho genai-hub, hiện tại độ bao phủ nhánh (Branch Coverage) mới đạt 79.12% bị màu vàng, hãy bổ sung test để cả 4 cột Stmts, Branch, Funcs, Lines đều xanh trên 80%
```

📸 **Chụp khi:** AI bổ sung test vào `genai-hub/test/cover-80.ts` và in bảng kết quả `c8` đạt `94.21% Stmts | 81.27% Branch | 95.38% Funcs | 94.21% Lines` (tất cả 4 cột đều màu xanh > 80%).  
📁 **Tên ảnh:** `Session72_UnitTestCoverage_81Branch_Week9.png`

---

### SESSION 73 — KIỂM THỬ TÍCH HỢP 4 NGÔN NGỮ & TRIỂN KHAI VERCEL + NGROK (Tuần 9)
*Đối chiếu commit:* `ff7d6cf`, `e0ba5ff`, `50e7a05`, `38cbe5c` | *Mã Evidence Excel:* `Group4_Session44_Latency_Week9`, `Group4_Session48_ArchReview_Week9`

**Tin 3 — paste:**
```
chạy kiểm thử tích hợp toàn diện tạo sinh viên, tạo bài tập và nộp bài bằng 4 ngôn ngữ Java, Python, C++, C#, đồng thời cấu hình deploy frontend lên Vercel kết nối về backend qua Ngrok
```

📸 **Chụp khi:** AI hiển thị bảng kết quả chạy `npx ts-node test/test-multi-lang-flow.ts` chấm thành công 4 ngôn ngữ (`Java 17`, `Python 3.11`, `C++17`, `C# .NET 8.0`) với độ trễ tiếp nhận `9ms - 53ms` và xác nhận cấu hình `vercel.json` + `ngrok-fetch.ts`.  
📁 **Tên ảnh:** `Session73_MultiLang_VercelNgrok_Week9.png`

---

## PHẦN 2: TUẦN 10 (WEEK 10)

### SESSION 74 — SỬA SEED POSTGRESQL 15 & ĐỒNG BỘ ATOMIC TESTCASES (Tuần 10)
*Đối chiếu commit:* `38cbe5c`, `6d25320` | *Mã Evidence Excel:* `Group4_Session49_Manual_Week10`, `Group4_Session51_Cleanse_Week10`

**Tin 4 — paste:**
```
sửa lỗi khi chạy npm run db:seed bị vướng khóa ngoại classes_lecturer_id_fkey trên PostgreSQL 15 và đồng bộ cập nhật testcase nguyên tử (atomic replace) để giảng viên sửa testcase không bị trùng lặp
```

📸 **Chụp khi:** AI cập nhật `01_master_demo_seed.ts`, `replace-test-cases.dto.ts`, `test-case.repository.ts` và chạy `npm run db:seed` báo thành công nạp hơn 800 bản ghi mẫu vào PostgreSQL 15.  
📁 **Tên ảnh:** `Session74_AtomicTestCases_DbSeed_Week10.png`

---

### SESSION 75 — SIẾT CHẶT CHẤM ĐIỂM 0 KHI LỖI BIÊN DỊCH & CẬP NHẬT AST PLAGIARISM (Tuần 10)
*Đối chiếu commit:* `c127af7`, `6d25320`, `38110fc` | *Mã Evidence Excel:* `Group4_Session50_Regression_Week10`

**Tin 5 — paste:**
```
nâng cấp bộ chuẩn hóa AST đạo văn trên cả 3 phân hệ, sửa lỗi hiển thị biểu đồ Radar SOLID bị cắt chữ ở trục D và đảm bảo khi bài nộp lỗi biên dịch hoặc sai testcase thì điểm phải về 0
```

📸 **Chụp khi:** AI cập nhật `ast-normalizer.ts`, `plagiarism-engine.ts`, `grading-worker.consumer.ts`, `SolidRadarChart.tsx` và chạy `npm run build` thành công 0 lỗi trên cả `frontend` và `api-gateway`.  
📁 **Tên ảnh:** `Session75_ASTEngine_ZeroScoreGuard_Week10.png`

---

### SESSION 76 — BẢO MẬT GITHUB PUSH PROTECTION & TỔNG DUYỆT BẢO VỆ CUỐI KỲ (Tuần 10)
*Đối chiếu commit:* `38cbe5c`, `6d25320` | *Mã Evidence Excel:* `Group4_Session52_Demo_Week10`, `Group4_Session54_Retro_Week10`

**Tin 6 — paste:**
```
nhận xét và đồng bộ lại số liệu giữa bài báo IEEE 7 trang với slide thuyết trình aita_final_defense.pptx, sau đó xử lý lỗi GitHub Push Protection chặn secret để push toàn bộ code hoàn thiện lên nhánh main
```

📸 **Chụp khi:** AI chuẩn hóa công thức Slide 8 (`TC1 3.5đ + TC2 3.5đ + Clean Code 2.0đ + SOLID 1.0đ = 10.0đ`), chuyển API Key vào `.env` và push thành công lên `origin/main`.  
📁 **Tên ảnh:** `Session76_FinalDefense_GitPush_Week10.png`

