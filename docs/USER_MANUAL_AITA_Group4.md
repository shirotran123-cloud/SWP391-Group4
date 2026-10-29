# User Manual — AITA-Intelligent Autograding Platform (SWP391 Group 4)

- Version: 1.0 — 2026-10-13
- Audience: Student, Lecturer (GV001/INSTRUCTOR), Admin
- Frontend: `http://localhost:5173`; Gateway: `http://localhost:3000`
- Scoring: TC1 3.5 + TC2 3.5 + CleanCode 2.0 + SOLID 1.0 = 10 (mỗi testcase có điểm ngang nhau = 7.0 / N)
- Plagiarism gate: `>= 70%` flagged (`PLAGIARISM_THRESHOLD = 70.0`)

## 1. What Is AITA?

- Auto-grades programming `.zip` submissions end to end.
- Pipeline: queue → Docker sandbox → GenAI review → AST plagiarism check.
- Live WebSocket modal shows 6 grading steps in real time.
- Appeals allow grade disputes (max 2 within 48h).
- Teamwork analytics flags free-riders (`< 10%`).
- Final score breakdown always sums to 10 with 2 testcases.
- Vietnamese UI terms preserved verbatim in this manual.

## 2. Prerequisites

- Node.js 20+ and npm installed (`node -v` >= 20).
- Git for cloning the monorepo.
- Docker Desktop optional (offline fallback supported).
- Ports free: 3000 (api-gateway), 5173 (frontend vite dev).
- PostgreSQL 14+ (or Neon/Supabase/Azure Database for PostgreSQL).
- Database loaded with `database/init_all_13_tables.sql`.
- That script creates 13 tables (3NF) + `dead_letter_jobs` + `ai_prompt_templates`.
- Redis optional; offline uses in-memory queue + DLQ fallback.
- Browser: Chrome/Edge latest (Monaco diff viewer needs modern JS).

## 3. Install

- Install gateway deps first.
- Install genai-hub deps second.
- Install frontend deps third.
- Optionally install sandbox worker deps.
- Load schema before first run.
- Commands (PowerShell):

```powershell
cd api-gateway; npm install
cd ../genai-hub; npm install
cd ../frontend; npm install
cd ../sandbox/worker; npm install
psql $env:DATABASE_URL -f database/init_all_13_tables.sql
```

- Verify `node_modules` present in each service.
- Verify `psql` lists tables `roles`, `users`, `classes`.
- Verify seed users `GV001`, `SE170000` exist.

## 4. Run All Services

- Use three terminals (gateway, genai-hub, frontend).
- Gateway must start before frontend socket connects.
- Commands:

```powershell
# terminal 1 — gateway :3000
cd api-gateway; npx ts-node src/main.ts
# terminal 2 — genai-hub server
cd genai-hub; npm run start
# terminal 3 — frontend :5173
cd frontend; npm run dev
```

- Health: `GET http://localhost:3000/api/v1/queue/stats`.
- UI: open `http://localhost:5173`.
- Healthy badge: `Cổng Dịch Vụ Sẵn Sàng`.
- Connecting badge: `Đang Kết Nối Cổng...` means gateway down.
- Demo lecturer: `GV001` (or `giangvien.edu@gmail.com / 123456`).
- Demo students: `SE170000`, `SE170123`, `SE170456`.
- Google SSO allows `@fpt.edu.vn`, `@fe.edu.vn`, `@aita.fpt.edu.vn`, `@gmail.com`.
- SSO account must pre-exist in `users`, else 401/403.

## 5. Grade Flow (Student)

- Step 1: Đăng nhập via `LoginView` (OTP or Google SSO).
- Step 2: pick enrolled class (e.g. `SE1701-SWP391`).
- Step 3: open tab `Nộp Bài Tập Lập Trình (.zip)` (`SubmissionView`).
- Step 4: choose assignment `TASK-SWP391-SPRINT2`.
- Step 5: attach `.zip <= 10MB` (`MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024`).
- Step 6: pick language java/python/cpp/dotnet.
- Step 7: click Nộp bài; client calls `POST /api/v1/submissions`.
- Step 8: server SHA-256 hashes file into `submissions.file_hash`.
- Step 9: server responds 202 + `submissionId` in <200ms SLA.
- Step 10: client emits `join_submission` for live room.
- Step 11: watch `LiveGradingModal` 6 steps.
- Step 11a: (1) Hàng đợi Redis BullMQ.
- Step 11b: (2) Khởi tạo Docker Sandbox (512MB, `--network none`, `--pids-limit 64`).
- Step 11c: (3) Testcase 1 (`testcase:evaluated`).
- Step 11d: (4) Testcase 2 edge/TLE check.
- Step 11e: (5) GenAI Review (`ai:reviewed`).
- Step 11f: (6) AST Winnowing matrix note.
- Step 12: finish event `grading:completed` (or `grading:failed` + DLQ).
- Step 13: read score card `scoreBreakdown {testcase1:3.5, testcase2:3.5, cleanCode, solid, total/10}`.
- Step 14: inspect `SolidRadarChart` + code smells + explanation.
- Step 15: history saved under `Lịch Sử Nộp & Điểm Số` (`StudentHistoryView`).
- Timeout note: TLE shows 2005ms / watchdog wording; MLE shows 512MB wording.

