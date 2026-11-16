# KỊCH BẢN CHAT & BÁO CÁO SỬ DỤNG AI — TUẦN 9 & TUẦN 10 (AI LOG WEEK 9 & WEEK 10)
**Dự án:** AITA-Intelligent (Hệ thống Chấm Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động)  
**Khóa học:** SWP391 - Đồ Án Phát Triển Phần Mềm (Chuẩn RBL 10 Tuần)  
**Đơn vị:** Bộ môn Kỹ thuật Phần mềm (Software Engineering) — Đại học FPT Quy Nhơn  
**Nhóm thực hiện:** Group 4 (Đinh Thành Trung, Trần Công Tiến, Nguyễn Hoàng Vinh, Văn Thái Trung, Trần Thanh Nguyên)

---

## I. BẢNG NHẬT KÝ SỬ DỤNG AI TUẦN 9 (ĐỒNG BỘ 100% VỚI SHEET `Week 9` TRONG EXCEL)

Bảng dưới đây khớp toàn bộ 10 cột chuẩn của Sheet `Week 9` trong [`docs/SWP391_AI_Usage_Report_Group4.xlsx`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/docs/SWP391_AI_Usage_Report_Group4.xlsx):

| No. | SDLC Phase | Task / Activity | AI Tool Used | AI Output | Student’s Validation / Modification | Evidence / Link | Quantitative Measure | Value Added (1-5) | Risks / Limitations Observed |
|:---:|:---|:---|:---:|:---|:---|:---|:---|:---:|:---|
| **1** | Testing | Queue Stress Probe (100 Concurrent Submissions & Redis BullMQ) | Antigravity / Codex | Scripted `tools/stress-test-queue.mjs` firing 100 concurrent multipart `.zip` uploads & verifying Redis BullMQ state | Optimized `SubmissionRepository.save()` with debounced async disk flush so event loop is not blocked under 100 concurrent writes | `Group4_Session43_Stress_Week9` (`38cbe5c`, `1404ece`) | 100/100 accepted (202), wall clock 0.16s, $p_{50}=7.2\text{ms}$, $p_{95}=14.6\text{ms}$ (<100ms SLA) | **5** | Synchronous `fs.writeFileSync` in repo initially spiked latency; replaced with debounced async flush |
| **2** | Implementation | Multi-Language E2E Grading Flow & SLA Verification (<200ms) | Gemini / Antigravity | Built E2E test runner `test-multi-lang-flow.ts` testing student creation, assignment + testcases, and 4 languages (Java 17, Python 3.11, C++17, C# .NET 8) | Added `mono:latest` C# profile in `docker-runner.ts` and verified both Docker Seccomp & Resilient Circuit Breaker modes | `Group4_Session44_Latency_Week9` (`38cbe5c`) | 4/4 languages graded (9.8/10), enqueue latency 9ms–53ms (<200ms SLA) | **5** | Without Docker Desktop on 8GB RAM laptops, system falls back to static Circuit Breaker; documented dual-mode clearly |
| **3** | Reporting | IEEE Paper Experiment Table & Statistical Verification (10 Pairs) | Claude / Gemini | Tabulated 10 adversarial obfuscation pairs, Accuracy 90.00%, Precision 100%, Recall 88.89%, 12.0ms runtime on 947 LOC | Re-ran `run-ast-benchmark.ts`; explicitly justified $\tau=70.0\%$ safety margin ($18.03\%$ above P10 MergeSort vs QuickSort $51.97\%$) | `Group4_Session45_PaperExp_Week9` (`aea8b61`) | 10 pairs, 4 metrics, 12.0ms latency (16.6x faster than 200ms SLA) | **5** | Pair 09 compound obfuscation ($54.07\%$) evades $\tau=70\%$ flag but is caught in Suspected band ($40\%-70\%$) |
| **4** | Reporting | IEEE Paper Final Formatting & Defense Slide Synchronization | Antigravity | Audited 7-page IEEE PDF & 12-slide `aita_final_defense.pptx` for formula & author consistency | Updated Slide 8 formula from `4.0đ + 3.0đ` to equal testcase distribution `3.5đ + 3.5đ = 7.0đ` to match `grading-core.ts` | `Group4_Session46_PaperWrite_Week9` (`5268143`, `543e642`) | 7 pages IEEE PDF, 12 slides PPTX 100% synced with live codebase | **5** | Slide 8 previously showed legacy `4.0+3.0` testcase weights; corrected to match dynamic $7.0/N$ code |
| **5** | Testing | Unit Test Coverage Gate ($\ge 80\%$ across all 4 c8 metrics) | Antigravity | Generated targeted branch coverage suite `genai-hub/test/cover-80.ts` covering error paths, key rotation, and AST edge cases | Ran `npx c8` after merging upstream changes; raised Branch Coverage from `79.12%` (yellow) to `81.27%` (green) | `Group4_Session47_LintCov_Week9` (`38cbe5c`) | Stmts: 94.21%, Branch: 81.27%, Funcs: 95.38%, Lines: 94.21% (All $\ge 80\%$) | **5** | Initial merge dropped branch coverage to 79.12%; added explicit error-branch tests to exceed 80% gate |
| **6** | Design | Cloud Deployment Architecture (Vercel Frontend + Ngrok Tunnel) | Claude / Antigravity | Configured root `vercel.json`, `ngrok-fetch.ts` interceptor, and automated tunnel scripts in `start-services.bat` | Removed Windows-only `@rolldown/binding-win32-x64-msvc` dependency that caused `EBADPLATFORM` on Vercel Linux build containers | `Group4_Session48_ArchReview_Week9` (`ff7d6cf`, `e0ba5ff`, `50e7a05`) | Vercel Linux build green; automatic `ngrok-skip-browser-warning` header injected | **4** | Ngrok free tier rotates public URLs on restart; added script auto-detection for live defense demos |

---

## II. BẢNG NHẬT KÝ SỬ DỤNG AI TUẦN 10 (ĐỒNG BỘ 100% VỚI SHEET `Week 10` TRONG EXCEL)

Bảng dưới đây khớp toàn bộ 10 cột chuẩn của Sheet `Week 10` trong [`docs/SWP391_AI_Usage_Report_Group4.xlsx`](file:///d:/Main/ky5/SWP391/Project/SWP391_AI_Usage_Report_Group4.xlsx):

| No. | SDLC Phase | Task / Activity | AI Tool Used | AI Output | Student’s Validation / Modification | Evidence / Link | Quantitative Measure | Value Added (1-5) | Risks / Limitations Observed |
|:---:|:---|:---|:---:|:---|:---|:---|:---|:---:|:---|
| **1** | Implementation | Atomic Testcase Replacement & PostgreSQL SSOT Sync | Antigravity / Claude | Implemented `ReplaceTestCasesDto`, atomic transaction replacement in `test-case.repository.ts`, and fail-loud worker guard | Verified lecturer testcase edits immediately persist to PostgreSQL 15 and reflect in student submissions without stale cache | `Group4_Session49_Manual_Week10` (`6d25320`) | 100% atomic DB sync; 0 orphan/duplicate testcases on update | **5** | Previously, updating testcases appended duplicates on retry; replaced with transactional delete-and-insert |
| **2** | Testing | AST Plagiarism Engine Calibration & Zero-Score Compile Guard | Codex / Antigravity | Enhanced `ast-normalizer.ts` and `plagiarism-engine.ts` across all 3 packages; enforced `0.0` testcase score on compile/mismatch errors | Audited `grading-worker.consumer.ts` and `LiveGradingModal.tsx` so failed/compile-error submissions never receive fallback points | `Group4_Session50_Regression_Week10` (`c127af7`, `6d25320`) | 26 files updated; `frontend` & `api-gateway` builds 100% green | **5** | Lenient fallback previously awarded partial points on malformed code; tightened to strict 0-score guard |
| **3** | Implementation | Master Seed Schema Migration & GitHub Push Protection Compliance | Antigravity | Added idempotent `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` guards in `01_master_demo_seed.ts` & moved API keys to `.env` | Fixed `classes_lecturer_id_fkey` and missing column errors on existing PostgreSQL 15 schemas; passed GitHub Secret Scanning (`GH013`) | `Group4_Session51_Cleanse_Week10` (`38cbe5c`) | 800+ demo records seeded in 1 command; 0 hardcoded secrets in Git history | **5** | GitHub Push Protection blocked hardcoded GCP key in history; squashed & moved key to `.gitignore`d `.env` |
| **4** | Deployment | Full-System Defense Rehearsal (Seed + Gateway + GenAI Hub + UI) | Gemini / Antigravity | Scripted end-to-end defense startup: PostgreSQL 15 + Redis + `api-gateway` (:3000) + `genai-hub` (:3001) + `frontend` (:5173) | Verified `SolidRadarChart.tsx` label padding on D-axis, professional `Footer.tsx`, and live AI code review via port 3001 | `Group4_Session52_Demo_Week10` (`38110fc`, `5268143`) | 3 services UP, `/health` 200 OK, 0 UI label clipping | **5** | Long label on D-axis (`Dependency Inversion`) was clipped on smaller screens; added SVG word-wrap & padding |
| **5** | Reporting | AI Usage Log Completion (Weeks 1–10) & Traceability Audit | Antigravity | Compiled complete 10-week AI Usage Report tables, commit hash mappings, and reproducible evidence scripts | Cross-checked all session IDs (`Session 01` – `Session 76`), commit hashes, and quantitative DoD metrics against repository history | `Group4_Session53_Report_Week10` (`aea8b61`, `6d25320`) | 10/10 Week sheets completed; 100% DoD & SRS rules traced | **5** | Ensured every AI output column includes explicit human validation and measured defect correction |
| **6** | Project Management | Final Retrospective, Handover & Production Readiness Sign-off | Claude / Antigravity | Summarized 10-week RBL milestones, two-tier AST+TED roadmap, and team contribution analytics (`UC-12`) | Finalized presentation roles for all 5 members (15-min defense + Q&A playbook) and verified clean `git status` on `main` | `Group4_Session54_Retro_Week10` (`6d25320`) | 5/5 subsystems verified; all unit, stress, and E2E suites green | **4** | Two-tier asynchronous TED refinement remains future work for borderline ($40\%-70\%$) cluster re-ranking |

---

## III. CHI TIẾT CÁC PHIÊN LÀM VIỆC THỰC TẾ & COMMIT HASH ĐỐI CHIẾU (TUẦN 9 & TUẦN 10)

### PHIÊN 1 (Tuần 9): KIỂM THỬ CHỊU TẢI 100 BÀI NỘP ĐỒNG THỜI & TỐI ƯU BULLMQ SLA (Session 71 / Session 43)
* **Đối chiếu Commit GitHub:** `38cbe5c`, `1404ece`
* **SDLC Phase:** Performance Testing & Optimization

**Sinh viên hỏi / Yêu cầu:**
> viết script stress test bắn 100 bài nộp cùng lúc vào api-gateway và hàng đợi Redis BullMQ để kiểm tra SLA < 100ms, giải thích chi tiết các thông số p50, p95, p99 và tối ưu nếu bị nghẽn I/O

**AI phản hồi:**
1. Xây dựng công cụ kiểm thử tải [`tools/stress-test-queue.mjs`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/tools/stress-test-queue.mjs) gồm 3 pha:
   - **Phase 0 (Uncontended Baseline):** Đo độ trễ khi hệ thống rảnh.
   - **Phase 1 (100 Concurrent Requests):** Bắn đồng thời 100 gói `.zip` qua `POST /api/v1/submissions`.
   - **Phase 2 (Redis BullMQ Verification):** Kiểm tra trạng thái hàng đợi Redis (`waiting`, `active`, `failed`, `dead-letter`).
2. Tối ưu hóa [`api-gateway/src/database/submission.repository.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/src/database/submission.repository.ts): Chuyển thao tác ghi file JSON dự phòng từ đồng bộ (`fs.writeFileSync`) sang cơ chế **Debounced Async Flush** để không làm nghẽn Event Loop khi nhận 100 request cùng lúc.

**Sinh viên kiểm chứng & điều chỉnh:**
* Chạy thực tế lệnh `node tools/stress-test-queue.mjs` đối diện với `api-gateway` và Redis thật:
  - **Accepted (2xx):** `100 / 100` (Tỷ lệ thành công 100%, 0 lỗi HTTP)
  - **Tổng thời gian (Wall clock):** `0.16 giây`
  - **Độ trễ tiếp nhận:** Median $p_{50} = 7.2\text{ ms}$, $p_{95} = 14.6\text{ ms}$, $p_{99} = 17.1\text{ ms}$ (Nhanh gấp **6.8 lần** yêu cầu SLA $< 100\text{ ms}$).

---

### PHIÊN 2 (Tuần 9): NÂNG ĐỘ BAO PHỦ UNIT TEST LÊN > 80% TẤT CẢ CÁC CỘT (Session 72 / Session 47)
* **Đối chiếu Commit GitHub:** `38cbe5c`
* **SDLC Phase:** Quality Assurance & Unit Testing

**Sinh viên hỏi / Yêu cầu:**
> chạy đo Unit Test Coverage bằng c8 cho genai-hub, hiện tại độ bao phủ nhánh (Branch Coverage) mới đạt 79.12% bị màu vàng, hãy bổ sung test để cả 4 cột Stmts, Branch, Funcs, Lines đều xanh trên 80%

**AI phản hồi:**
* Phân tích báo cáo `c8` và xác định các nhánh `if/else`, `catch` chưa được kích hoạt trong `code-reviewer.service.ts`, `compiler-explainer.service.ts`, `exam-generator.service.ts` và `key-rotator.service.ts`.
* Bổ sung các ca kiểm thử nhánh lỗi và biên vào [`genai-hub/test/cover-80.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/genai-hub/test/cover-80.ts).

**Sinh viên kiểm chứng & điều chỉnh:**
* Chạy lại lệnh đo `npx c8`:
  - **% Stmts:** `94.21%` (Xanh)
  - **% Branch:** `81.27%` (Tăng từ `79.12%` lên `81.27%` — Xanh)
  - **% Funcs:** `95.38%` (Xanh)
  - **% Lines:** `94.21%` (Xanh)
* Đạt chuẩn **Definition of Done (DoD $\ge 80\%$)** trên toàn bộ 4 chỉ số.

---

### PHIÊN 3 (Tuần 9): KIỂM THỬ TÍCH HỢP 4 NGÔN NGỮ & TRIỂN KHAI VERCEL + NGROK (Session 73 / Session 44 & 48)
* **Đối chiếu Commit GitHub:** `ff7d6cf`, `e0ba5ff`, `50e7a05`, `38cbe5c`
* **SDLC Phase:** Integration Testing & Cloud Deployment

**Sinh viên hỏi / Yêu cầu:**
> chạy kiểm thử tích hợp toàn diện tạo sinh viên, tạo bài tập và nộp bài bằng 4 ngôn ngữ Java, Python, C++, C#, đồng thời cấu hình deploy frontend lên Vercel kết nối về backend qua Ngrok

**AI phản hồi:**
1. Thực thi [`api-gateway/test/test-multi-lang-flow.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/test/test-multi-lang-flow.ts): Kiểm증 trọn vẹn chu trình từ tạo sinh viên (`STU-MULTI`), tạo đề thi 2 testcases (`3.5đ x 2 = 7.0đ`), đến nộp 4 file `.zip` (Java 17, Python 3.11, C++17, C# .NET 8.0) qua BullMQ.
2. Bổ sung [`vercel.json`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/vercel.json), [`frontend/src/config/ngrok-fetch.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/frontend/src/config/ngrok-fetch.ts) và tích hợp tự động khởi chạy đường hầm Ngrok trong [`start-services.bat`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/start-services.bat).

**Sinh viên kiểm chứng & điều chỉnh:**
* Phát hiện gói `@rolldown/binding-win32-x64-msvc` chỉ chạy trên Windows làm lỗi build trên Linux của Vercel (`EBADPLATFORM`); đã gỡ bỏ gói phụ thuộc cứng này khỏi `frontend/package.json`.
* Khởi động `genai-hub` ở cổng `3001` và cập nhật `package.json` để lệnh `npm run start` bật trực tiếp HTTP REST Server của GenAI Hub.

---

### PHIÊN 4 (Tuần 10): ĐỒNG BỘ ATOMIC TESTCASES, CHỐNG ĐIỂM ẢO & BẢO MẬT GITHUB PUSH (Session 74 / Session 49, 50, 51)
* **Đối chiếu Commit GitHub:** `38cbe5c`, `c127af7`, `6d25320`
* **SDLC Phase:** Security Hardening & Final Release

**Sinh viên hỏi / Yêu cầu:**
> sửa lỗi seed dữ liệu bị vướng khóa ngoại trên PostgreSQL 15, đồng bộ cập nhật testcase nguyên tử (atomic replace), đảm bảo nộp bài sai hoặc lỗi biên dịch phải về 0 điểm và xử lý lỗi GitHub Push Protection chặn đẩy API Key

**AI phản hồi:**
1. **Atomic Testcase Replace (`6d25320`):** Tạo [`replace-test-cases.dto.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/src/test-cases/dto/replace-test-cases.dto.ts) và nâng cấp [`test-case.repository.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/src/database/test-case.repository.ts) để thay thế bộ testcase của bài tập trong một giao dịch nguyên tử duy nhất trên PostgreSQL 15.
2. **Strict Zero-Score Guard (`c127af7`, `6d25320`):** Siết chặt [`grading-worker.consumer.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/src/queue/grading-worker.consumer.ts) và [`LiveGradingModal.tsx`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/frontend/src/components/LiveGradingModal.tsx) để khi bài nộp lỗi biên dịch hoặc sai kết quả sẽ nhận đúng `0.0đ` testcase.
3. **Database Seed Migration & GitHub Secret Protection (`38cbe5c`):**
   - Bổ sung lệnh `ALTER TABLE users ADD COLUMN IF NOT EXISTS` và `CREATE TABLE IF NOT EXISTS` trong [`01_master_demo_seed.ts`](file:///d:/Main/ky5/SWP391/Project/SWP391-Group4/api-gateway/src/database/seeds/01_master_demo_seed.ts) giúp nạp thành công hơn 800 bản ghi mẫu.
   - Chuyển khóa Gemini API từ mã nguồn sang biến môi trường `.env` (được bảo vệ bởi `.gitignore`), làm sạch lịch sử commit để vượt qua chốt chặn **GitHub Push Protection (`GH013`)**.

**Sinh viên kiểm chứng & điều chỉnh:**
* Chạy `npm run db:seed`: Nạp thành công 100% dữ liệu mẫu (5 học phần, 6 lớp, 50 sinh viên, 80 bài nộp, 32 báo cáo đạo văn, 20 đơn phúc khảo) vào PostgreSQL 15.
* Thực hiện `git push origin main` và `npm run build` trên cả `frontend` lẫn `api-gateway`: Thành công 100% với **0 lỗi biên dịch**.

