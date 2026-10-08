# Software Requirements Specification — AITA-Intelligent Autograding Platform (SWP391 Group 4)

- Version: 1.0 — 2026-10-13
- Course: SWP391 RBL 10 Weeks (CLO1–CLO6)
- Stack: `api-gateway` (NestJS) + `sandbox/worker` (Docker) + `genai-hub` (GenAI + AST)
- Frontend: `frontend` (React/Vite) + PostgreSQL (`database/init_all_13_tables.sql`)
- Authors: SWP391 Group 4

## 1. Introduction

### 1.1 Purpose

- Specify functional requirements for autograding programming assignments.
- Specify GenAI qualitative review (Clean Code, SOLID).
- Specify AST plagiarism detection (Winnowing matrix).
- Specify appeals and teamwork analytics.
- Provide testable gates for Milestone 3 and Final Defense.

### 1.2 Scope

- Subsystem 1: Portal & Auth (Student/Lecturer/Admin).
- Subsystem 2: Docker Autograde Sandbox Engine.
- Subsystem 3: GenAI Core Review Hub.
- Subsystem 4: AST Plagiarism & Code Analytics Engine (RBL Core).
- Subsystem 5: Redis Background Queue & Git Teamwork Analytics.
- Out of scope: native mobile app, offline desktop client.

### 1.3 Definitions

- TLE: Time Limit Exceeded (Watchdog 2.0s, SIGKILL, exit 138).
- MLE: Memory Limit Exceeded (512MB quota, OOM exit 137).
- SLA: submission acceptance latency below 200ms.
- Winnowing: k-gram fingerprinting (`genai-hub/src/ast-engine/winnowing.ts`).
- Code defaults: `DEFAULT_K = 5`, `DEFAULT_W = 3`.
- Benchmark setting: `k=15/w=10` (RBL benchmark runs).
- DLQ: Dead Letter Queue (`dead_letter_jobs` + BullMQ `submission-grading-dlq`).
- Queue name: `submission-grading-queue`.
- UI terms verbatim: `Nộp Bài Tập Lập Trình (.zip)`.
- UI terms verbatim: `Đối Soát Đạo Văn (AST Winnowing)`.
- UI terms verbatim: `Phúc Khảo & Khiếu Nại (UC-06)`.
- UI terms verbatim: `Lịch Sử Nộp & Điểm Số`.
- UI terms verbatim: `Cổng Dịch Vụ Sẵn Sàng`.
- UI terms verbatim: `LiveGradingModal`.

### 1.4 References

- `RBL_Syllabus_AITA_10Weeks.md` (5 subsystems, CLO1–CLO6, gates).
- `database/init_all_13_tables.sql` (13 tables 3NF + 2 infra).
- `api-gateway/src/queue/grading-worker.consumer.ts` (weights 4.0/3.0/2.0/1.0).
- `api-gateway/src/sandbox/sandbox.service.ts` (DOCKER_SECCOMP / RESILIENT_CIRCUIT_BREAKER).
- `sandbox/worker/index.ts` (512MB, 2.0s, none, 64).
- `genai-hub/src/ast-engine/plagiarism-engine.ts` (threshold 70.0, 0.65/0.35).
- `genai-hub/samples/rbl-dataset/rbl-benchmark-pairs.ts` (10 pairs).
- `api-gateway/src/appeals/appeals.service.ts` (max 2, 48h).
- `api-gateway/src/teamwork/teamwork.service.ts` (free-rider < 10%).
- `api-gateway/src/auth/auth.service.ts` (JWT HMAC + Google SSO whitelist).
- `frontend/src/App.tsx` + 15 components.

## 2. Overall Description

### 2.1 Product perspective

- Modular monolith gateway orchestrates grading pipeline.
- Docker sandbox executes untrusted student code in isolation.
- GenAI hub scores qualitative dimensions via versioned prompts.
- AST engine builds pairwise similarity matrix per assignment.
- BullMQ queue decouples ingest (<200ms) from grading (seconds).
- WebSocket pushes 6-step live progress to browser.
- PostgreSQL stores 13 relational entities in 3NF.

### 2.2 Actors

- Student: submits `.zip`, views live score, history, benchmark, appeals.
- Lecturer (INSTRUCTOR / GV001): manages classes, assignments, testcases.
- Lecturer: bulk imports roster, resolves appeals, views plagiarism matrix.
- Lecturer: triggers batch re-grade and DLQ replay.
- Admin: manages users, monitors queue/DLQ, prompt templates.
- System Worker: consumes queue, runs sandbox, emits socket events.

### 2.3 Representative UI mapping

