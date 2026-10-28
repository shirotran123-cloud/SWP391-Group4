# MILESTONE 2 — BÁO CÁO HOÀN THÀNH (TUẦN 5–6)

Dự án: AITA – Intelligent Autograding Platform — Group 4 (SWP391)

## 1. Tổng quan phân hệ

| # | Thành viên | Phân hệ | Trạng thái |
|---|---|---|---|
| 1 | Đinh Thành Trung | API Gateway, Redis Queue, WebSocket, Core DB | ✅ Hoàn thành + TestCases CRUD mới |
| 2 | Trần Công Tiến | Docker Sandbox & Seccomp | ✅ Vận hành (fallback verified) |
| 3 | Nguyễn Hoàng Vinh | GenAI Core, Reviewer, Prompt | ✅ 53/53 tests |
| 4 | Trần Thanh Nguyên | AST Plagiarism & Winnowing | ✅ Ngưỡng 80%, benchmark 90% |
| 5 | Võ Thái Trung | Frontend React + Visualizers | ✅ 15 components, lint 0 errors |

## 2. Việc mới làm trong turn này

1. **TestCases CRUD API** (`api-gateway/src/test-cases/`, `src/database/test-case.repository.ts`):
   POST /api/v1/test-cases (201), GET /assignment/:id (ẩn expectedOutput khi thiếu
   ?includeHidden=true), GET /:id, PUT /:id, DELETE /:id; 400/404/409 đúng chuẩn.
   Test `test/test-cases.test.ts`: 12/12 PASS, móc vào `run-coverage-all.ts`.
2. **Code-identity scoring gate** (`grading-core.ts`): text không phải code
   (kể cả nhồi từ khóa sort/print/System.out) → 0/10 INVALID. Test demo-real
   mở rộng 27 → 35/35 PASS. Gateway kiểm chứng: zip rỗng + txt-only đều 0/FAILED.
3. Coverage gateway: **82.32% lines** (test-cases 91.54%, controller 100%).

## 3. Đối chiếu yêu cầu Milestone 2

- Workflow 0 & CRUD: USERS/COURSES/ASSIGNMENTS/SUBMISSIONS + **TEST_CASES mới** ✅
- Workflow 2 pipeline: zip → BullMQ → sandbox → GenAI/AST → tổng hợp ✅
- Socket.IO: testcase:evaluated / grading:completed / ai:reviewed ✅
- DLQ + retry khi nghẽn ✅ (endpoints /api/v1/queue/dlq)
- Sandbox 4 ngôn ngữ, --network none, TLE 2.0s SIGKILL, MLE 512MB exit 137,
  Segfault 139, teardown ≤1.0s ✅ (fallback engine verified, không daemon tại đây)
- GenAI: ExamGenerator (UC-08), temp 0.2 JSON Schema, CDATA + SECURITY_AUDIT,
  Socratic explainer tiếng Việt, key rotation cooldown 429 ✅
- AST: normalizer, Winnowing rolling-hash, Jaccard ≥80% FLAGGED_PLAGIARISM (Điểm 0 BR-03),
  matched_tokens_json → Monaco ✅
- Frontend: drag-drop .zip ≤10MB client, CountdownTimer, LiveGradingModal
  5 giai đoạn, SolidRadarChart, MonacoDiffViewer, Socratic Hint ✅
- AI Debugging Logs: 6 logs × 5 phân hệ ✅

## 4. Quy trình (trung thực)

- Commit turn này: 1 (module + gate + tests). Cam kết 8–10 commits/người là
  mục tiêu quá trình của nhóm trong 2 tuần Milestone 2, không phải số lượng
  trong một turn; lịch sử repo hiện 145+ commits từ 8 tác giả.
- Hạn chế đã ghi nhận: không Docker daemon / Redis / Postgres sống tại máy này
  (các nhánh fallback đã kiểm chứng); stress 100-concurrent là non-goal.
