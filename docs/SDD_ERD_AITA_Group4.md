# Software Design Description + ERD — AITA-Intelligent (SWP391 Group 4)

- Version: 1.0 — 2026-10-13
- Schema source: `database/init_all_13_tables.sql`
- Code sources: `api-gateway/src/*`, `sandbox/worker/index.ts`, `genai-hub/src/*`, `frontend/src/*`

## Table of Contents

- 1. Architecture (5 subsystems)
- 2. Module Map
- 3. ERD (13 + 2)
- 4. Grading Math
- 5. API Endpoints
- 6. WebSocket Events
- 7. Sequence: grading pipeline
- 8. NFR design notes

## 1. Architecture (5 Subsystems)

- Subsystem 1 — Gateway/Queue/WebSocket (NestJS modular monolith).
- Subsystem 2 — Docker Sandbox (isolated execution + fallback).
- Subsystem 3 — GenAI Hub (review, rubric, compiler explanation).
- Subsystem 4 — AST Engine (normalizer + Winnowing + matrix).
- Subsystem 5 — Teamwork Analytics + DLQ ops.

```
[React/Vite :5173] --REST /api/v1/*--> [api-gateway :3000]
        | Socket.IO rooms                |
        v                                v
[LiveGradingModal 6 steps]   [BullMQ submission-grading-queue]
                             (+ in-memory + submission-grading-dlq)
                                         |
                                         v
                          [GradingWorkerConsumer.executeGradingPipeline]
                              |--> [Docker sandbox seccomp | circuit-breaker]
                              |--> [GenAI hub review]
                              +--> [AST Winnowing matrix]
                                         |
                                         v
                          [PostgreSQL 13 (3NF) + 2 infra tables]
```

- Gateway entry: `api-gateway/src/main.ts` (port 3000, SLA log `< 200ms`).
- Queue core: `api-gateway/src/queue/queue.service.ts`.
- Worker: `api-gateway/src/queue/grading-worker.consumer.ts` (250ms poll loop).
- DLQ ops: `api-gateway/src/queue/dlq.controller.ts`.
- Socket: `api-gateway/src/websocket/grading.gateway.ts`.
- Events: `api-gateway/src/common/constants/queue.constants.ts` (`QUEUE_EVENTS`).
- Sandbox gateway: `api-gateway/src/sandbox/sandbox.service.ts`.
- Sandbox worker: `sandbox/worker/index.ts` (`runDockerSandbox`, `runSafeFallbackSandbox`, `runSandbox`).
- Seccomp: `sandbox/security/seccomp.json`; images: `sandbox/dockerfiles/*`.
- GenAI server: `genai-hub/src/server.ts`; services: `genai-hub/src/services/*`.
- Providers: `genai-hub/src/providers/*`; schemas: `genai-hub/src/schemas/*`.
- AST: `genai-hub/src/ast-engine/ast-normalizer.ts`.
- AST: `genai-hub/src/ast-engine/winnowing.ts` (`DEFAULT_K = 5`, `DEFAULT_W = 3`).
- AST: `genai-hub/src/ast-engine/plagiarism-engine.ts` (70.0, 0.65/0.35).
- Dataset: `genai-hub/samples/rbl-dataset/rbl-benchmark-pairs.ts` (10 pairs).
- Benchmark runner: `genai-hub/test/run-ast-benchmark.ts`.
- Teamwork: `api-gateway/src/teamwork/teamwork.service.ts` + controller.
- Appeals: `api-gateway/src/appeals/appeals.service.ts` + controller.

## 2. Module Map (real source paths)