- Student: `SubmissionView`, `StudentHistoryView`.
- Student: `RblBenchmarkView`, `StudentAppealsView`.
- Lecturer: `LecturerDashboard`, `LecturerAppealsManager`.
- Shared: `LiveGradingModal`, `MonacoDiffViewer`, `SolidRadarChart`.
- Auth: `LoginView`, `LoginModal`.
- Ops: `AdminDashboard`.

### 2.4 Constraints

- Only `.zip` accepted (`allowedExtensions: ['.zip']`).
- Max upload 10MB (`MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024`).
- Exactly 2 testcases per assignment (`testcases_count = 2`).
- Sandbox quotas non-negotiable (512MB / 2.0s / none / 64).
- Plagiarism flag fixed at `>= 70%`.
- Coverage gate 80% for Milestone 3 / Final.

## 3. Functional Requirements — Use Cases UC-01..UC-12

### UC-01 — Authentication (JWT HMAC + Google SSO + OTP)

- Actors: Student, Lecturer, Admin.
- Source: `api-gateway/src/auth/auth.service.ts`, `auth.controller.ts`.
- Precondition: account exists in `users` with `is_active = TRUE`.
- `POST /api/v1/auth/request-otp` checks password, issues 6-digit OTP (5-min expiry).
- `POST /api/v1/auth/verify-otp` validates OTP, signs JWT HS256 via `signJwt` (86400s).
- `verifyJwt` enforces signature + expiry on each request.
- Google path: `POST /api/v1/auth/google` with domain whitelist.
- Whitelist: `@fpt.edu.vn`, `@fe.edu.vn`, `@aita.fpt.edu.vn`, `@gmail.com`.
- Unknown email → 401; inactive → 403; wrong domain → 403.
- Aux routes: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Alternate: special instructor `giangvien.edu@gmail.com` demo bypass.
- Postcondition: client stores `aita_token` + `aita_user`.

### UC-02 — Bulk Excel Import with Transaction Rollback

- Actors: Lecturer, Admin.
- Routes: `POST /api/v1/courses/:id/bulk-import`, `POST /api/v1/users/bulk-import`.
- Precondition: caller has LECTURER or ADMIN role.
- Server opens single SQL transaction over `users` + `class_members`.
- Each row validated (email format, domain, duplicates).
- Any row failure rolls back entire batch (all-or-nothing roster).
- Postcondition: zero partial rosters; summary with row counts returned.

### UC-03 — Submit .zip Package (<=10MB, SHA-256)

- Actor: Student.
- Route: `POST /api/v1/submissions` (multipart `file` + `studentId` + `assignmentId` + `language`).
- Rule: filename must end `.zip`; else 400.
- Rule: size `<= 10MB` (`MAX_UPLOAD_SIZE_BYTES`); else 413.
- Server computes SHA-256 into `submissions.file_hash` / `sha256_hash`.
- Record inserted with status `QUEUED` + `queue_job_id`.
- `extractSourceCodeFromZip` finds first `.java/.py/.cpp/.cc/.cs` source.
- Missing source → score-0 FAILED-but-COMPLETED path.
- Postcondition: 202 response with `submissionId` and `durationMs`.

### UC-04 — Queue Submission (<200ms SLA)

- Source: `api-gateway/src/queue/queue.service.ts`, `common/constants/queue.constants.ts`.
- Queue: `submission-grading-queue` (BullMQ).
- Options: `attempts = MAX_RETRIES = 3`, exponential backoff `BACKOFF_DELAY_MS = 1500`.
- Concurrency: `CONCURRENCY_LIMIT = 4`; congestion flag `CONGESTION_THRESHOLD = 50`.
- `addSubmissionJob` pushes job payload, measures `durationMs` via `performance.now()`.
- SLA log asserts `< 200ms` (PASSED / EXCEEDED).
- Redis offline → in-memory queue (`mode: 'IN_MEMORY'`, `< 2ms`).
- Exhausted jobs → `submission-grading-dlq` via `moveToDLQ`.
- Worker poll loop runs every 250ms (`grading-worker.consumer.ts`).

### UC-05 — Sandbox Autograding (Docker seccomp + fallback)