## 6. Plagiarism Check (RBL Benchmark View)

- Open tab `Đối Soát Đạo Văn (AST Winnowing)` (`RblBenchmarkView`).
- Select benchmark Pair01–Pair10 from `rbl-benchmark-pairs.ts`.
- Engine display: `Winnowing w=10, k=15` (benchmark setting).
- Code defaults remain `DEFAULT_K = 5`, `DEFAULT_W = 3`.
- Result `>= 70%` shows `CẢNH BÁO ĐẠO VĂN` / flagged.
- Result `< 70%` shows `MÃ NGUỒN AN TOÀN`.
- Click result opens `MonacoDiffViewer` with `matchedTokensJson` ranges.
- Lecturer matrix view uses same `>= 70%` gate (`LecturerDashboard`).
- Negative control Pair10 correctly stays unflagged (true negative).

## 7. Appeals Flow (max 2, 48h)

- Student tab: `Phúc Khảo & Khiếu Nại (UC-06)` (`StudentAppealsView`).
- Create: `POST /api/v1/appeals {submissionId, studentId, reason}`.
- Rule BR-05: `<= 2` appeals per submission (`MAX_APPEALS_PER_SUBMISSION = 2`).
- Rule BR-05: window `<= 48h` from submit (`DISPUTE_WINDOW_MS`).
- Third attempt → 400 `Vượt quá số lần phúc khảo cho phép!`.
- Expired attempt → 400 `Đã quá thời hạn phúc khảo cho phép!` with hours.
- Lecturer panel: `LecturerAppealsManager`.
- Resolve: `PUT /api/v1/appeals/:id/resolve`.
- Statuses: `ACCEPTED` / `REJECTED` / `IN_REVIEW` (from `PENDING`).
- `ACCEPTED` + `adjustedScore` updates `submissions.score`.
- Students see resolution note + `resolved_at`.

## 8. Teamwork Metrics

- Record: `POST /api/v1/teamwork-metrics`.
- Body: `{classId, studentId, commitCount, linesAdded, linesDeleted, contributionPct}`.
- Rule BR-12: `contribution_pct < 10.0` → `is_free_rider = TRUE`.
- Free-rider triggers warn log with student + percent.
- Query class: `GET /api/v1/teamwork-metrics/class/:classId`.
- Query student: `GET /api/v1/teamwork-metrics/student/:studentId`.
- View in Admin/Lecturer dashboards.
- Metric id format `METRIC-*`; unique per (class, student).

## 9. Batch Re-grade and DLQ

- Stats: `GET /api/v1/queue/stats` (waiting/active/DLQ/congestion).
- DLQ list: `GET /api/v1/queue/dlq`.
- Retry: `POST /api/v1/queue/dlq/retry/:id` (re-enqueue, mark retried).
- Delete: `DELETE /api/v1/queue/dlq/:id`; purge: `POST /api/v1/queue/dlq/purge`.
- Re-grade single: `POST /api/v1/submissions/:id/simulate` (lecturer).
- Jobs failing `MAX_RETRIES = 3` land in `dead_letter_jobs` (`DLQ-*`).
- Queue `submission-grading-queue` + `submission-grading-dlq` (BullMQ).
- Redis offline: in-memory queue (`IN_MEMORY`, `< 2ms`) still supports replay.

## 10. Troubleshooting

- `[SandboxService] Docker Daemon OFFLINE` → normal without Docker.
- Fallback mode `RESILIENT_CIRCUIT_BREAKER` preserves TLE/MLE/SEGV verdicts.
- Start Docker Desktop for `DOCKER_SECCOMP` real containers.
- Queue `IN_MEMORY` → Redis offline; start Redis (`REDIS_HOST`/`REDIS_PORT`).
- 202 slow / `EXCEEDED` → check congestion (`CONGESTION_THRESHOLD = 50`, `CONCURRENCY_LIMIT = 4`).
- Score 0 `Invalid Submission` → zip lacks `.java/.py/.cpp/.cs`; re-pack.
- `Vượt quá số lần phúc khảo` → BR-05 max 2 reached.
- `quá thời hạn` → BR-05 48h window expired.
- `Đang Kết Nối Cổng...` → gateway down or port 3000 blocked; restart `npx ts-node src/main.ts`.
- SSO 401/403 → domain not whitelisted or account missing in `users`; contact GV/Admin.
- Support bundle: `submissionId` + `scoreBreakdown` + `dlqId` (if failed).
- Support bundle: gateway log line `queued in Xms (SLA < 200ms: PASSED/EXCEEDED)`.
