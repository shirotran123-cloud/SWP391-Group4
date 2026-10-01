# Kiến Trúc Cơ Sở Dữ Liệu AITA (Database Architecture - SRS Compliant)
## Hệ Thống Tự Động Chấm Điểm & Đánh Giá Mã Nguồn Bằng AI & AST

> **Chuẩn Đặc Tả SRS (IEEE Std 830-1998 & ERD Mục 4):** CSDL quan hệ chuẩn hóa 3NF gồm **đúng 13 thực thể (13 Tables)** bao quát toàn bộ quy trình nghiệp vụ của AITA-Intelligent, cộng thêm **2 bảng hạ tầng hệ thống (Auxiliary Tables)** phục vụ hàng đợi Dead Letter Queue và quản lý phiên bản Prompt GenAI.

---

## 1. Bảng Đối Chiếu 13 Thực Thể Chuẩn SRS (Single Source of Truth)

| STT | Tên Bảng (SRS Entity) | Phân Hệ Nghiệp Vụ | Mục Đích & Mô Tả Dữ Liệu | Khóa Chính (PK) | Khóa Ngoại (FK) & Ràng Buộc |
|:---:|:---|:---|:---|:---|:---|
| **1** | `roles` | RBAC Security | Định nghĩa 4 vai trò hệ thống: `ADMIN`, `HOD` (Trưởng bộ môn), `LECTURER` (Giảng viên), `STUDENT` (Sinh viên). | `role_id` | `UNIQUE(role_name)` |
| **2** | `users` | Identity & Auth | Hồ sơ người dùng, mã sinh viên (`student_code`), Google SSO email whitelist, mật khẩu mã hóa BCrypt. | `user_id` | `role_id` $\rightarrow$ `roles(role_id)` |
| **3** | `classes` | Academic Management | Lớp học phần học kỳ (`SE1701-SWP391`, `PRO192`), học kỳ (`semester`), giảng viên phụ trách. | `class_id` | `lecturer_id` $\rightarrow$ `users(user_id)` |
| **4** | `class_members` | Course Enrollment | Danh sách điểm danh sinh viên trong từng lớp học phần (Roster). | `member_id` | `class_id` $\rightarrow$ `classes`<br>`user_id` $\rightarrow$ `users`<br>`UNIQUE(class_id, user_id)` |
| **5** | `assignments` | Academic & Grading | Đề bài thực hành, hạn nộp (`due_date`), hạn ngạch tài nguyên Sandbox (RAM 512MB, CPU 2.0s), ngôn ngữ cho phép. | `assignment_id` | `class_id` $\rightarrow$ `classes(class_id)` |
| **6** | `test_cases` | Verification Suites | Bộ test case công khai và ẩn (Input/Output, trọng số `weight`, thời gian tối đa `time_limit_ms`). | `test_case_id` | `assignment_id` $\rightarrow$ `assignments(assignment_id)` |
| **7** | `submissions` | Execution Pipeline | Ghi nhận gói code `.zip`, mã băm SHA-256 (`file_hash`), trạng thái chấm BullMQ, điểm testcase và điểm tổng kết. | `submission_id` | `assignment_id` $\rightarrow$ `assignments`<br>`student_id` $\rightarrow$ `users` |
| **8** | `submission_details` | Sandbox Execution Logs | Chi tiết kết quả chạy từng test case trong container Docker (PASS, FAIL, TLE, MLE, actual output, memory KB, error log). | `detail_id` | `submission_id` $\rightarrow$ `submissions`<br>`test_case_id` $\rightarrow$ `test_cases` |
| **9** | `ai_review_results` | GenAI Hub Review | Điểm Clean Code, điểm SOLID (0.0 - 10.0), số lượng code smells, giải thích lỗi crash Socratic từ LLM. | `review_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **10** | `ast_fingerprints` | AST Winnowing Hashes | Dấu vân tay số k-gram sinh ra từ cây cú pháp trừu tượng AST (vị trí token, dòng code, node type). | `fingerprint_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **11** | `plagiarism_reports` | Fraud Detection | Báo cáo đối sánh độ tương đồng cặp bài nộp (A và B), tỷ lệ trùng lặp %, gắn cờ gian lận (`flagged_as_fraud`). | `report_id` | `submission_a_id`, `submission_b_id` $\rightarrow$ `submissions`<br>`assignment_id` $\rightarrow$ `assignments` |
| **12** | `appeals` | Grade Dispute Workflow | Đơn khiếu nại/phúc khảo điểm của sinh viên (`reason`), trạng thái (`PENDING/ACCEPTED/REJECTED`), giảng viên thụ lý. | `appeal_id` | `submission_id` $\rightarrow$ `submissions`<br>`student_id`, `reviewer_id` $\rightarrow$ `users` |
| **13** | `teamwork_metrics` | Git Free-Rider Audit | Phân tích đóng góp qua Git commit, LOC thêm/xóa, % đóng góp của sinh viên để phát hiện "người đi nhờ xe" (free-rider). | `metric_id` | `class_id` $\rightarrow$ `classes`<br>`student_id` $\rightarrow$ `users`<br>`UNIQUE(class_id, student_id)` |