- Sources: `sandbox/worker/index.ts`, `api-gateway/src/sandbox/sandbox.service.ts`.
- Dispatcher `executeCode` / `runSandbox` probes Docker daemon.
- Mode A `DOCKER_SECCOMP` (daemon online); Mode B `RESILIENT_CIRCUIT_BREAKER` (offline).
- Hardening: `Memory: 512 * 1024 * 1024` (512MB) + equal `MemorySwap` (no swap).
- Hardening: `NetworkMode: 'none'` (`--network none`).
- Hardening: `PidsLimit: 64` (`--pids-limit 64`).
- Hardening: `CapDrop: ['ALL']`, `ReadonlyRootfs: true`, `seccomp=${seccompProfile}`.
- Watchdog SIGKILL after 2.0s (TLE, exit 138); MLE exit 137; SEGV exit 139; fork-block exit 159.
- Images: `python:3.11-slim`, `gcc:11`, `openjdk:17-slim`, `dotnet/sdk:8.0`.
- Postcondition: `{stdout, stderr, timeMs, exitCode, mode}` returned to worker.

### UC-06 — GenAI Qualitative Review (Clean Code + SOLID)

- Source: `genai-hub/src/services/*`, `providers/*`, `schemas/*`.
- Templates in `ai_prompt_templates`: `CLEAN_CODE_SOLID_V1`, `EXAM_RUBRIC_V1`, `COMPILER_EXPLAIN_V1`.
- Outputs: `ai_review_results.clean_code_score` (0–10).
- Outputs: `ai_review_results.solid_score` (0–10).
- Outputs: `code_smells_count`, `feedback_json`, `compiler_explanation`.
- Event `ai:reviewed` emitted with scores + smells + explanation.
- Weights: CleanCode 2.0 + SOLID 1.0 of final 10.
- Postcondition: one review row persisted per `submission_id`.

### UC-07 — AST Plagiarism Matrix (>=70% flag)

- Source: `genai-hub/src/ast-engine/plagiarism-engine.ts`.
- Threshold: `PLAGIARISM_THRESHOLD = 70.0`.
- Normalizer `ast-normalizer.ts`: identifiers → canonical, drops comments.
- Fingerprinter `winnowing.ts`: defaults `DEFAULT_K = 5`, `DEFAULT_W = 3`.
- Ensemble: `0.65 * winnowingContainment + 0.35 * astStructuralSimilarity`.
- Shortcut: containment `>= 99.0` forces similarity 100.0.
- `computeClassSimilarityMatrix` returns N×N `similarityMatrix` + `flaggedPairsCount`.
- `matchedTokensJson` carries line/token segments for `MonacoDiffViewer`.
- Bands: `CLEAN` (<40), `SUSPECTED` (>=40), `FLAGGED_PLAGIARISM` (>=70).
- Postcondition: `plagiarism_reports` rows with `flagged_as_fraud`.

### UC-08 — Assignment & Testcase Management

- Actor: Lecturer.
- Create `POST /api/v1/assignments`; list `GET /api/v1/assignments`.
- Detail `GET /api/v1/assignments/:id`; update `PUT /api/v1/assignments/:id`.
- Delete `DELETE /api/v1/assignments/:id`.
- Seed `TASK-SWP391-SPRINT2` (java, 2.0s, 512MB, max 10.00, `testcases_count = 2`).
- `test_cases` seeds: TC-SWP-01 (public), TC-SWP-02 (hidden).
- Worker mirrors TC-01 (StdIn/StdOut) + TC-02 (edge/TLE check).
- Postcondition: exactly 2 testcases enforced per assignment.

### UC-09 — Appeals (max 2 / 48h)

- Source: `api-gateway/src/appeals/appeals.service.ts` (BR-05).
- Constants: `MAX_APPEALS_PER_SUBMISSION = 2`, `DISPUTE_WINDOW_MS = 48h`.
- Create `POST /api/v1/appeals` (`submissionId`, `studentId`, `reason`).
- Check: submission exists, else 404.
- Check: `countBySubmissionId >= 2` → 400 quota exceeded.
- Check: `now - createdAt > 48h` → 400 with elapsed hours.
- List `GET /api/v1/appeals`; detail `GET /api/v1/appeals/:id`.
- Resolve `PUT /api/v1/appeals/:id/resolve` → `ACCEPTED`/`REJECTED`/`IN_REVIEW`.
- ACCEPTED + `adjustedScore` updates `submissions.score`.
- Postcondition: audit trail (`APL-*` id, reviewer, timestamps).

### UC-10 — Teamwork Free-Rider Analytics

- Source: `api-gateway/src/teamwork/teamwork.service.ts` (BR-12).
- Rule: `contributionPct < 10.0` → `isFreeRider = true` + warn log.
- Record `POST /api/v1/teamwork-metrics` (classId, studentId, commits, LOC).
- Query all `GET /api/v1/teamwork-metrics`.
- Query class `GET /api/v1/teamwork-metrics/class/:classId`.
- Query student `GET /api/v1/teamwork-metrics/student/:studentId`.
- IDs `METRIC-*`; UNIQUE per (class, student).
- Postcondition: `teamwork_metrics` row with `is_free_rider` flag.