- Auth JWT+Google SSO: `api-gateway/src/auth/auth.service.ts`, `auth.controller.ts`.
- Users CRUD + bulk: `api-gateway/src/users/users.controller.ts`, `user.repository.ts`.
- Classes + bulk: `api-gateway/src/courses/courses.controller.ts` (`:id/bulk-import`).
- Assignments CRUD: `api-gateway/src/assignments/assignments.controller.ts`.
- Submissions ingest: `api-gateway/src/submissions/submissions.controller.ts`.
- Submissions logic: `api-gateway/src/submissions/submissions.service.ts` (SHA-256, 202).
- Queue + DLQ: `api-gateway/src/queue/queue.service.ts`, `dlq.controller.ts`.
- Worker pipeline: `api-gateway/src/queue/grading-worker.consumer.ts`.
- Sandbox execute: `api-gateway/src/sandbox/sandbox.service.ts`.
- Appeals BR-05: `api-gateway/src/appeals/appeals.service.ts`, `appeals.controller.ts`.
- Teamwork BR-12: `api-gateway/src/teamwork/teamwork.service.ts`, `teamwork.controller.ts`.
- WebSocket live: `api-gateway/src/websocket/grading.gateway.ts`.
- Internal fan-out: `api-gateway/src/internal/internal-events.controller.ts`.
- DB layer: `api-gateway/src/database/*.repository.ts`, `*.entity.ts`.
- Frontend shell: `frontend/src/App.tsx` (role views, socket handlers).
- Grade UI: `components/SubmissionView.tsx`, `LiveGradingModal.tsx`.
- Plagiarism UI: `components/RblBenchmarkView.tsx`, `MonacoDiffViewer.tsx`.
- History/appeals UI: `StudentHistoryView.tsx`, `StudentAppealsView.tsx`, `AppealModal.tsx`.
- Lecturer UI: `LecturerDashboard.tsx`, `LecturerAppealsManager.tsx`, `LecturerPanel.tsx`.
- Ops UI: `AdminDashboard.tsx`; charts: `SolidRadarChart.tsx`.
- Client plagiarism: `frontend/src/services/plagiarism.service.ts`.

## 3. ERD — 13 Relational Tables (per init_all_13_tables.sql) + 2 Infra

- Standard: PostgreSQL 14+, `pgcrypto`, 3NF, PK `*_id`, indexed FKs.
- Delete rules preserved verbatim (CASCADE / RESTRICT / SET NULL).

### E1 roles (RBAC)

- `role_id VARCHAR(32) PK`; `role_name VARCHAR(64) UNIQUE NOT NULL`.
- Values: `ADMIN`, `HOD`, `LECTURER`, `STUDENT` (+ demo `INSTRUCTOR` alias in code).
- `description TEXT`; `created_at TIMESTAMPTZ`.
- Referenced by `users.role_id ON DELETE RESTRICT`.

### E2 users (profiles + Google SSO)

- `user_id VARCHAR(64) PK` (e.g. `GV001`, `SE170000`).
- `role_id VARCHAR(32) FK → roles ON DELETE RESTRICT` (default `STUDENT`).
- `email VARCHAR(128) UNIQUE NOT NULL`; `full_name VARCHAR(128) NOT NULL`.
- `student_code VARCHAR(32) UNIQUE`; `role VARCHAR(32)` alias; `password_hash VARCHAR(255)`.
- `avatar_url TEXT`; `is_active BOOLEAN DEFAULT TRUE`.
- Indexes: `idx_users_email`, `idx_users_student_code`, `idx_users_role_id`.
- Seeds: `ADMIN001`, `GV001`, `SE170000`, `SE170123`, `SE170456`.

### E3 classes (course sections)

- `class_id VARCHAR(64) PK` (e.g. `CRS-SWP391`).
- `lecturer_id VARCHAR(64) FK → users ON DELETE RESTRICT`.
- `class_code VARCHAR(32) UNIQUE` (e.g. `SE1701-SWP391`); `class_name`, `semester`.
- View `courses` aliases `class_id→course_id`, `class_code→course_code`, `lecturer_id→instructor_id`.
- Seeds: `CRS-SWP391`, `CRS-PRO192`, `CRS-CSD201` (Fall 2026).

### E4 class_members (roster)