---

## 2. Bảng Hạ Tầng Bổ Trợ (Auxiliary Infrastructure Tables)

Nhằm đảm bảo tính chịu lỗi (Fault Tolerance) và khả năng quản lý động cho hệ thống Microservices:

| STT | Tên Bảng | Phân Hệ | Mục Đích Sử Dụng |
|:---:|:---|:---|:---|
| **14** | `dead_letter_jobs` | BullMQ Queue | Lưu trữ các tác vụ chấm bài thất bại quá 3 lần retry (Exponential Backoff), phục vụ cơ chế replay và giám sát lỗi. |
| **15** | `ai_prompt_templates` | GenAI Hub | Quản lý phiên bản System Prompts, JSON Schema và cấu hình nhiệt độ (Temperature) mà không cần deploy lại code. |

---

## 3. Khởi Chạy Cơ Sở Dữ Liệu 1-Click

### Với Docker Compose:
```bash
docker compose up -d
```
Docker sẽ khởi tạo PostgreSQL 15 trên cổng `5432` và tự động thực thi nạp toàn bộ cấu trúc 13 bảng SRS kèm dữ liệu mẫu từ [`database/init_all_13_tables.sql`](file:///database/init_all_13_tables.sql).

---

## 4. Dual-Mode Layered Data Layer (JSON fallback + PostgreSQL durable store)

### 4.1. Two modes, one code path

The `api-gateway` data layer is layered and runs in exactly one of two modes at runtime,
chosen automatically by `PostgresService` on boot. No code change, no config flag and no
restart are required to switch between them.

| Mode | Trigger | Behaviour |
|:---|:---|:---|
| **PostgreSQL mode** | A PostgreSQL server answers at `POSTGRES_HOST:POSTGRES_PORT` | JSON file store stays the source of truth for the demo, and every write is mirrored write-through to PostgreSQL, which is the durable store of record. Boot hydration also merges PostgreSQL rows into memory. |
| **JSON fallback mode** | No PostgreSQL reachable (connection refused, timeout, wrong credentials, server down) | The JSON file store under `api-gateway/data/*.json` serves every read and write. The app boots and all endpoints work with zero external services. |

The whole system therefore works with **no** PostgreSQL, Redis or Docker installed, and it
**activates real PostgreSQL behaviour automatically** as soon as a database becomes reachable.
A PostgreSQL outage can never break a request: every Postgres call is wrapped so that a
failure only logs a `Logger.warn` line and the JSON path still succeeds.

### 4.2. JSON fallback (always available)

Each repository owns one JSON file in `api-gateway/data/`:

| Repository | JSON file | PostgreSQL table |
|:---|:---|:---|
| `user.repository.ts` | `users_store.json` | `users` |
| `course.repository.ts` | `courses_store.json` | `classes` (+ `class_members`) |
| `assignment.repository.ts` | `assignments_store.json` | `assignments` |
| `test-case.repository.ts` | `test_cases_store.json` | `test_cases` |
| `submission.repository.ts` | `submissions_store.json` | `submissions` |
| `appeal.repository.ts` | `appeals_store.json` | `appeals` |
| `teamwork.repository.ts` | `teamwork_store.json` | `teamwork_metrics` |
| `dlq.repository.ts` | `dlq_store.json` | `dead_letter_jobs` |

The JSON files are the demo/offline source of truth. Records that only exist in JSON are
never lost when PostgreSQL hydration runs - hydration **merges**, and on a key conflict the
PostgreSQL row wins because it is the durable store.

### 4.3. PostgreSQL durable store and boot hydration

`api-gateway/src/database/postgres.service.ts` performs, in order, on `onModuleInit`:

1. Connect a `pg.Pool` (`connectionTimeoutMillis: 2000`, `max: 10`).
2. Read the existing table list from `pg_tables WHERE schemaname = 'public'`.
3. If the table count is below the expected 15 (13 SSOT entities + `dead_letter_jobs` +
   `ai_prompt_templates`), bootstrap the schema from `init_all_13_tables.sql`.
4. Re-query `pg_tables` to **verify** the result, log the actual table list and count, and
   log an explicit warning listing every expected table that is still missing.

Schema file resolution tries three candidate paths in order and uses the first one that
exists, so the bootstrap works regardless of the working directory (`api-gateway`, repo
root, or a compiled `dist` layout):

```
<process.cwd()>/database/init_all_13_tables.sql
<process.cwd()>/../database/init_all_13_tables.sql
<__dirname>/../../../database/init_all_13_tables.sql
```

The path that was used is logged. If none exists, a clear `Logger.error` is emitted and the
gateway continues in JSON fallback mode.

### 4.4. Transactional schema bootstrap

The whole bootstrap runs inside a single transaction on a dedicated pooled client:

```
BEGIN -> run init_all_13_tables.sql -> COMMIT
                                     \-> ROLLBACK on any error
```

Because a partial schema can therefore never be left behind, and because every statement in
the SQL file is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
`INSERT ... ON CONFLICT DO NOTHING`, the script is idempotent and safe to re-run on every
boot. `UserRepository.createBatchTransactional` applies the same `BEGIN` / `COMMIT` /
`ROLLBACK` discipline to a multi-row user insert (UC-02 / R06), after its existing in-memory
pre-validation.

### 4.5. Diagnostics

`PostgresService` exposes two health helpers:

- `getDiagnostics()` returns `{ connected, host, port, database, poolTotal, poolIdle, poolWaiting }`
  built from the pool's `totalCount` / `idleCount` / `waitingCount`. It returns safe zeros when
  disconnected (the constructor config values are kept in fields).
- `ping()` returns `false` instead of throwing when PostgreSQL is unavailable.

### 4.6. Running the schema evidence script (no database required)

`database/verify_schema.ts` is a standalone parser that reads `init_all_13_tables.sql`
(resolved relative to its own `__dirname`, so it is path-independent) and asserts table
count, `PRIMARY KEY` coverage, `REFERENCES ... FOREIGN KEY` count, dangling references, the
13 SSOT entity tables from `GEMINI.md`, and duplicate column names. It prints one
`[PASS]` / `[FAIL]` line per assertion plus a normalisation evidence section, and exits `1`
on any failure. Output is plain ASCII.

```bash
# from the repository root
npx ts-node database/verify_schema.ts
```

The repository root has no `node_modules` of its own (dependencies were installed only under
`api-gateway/`), so the root `tsconfig.json` and a thin `node_modules/.bin/ts-node` shim were
added; the shim reuses the `ts-node` / `typescript` already installed in `api-gateway/`.
`api-gateway/tsconfig.json` is untouched and still governs the gateway build.

If that shim is unavailable, run the script through the gateway toolchain or pin the
versions explicitly:

```bash
# option A: reuse the ts-node already installed inside api-gateway
cd api-gateway
npx ts-node --transpile-only ../database/verify_schema.ts

# option B: pin versions at the repository root
npx --yes -p typescript@5.9.3 -p ts-node@10.9.2 ts-node --transpile-only database/verify_schema.ts
```

Expected evidence numbers: 15 tables, 15 `PRIMARY KEY` declarations, 21
`REFERENCES ... FOREIGN KEY` relations, 0 dangling references, 13/13 SSOT tables present,
0 duplicate columns.

### 4.7. Running the gateway against a real PostgreSQL server

Environment variables consumed by `PostgresService` (defaults in parentheses):

| Variable | Default |
|:---|:---|
| `POSTGRES_HOST` | `localhost` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_USER` | `aita_admin` |
| `POSTGRES_PASSWORD` | `aita_secret_password` |
| `POSTGRES_DB` | `aita_autograding` |

Start PostgreSQL:

```bash
# from the repository root
docker compose up -d postgres
```

Then boot the gateway and let the transactional bootstrap run:

```bash
# PowerShell
$env:POSTGRES_HOST="localhost"; $env:POSTGRES_PORT="5432"
$env:POSTGRES_USER="aita_admin"; $env:POSTGRES_PASSWORD="aita_secret_password"
$env:POSTGRES_DB="aita_autograding"
cd api-gateway
npx ts-node src/main.ts
```

```bash
# bash
export POSTGRES_HOST=localhost POSTGRES_PORT=5432
export POSTGRES_USER=aita_admin POSTGRES_PASSWORD=aita_secret_password
export POSTGRES_DB=aita_autograding
cd api-gateway && npx ts-node src/main.ts
```

On boot the log reports the resolved schema path, the table count before and after the
bootstrap, the final table list, and any still-missing expected tables. To reload the schema
manually against a reachable server:

```bash
psql -h localhost -p 5432 -U aita_admin -d aita_autograding -f database/init_all_13_tables.sql
```

Re-running it is safe because every statement is idempotent.