### UC-11 — Real-Time WebSocket Progress

- Source: `api-gateway/src/websocket/grading.gateway.ts`, `QUEUE_EVENTS`.
- Events: `submission:queued`, `grading:progress`, `testcase:evaluated`.
- Events: `ai:reviewed`, `plagiarism:evaluated`, `grading:completed`, `grading:failed`.
- Client joins `join_submission` / `subscribe:submission` with room auth.
- Rooms `submission_<id>`; students join own submissions only; ack `joined_submission`.
- `LiveGradingModal` renders 6 steps (pending/in_progress/passed/failed).
- Admin mirror: `admin:*` fan-out for ops dashboards.
- Postcondition: browser converges to completed/failed payload.

### UC-12 — Batch Re-grade & DLQ Replay

- Stats `GET /api/v1/queue/stats` (waiting/active/DLQ/congestion).
- List `GET /api/v1/queue/dlq`; retry `POST /api/v1/queue/dlq/retry/:id`.
- Delete `DELETE /api/v1/queue/dlq/:id`; purge `POST /api/v1/queue/dlq/purge`.
- Re-grade `POST /api/v1/submissions/:id/simulate` (lecturer).
- Internal fan-out `POST /api/v1/internal/events/testcase-evaluated|grading-progress|grading-completed`.
- Rule: 3 failed attempts → `moveToDLQ` → `dead_letter_jobs` (`DLQ-*`).
- Postcondition: replayed job re-enters `submission-grading-queue`.

## 4. Grading Formula (normative)

- Total: TC1 4.0 + TC2 3.0 + CleanCode 2.0 + SOLID 1.0 = 10.
- TC1 pass → 4.0 else 0; TC2 pass → 3.0 else 0.
- CleanCode part = `(cleanCodeScore / 10) * 2.0`.
- SOLID part = `(solidAvg / 10) * 1.0`; `solidAvg` = mean of S/O/L/I/D.
- Rounding one decimal (`Math.round(x*10)/10`), capped at 10.
- Code: `analyzeSourceCode` in `grading-worker.consumer.ts`.
- Payload: `scoreBreakdown {testcase1, testcase2, cleanCode, solid, total}`.
- Sandbox TLE/MLE force TC2 fail; SEGV forces TC1 fail.
- Empty/invalid zip → score 0, `overallResult: FAILED`, status `COMPLETED`.
- Exactly 2 testcases; `maxScore: 10.0`.

## 5. Non-Functional Requirements

- NFR-01: Sandbox RAM 512MB hard (`Memory`, OOM exit 137).
- NFR-02: Watchdog 2.0s TLE (SIGKILL, exit 138).
- NFR-03: `--network none` (`NetworkMode: 'none'`).
- NFR-04: `--pids-limit 64` (`PidsLimit: 64`).
- NFR-05: flag `similarityRate >= 70%` (`PLAGIARISM_THRESHOLD = 70.0`).
- NFR-06: coverage ≥ 80% (Milestone 3 / Final gate).
- NFR-07: acceptance SLA <200ms.
- NFR-08: `.zip <= 10MB` (`MAX_UPLOAD_SIZE_BYTES`).
- NFR-09: seccomp + `CapDrop: ['ALL']` + readonly rootfs.
- NFR-10: cached reads p95 <100ms (syllabus target).
- NFR-11: concurrency `CONCURRENCY_LIMIT = 4`.

## 6. Relational Model Summary (13 + 2)