- `member_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `class_id FK → classes ON DELETE CASCADE`; `user_id FK → users ON DELETE CASCADE`.
- `enrolled_at TIMESTAMPTZ`; `status DEFAULT 'ACTIVE'`.
- `UNIQUE(class_id, user_id)`; indexes on both FKs.

### E5 assignments (tasks + sandbox quotas)

- `assignment_id VARCHAR(64) PK` (e.g. `TASK-SWP391-SPRINT2`).
- `class_id FK → classes ON DELETE CASCADE`; `course_id` alias column.
- `title`, `description`, `language DEFAULT 'java'`.
- `allowed_languages JSONB DEFAULT '["java","python","cpp","dotnet"]'`.
- `time_limit_sec NUMERIC(4,2) DEFAULT 2.0`; `time_limit_ms INT DEFAULT 2000`.
- `memory_limit_mb INT DEFAULT 512`; `due_date TIMESTAMPTZ NOT NULL`.
- `deadline` alias; `max_score NUMERIC(4,2) DEFAULT 10.00`.
- `testcases_count INT DEFAULT 2`; seed due = now + 14 days.

### E6 test_cases (public + hidden)

- `test_case_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `assignment_id FK → assignments ON DELETE CASCADE`.
- `input_data TEXT`; `expected_output TEXT`; `is_hidden BOOLEAN DEFAULT FALSE`.
- `weight NUMERIC(4,2) DEFAULT 1.0`; `time_limit_ms INT DEFAULT 2000`.
- Seeds: `TC-SWP-01` (public), `TC-SWP-02` (hidden).

### E7 submissions (packages + score)

- `submission_id VARCHAR(64) PK`; `assignment_id FK → assignments CASCADE`.
- `student_id FK → users CASCADE`; `file_hash VARCHAR(64)` SHA-256 + `sha256_hash` alias.
- `file_path TEXT`; `file_name DEFAULT 'submission.zip'`; `file_size_bytes INT`.
- `language VARCHAR(32)`; `status DEFAULT 'QUEUED'` (QUEUED/IN_PROGRESS/COMPLETED/FAILED/REJECTED).
- `queue_job_id VARCHAR(128)`; `testcase_score NUMERIC(4,2)`; `final_score NUMERIC(4,2)`.
- `score` alias; `details JSONB DEFAULT '{}'`.
- Indexes: assignment, student, hash, status, created DESC.

### E8 submission_details (per-test logs)

- `detail_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `submission_id FK → submissions CASCADE`; `test_case_id FK → test_cases SET NULL`.
- `status DEFAULT 'PASS'` (PASS/FAIL/TLE/MLE/CRASH).
- `actual_output TEXT`; `time_ms INT`; `memory_kb INT`; `error_log TEXT`.

### E9 ai_review_results (LLM audits)

- `review_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `submission_id FK → submissions CASCADE`.
- `clean_code_score NUMERIC(3,1)` CHECK 0–10; `solid_score NUMERIC(3,1)` CHECK 0–10.
- `code_smells_count INT`; `feedback_json JSONB`; `compiler_explanation TEXT`.
- `model_used DEFAULT 'gemini-1.5-pro'`; `token_usage JSONB`; `evaluated_at`.

### E10 ast_fingerprints (Winnowing hashes)

- `fingerprint_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `submission_id FK → submissions CASCADE`; `hash_value VARCHAR(64) NOT NULL`.
- `token_position INT`; `ast_node_type VARCHAR(64)`; `file_path DEFAULT 'main'`.
- `line_start`, `line_end`, `token_start`, `token_end`.
- Indexes: submission, hash, (submission, hash).

### E11 plagiarism_reports (pairwise fraud)

- `report_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `assignment_id FK → assignments CASCADE` (nullable in DDL).
- `submission_a_id FK → submissions CASCADE`; `submission_b_id FK → submissions CASCADE`.
- `similarity_rate NUMERIC(5,2)` CHECK 0–100; `flagged_as_fraud BOOLEAN`.
- `common_fingerprints_count INT`; `total_unique_fingerprints INT`.
- `matched_tokens_json JSONB` (segments for Monaco diff).
- `status DEFAULT 'SUSPECTED'` (CLEAN/SUSPECTED/FLAGGED_HIGH/FLAGGED_PLAGIARISM/CONFIRMED/DISMISSED).
- `UNIQUE(submission_a_id, submission_b_id)`; index similarity DESC.

### E12 appeals (disputes)

- `appeal_id VARCHAR(64) PK DEFAULT gen_random_uuid()` (runtime `APL-*`).
- `submission_id FK → submissions CASCADE`; `student_id FK → users CASCADE`.
- `reason TEXT NOT NULL`; `status DEFAULT 'PENDING'` (PENDING/ACCEPTED/REJECTED/IN_REVIEW).
- `reviewer_id FK → users SET NULL`; `resolution_note TEXT`; `resolved_at`.
- App enforces `<= 2` per submission within 48h (BR-05, not a DDL CHECK).

### E13 teamwork_metrics (Git analytics)

- `metric_id VARCHAR(64) PK DEFAULT gen_random_uuid()` (runtime `METRIC-*`).
- `class_id FK → classes CASCADE`; `student_id FK → users CASCADE`.
- `commit_count`, `lines_added`, `lines_deleted` INTs.
- `contribution_pct NUMERIC(5,2)` CHECK 0–100; `is_free_rider BOOLEAN DEFAULT FALSE`.
- Rule: `is_free_rider = (contribution_pct < 10%)` (BR-12).
- `UNIQUE(class_id, student_id)`; index `is_free_rider`.

### Infra dead_letter_jobs (BullMQ fault tolerance)

- `dlq_id VARCHAR(64) PK DEFAULT gen_random_uuid()` (runtime `DLQ-*`).
- `queue_name DEFAULT 'submission-grading-queue'`; `original_job_id`.
- `submission_id FK → submissions CASCADE`; `payload JSONB NOT NULL`.
- `failed_reason TEXT`; `attempts_made INT DEFAULT 3`; `stacktrace TEXT`.
- `status DEFAULT 'FAILED'`; `failed_at`; `retried_at`.

### Infra ai_prompt_templates (prompt versioning)

- `template_id VARCHAR(64) PK DEFAULT gen_random_uuid()`.
- `template_code VARCHAR(50) UNIQUE` (`CLEAN_CODE_SOLID_V1`, `EXAM_RUBRIC_V1`, `COMPILER_EXPLAIN_V1`).
- `version INT DEFAULT 1`; `system_prompt TEXT`; `user_prompt_template TEXT`.
- `temperature NUMERIC(2,1)`; `json_schema JSONB`; `is_active BOOLEAN`.

### Relationship summary

- `roles 1--* users 1--* classes 1--* {class_members, assignments}`.
- `assignments 1--* {test_cases, submissions}`; `submissions 1--* {details, reviews, fingerprints}`.
- `submissions *--* plagiarism_reports`; `submissions 1--* appeals (<=2)`.
- `(classes, users) 1--* teamwork_metrics`; `submissions 1--* dead_letter_jobs`.

## 4. Grading Math (normative, grading-worker.consumer.ts)

- Formula: `score = (TC1 ? 4.0 : 0) + (TC2 ? 3.0 : 0) + (clean/10)*2.0 + (solidAvg/10)*1.0`.
- Cap: `min(10, round1)`; `solidAvg = (s+o+l+i+d)/5`.
- Payload: `scoreBreakdown{testcase1, testcase2, cleanCode, solid, total}`, `maxScore: 10.0`.
- Total testcases: 2; `passedTestcases` counts PASSED.
- Sandbox overrides: TLE/MLE force TC2 FAILED; SEGV forces TC1 FAILED.
- Invalid zip (no source): score 0, `overallResult: FAILED`, status `COMPLETED`.
- Quotas: 512MB (`Memory`+`MemorySwap`), watchdog 2.0s, `--network none`, `--pids-limit 64`.
- Fallback codes: TLE 2005/exit138, MLE 65/137, SEGV 38/139, fork-block 45/159.

## 5. API Endpoints (/api/v1/*, real routes)