- Per `database/init_all_13_tables.sql` (PostgreSQL 14+, 3NF, pgcrypto).
- E1 `roles`: `role_id` PK; `role_name` UNIQUE (ADMIN/LECTURER/STUDENT/HOD).
- E2 `users`: `user_id` PK; `role_id` → roles RESTRICT; `email` UNIQUE.
- E2 extras: `student_code` UNIQUE, `password_hash`, `is_active`.
- E3 `classes`: `class_id` PK; `lecturer_id` → users; `class_code` UNIQUE.
- E3 alias: `courses` view maps class→course columns.
- E4 `class_members`: `member_id` PK; UNIQUE(`class_id`,`user_id`); CASCADE both.
- E5 `assignments`: `assignment_id` PK; `class_id` → classes CASCADE.
- E5 quotas: 2.0s / 2000ms / 512MB; `max_score` 10.00; count 2; `due_date` + alias.
- E6 `test_cases`: `test_case_id` PK; `assignment_id` → assignments CASCADE.
- E6 fields: input/expected, `is_hidden`, weight, 2000ms; TC-SWP-01/02 seeds.
- E7 `submissions`: `submission_id` PK; assignment + student FKs CASCADE.
- E7 integrity: `file_hash`/`sha256_hash` SHA-256; status QUEUED→COMPLETED.
- E7 scores: `testcase_score`, `final_score`, `score` alias, `details` JSONB.
- E8 `submission_details`: `detail_id` PK; PASS/FAIL/TLE/MLE/CRASH per test.
- E9 `ai_review_results`: `review_id` PK; clean + solid 0–10 CHECKs.
- E10 `ast_fingerprints`: `fingerprint_id` PK; `hash_value` + line/token spans.
- E11 `plagiarism_reports`: `report_id` PK; UNIQUE(a,b); rate 0–100.
- E12 `appeals`: `appeal_id` PK (`APL-*`); PENDING/ACCEPTED/REJECTED/IN_REVIEW.
- E13 `teamwork_metrics`: `metric_id` PK (`METRIC-*`); UNIQUE(class,student).
- Infra `dead_letter_jobs`: `dlq_id` (`DLQ-*`); attempts default 3.
- Infra `ai_prompt_templates`: 3 seeded v1 templates (UNIQUE code).
- Full columns/FKs/indexes: SDD §3.

## 7. Business Rules

- BR-02 (Deadline): after `assignments.due_date` reject; seed +14 days.
- BR-02: frontend `CountdownTimer` blocks late upload.
- BR-05 (Appeals): `<= 2` per `submission_id`; `countBySubmissionId >= 2` → 400.
- BR-05: window `<= 48h` from `createdAt` (`DISPUTE_WINDOW_MS`); expired → 400 + hours.
- BR-12 (Free-rider): `contribution_pct < 10.0` → `is_free_rider = TRUE`.
- BR-12: enforced in `recordMetric` + warn log; syllabus P2P/LOC cross-check.

## 8. Activity Flows

### 8.1 Submit → Grade → Review → Appeal (happy path)

- 1: login (`LoginView`, UC-01) → select class (`class_members` sync).
- 2: open `Nộp Bài Tập Lập Trình (.zip)`, attach ≤10MB, pick language.
- 3: `POST /api/v1/submissions` SHA-256 → `QUEUED`, 202 <200ms, `join_submission`.
- 4: worker `executeGradingPipeline` → `IN_PROGRESS`.
- 5: step 1 queue passed; step 2 sandbox + unzip via `executeCode`.
- 6: steps 3–4 TC runs, each emits `testcase:evaluated`.
- 7: step 5 GenAI emits `ai:reviewed` (CleanCode + SOLID).
- 8: step 6 AST Winnowing matrix note.
- 9: `grading:completed` with `scoreBreakdown` 4.0/3.0/clean/solid/total.
- 10: modal shows total/10 + radar; history in `Lịch Sử Nộp & Điểm Số`.
- 11: optional appeal (≤2 within 48h) → lecturer `ACCEPTED`/`REJECTED`.
- 12: ACCEPTED adjusts `submissions.score`.

### 8.2 Failure paths

- Bad zip (no source): steps 3–6 failed; score 0; `COMPLETED`.
- TLE/MLE/SEGV: mapped TC failure with stderr tag; pipeline continues.
- Exception ×3: `moveToDLQ`, `grading:failed` with `dlqJobId`.
- Redis down: in-memory queue, same socket events.
- Docker down: `RESILIENT_CIRCUIT_BREAKER`, verdicts preserved.

## 9. Traceability (CLO)

- CLO1 → this SRS (UC + flows).
- CLO2 → SDD architecture + module map + API table.
- CLO3 → ERD 13 tables + BR-02/BR-05/BR-12 + transaction rule.
- CLO4 → UC-04/UC-05/UC-07 + NFR-01..05 + grading math.
- CLO5 → UC-10 + BR-12 + Kanban evidence.
- CLO6 → IEEE paper + user manual + Final demo.

## 10. Acceptance Criteria

- Queue acceptance <200ms on `POST /api/v1/submissions`.
- Sandbox 512MB / 2.0s / `--network none` / `--pids-limit 64`.
- Weights 4.0/3.0/2.0/1.0 = 10 with 2 testcases.
- Flag `>= 70%` with default config.
- Appeals `<= 2` per submission within 48h.
- Free-rider flagged below 10%.
- In-memory + DLQ fallback with Redis/Docker offline.
- 6-step live modal converges to completed/failed.
- 80% coverage on backend + frontend core modules.