- Auth: `POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp`.
- Auth: `POST /api/v1/auth/google`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Users: `POST /api/v1/users`, `POST /api/v1/users/bulk-import`.
- Users: `GET /api/v1/users`, `GET /api/v1/users/:id`, `PUT /api/v1/users/:id`, `DELETE /api/v1/users/:id`.
- Courses: `POST /api/v1/courses`, `GET /api/v1/courses`, `GET /api/v1/courses/student/:studentId`.
- Courses: `GET /api/v1/courses/:id/students`, `POST /api/v1/courses/:id/bulk-import`.
- Courses: `GET /api/v1/courses/:id`, `PUT /api/v1/courses/:id`, `DELETE /api/v1/courses/:id`.
- Assignments: `POST /api/v1/assignments`, `GET /api/v1/assignments`, `GET /api/v1/assignments/:id`.
- Assignments: `PUT /api/v1/assignments/:id`, `DELETE /api/v1/assignments/:id`.
- Submissions: `POST /api/v1/submissions` (multipart `.zip<=10MB`, 202).
- Submissions: `GET /api/v1/submissions`, `GET /api/v1/submissions/stats`.
- Submissions: `GET /api/v1/submissions/:id`, `GET /api/v1/submissions/:id/download`.
- Submissions: `POST /api/v1/submissions/:id/simulate` (re-grade).
- Internal: `POST /api/v1/internal/events/testcase-evaluated`.
- Internal: `POST /api/v1/internal/events/grading-progress`.
- Internal: `POST /api/v1/internal/events/grading-completed`.
- Queue: `GET /api/v1/queue/stats`, `GET /api/v1/queue/dlq`.
- Queue: `POST /api/v1/queue/dlq/retry/:id`, `DELETE /api/v1/queue/dlq/:id`, `POST /api/v1/queue/dlq/purge`.
- Appeals: `POST /api/v1/appeals`, `GET /api/v1/appeals`, `GET /api/v1/appeals/:id`, `PUT /api/v1/appeals/:id/resolve`.
- Teamwork: `GET /api/v1/teamwork-metrics`, `GET /api/v1/teamwork-metrics/class/:classId`.
- Teamwork: `GET /api/v1/teamwork-metrics/student/:studentId`, `POST /api/v1/teamwork-metrics`.

## 6. WebSocket Events (QUEUE_EVENTS, rooms submission_<id>)

- Client→server: `join_submission` (room auth: own submission or staff).
- Client→server: `subscribe:submission`, `leave_submission`; ack `joined_submission`.
- Server→room: `submission:queued` (accepted, SLA note).
- Server→room: `grading:progress {stepId, stepName, status, detail}` (steps 1–6).
- Server→room: `testcase:evaluated {testcaseId, testcaseIndex, status, timeMs}`.
- Server→room: `ai:reviewed {cleanCodeScore, solidScore, codeSmells, explanation}`.
- Server→room: `grading:completed {score, scoreBreakdown, maxScore:10, aiRating}`.
- Server→room: `grading:failed {error, dlqJobId}`; admin mirror `admin:*`.
- Constant `plagiarism:evaluated` defined for matrix fan-out.
- Frontend `App.tsx` maps events onto `LiveGradingModal` 6 steps.

## 7. Sequence: grading pipeline (executeGradingPipeline)

- 1: status `IN_PROGRESS`; emit progress step 1 (queue `<200ms latency`).
- 2: unzip via `extractSourceCodeFromZip`; `executeCode` (DOCKER/FALLBACK note with 512MB/none/64).
- 3: `analyzeSourceCode`; emit TC1 `testcase:evaluated` + progress step 3.
- 4: emit TC2 `testcase:evaluated` + progress step 4 (TLE wording if applicable).
- 5: build AI payload; emit `ai:reviewed` + progress step 5.
- 6: AST note (local empty-store wording); emit progress step 6.
- 7: compute `scoreBreakdown`; `updateStatus(COMPLETED, payload, finalScore)`.
- 8: emit `grading:completed`; on exception: 3 retries → `moveToDLQ` → `grading:failed`.

## 8. NFR Design Notes

- BullMQ `MAX_RETRIES=3`, backoff 1500 exponential, `CONCURRENCY_LIMIT=4`.
- Redis down → in-memory queue + `dead_letter_jobs` (`DLQ-*`).
- Docker down → `RESILIENT_CIRCUIT_BREAKER` with identical verdict tags.
- Plagiarism `>= 70%` flagged; statuses CLEAN/SUSPECTED/FLAGGED.
- Coverage gate 80%; ports 3000 (gateway) / 5173 (vite).
- Upload `.zip <= 10MB`; SHA-256 dedup via `file_hash` index.
