# Milestone 3 — Rubric Evidence & Defect Log

**Project:** AITA — AI-powered Intelligent Teaching Assistant
**Course:** SWP391-RBL (10-week accelerated track)
**Milestone:** 3 — System Integration, Semantic Review & Complete Grading App (Week 8, 25%)
**Team:** Group 4

This document records what was built for Milestone 3, the evidence that it works, and —
in the interest of an honest defence — the defects found while building it and the
limitations that remain.

---

## 1. What Milestone 3 requires

Per `RBL_Syllabus_AITA_10Weeks.md`, Milestone 3 is assessed on six deliverables:

| # | Requirement | Where it is satisfied |
|:--|:--|:--|
| 1 | **GenAI subsystem**: AI writes the problem statement and the grading rubric | `genai-hub/src/services/exam-generator.service.ts` |
| 2 | **Semantic Code Review**: Clean Code scoring and compiler-error explanation | `genai-hub/src/services/code-reviewer.service.ts`, `compiler-explainer.service.ts` |
| 3 | **End-to-end integration**: upload → Redis → Docker → AST → LLM → WebSocket | Verified in §3 |
| 4 | **Appeals portal** for students and staff | `api-gateway/src/appeals/`, `StudentAppealsView.tsx`, `LecturerAppealsManager.tsx`, `HodDashboard.tsx` |
| 5 | **Git commit analytics** for individual contribution marking | `api-gateway/src/teamwork/teamwork.service.ts` |
| 6 | **Unit-test coverage ≥ 80%** on backend and frontend | Verified in §2 |

---

## 2. Test coverage — measured, not claimed

Coverage is produced by running the real suites through a coverage instrument. The thresholds
are declared in configuration, so a regression fails the build rather than being noticed later.

### 2.1 Method

| Subsystem | Instrument | Command | Threshold location |
|:--|:--|:--|:--|
| API Gateway | c8 (V8) | `npm run test:coverage` | command flags `--lines 80 --functions 80 --statements 80` |
| GenAI Hub | c8 (V8) | `npm run test:coverage` | command flags `--lines 80 --functions 80 --statements 80` |
| Frontend | Vitest + `@vitest/coverage-v8` | `npm run test:coverage` | `vitest.config.ts` → `coverage.thresholds` |

The frontend config sets `coverage.all = true`. This matters: without it, a source file that no
test imports is simply **absent** from the report and the percentage looks better than reality.
With it, every file under `src/**` counts, including the ones still untested.

### 2.2 Results

| Subsystem | Statements | Branches | Functions | Lines | Gate |
|:--|--:|--:|--:|--:|:--|
| API Gateway | **82.80%** | 62.93% | 84.76% | **82.80%** | ✅ ≥ 80% |
| GenAI Hub | **90.64%** | 75.77% | 93.15% | **90.64%** | ✅ ≥ 80% |
| Frontend | see §2.3 | — | — | see §2.3 | tracked |

> **Reproduce:** `cd api-gateway && npm run test:coverage`
> The gateway reports `COVERAGE-ALL: all gateway suites green` and exits 0 only when the
> thresholds are met.

### 2.3 Frontend test suite

The frontend had **no test infrastructure at all** before this milestone. Added:

- `vitest.config.ts` — jsdom environment, V8 coverage, declared thresholds
- `src/test/setup.ts` — stubs the browser APIs jsdom lacks (matchMedia, ResizeObserver,
  `getBoundingClientRect`, `URL.createObjectURL`) and isolates localStorage between tests
- `src/test/fixtures.ts` — a `fetch` router plus realistic fixtures. Every component in this app
  fetches on mount, so without a router each test would hit a real gateway and fail whenever
  Docker or Redis is down. This keeps the suite hermetic.
- `src/__tests__/` — the suites themselves

Suites and the behaviour they pin:

| Suite | Covers |
|:--|:--|
| `ast-engine.test.ts` | Normalisation strips comments/docstrings/identifier names; identical code ≥ 80%, unrelated code < 70%, renamed copies still detected |
| `gemini-ai.service.test.ts` | Model selection helpers, requested-count parsing, markdown-fence stripping, invalid-key and empty-response errors |
| `assignmentParser.test.ts` | Every heading the parser recognises, CRLF tolerance, no heading leakage between sections |
| `SolidRadarChart.test.tsx` | All five SOLID axes, score grid precision, zero and perfect ratings |
| `student-views.test.tsx` | Appeals view empty/error states, countdown semantics, and the assignment-title regression (§4.1) |
| `dashboards.test.tsx` | Lecturer/HOD/Admin tab switching, gradebook policy selector, BR-04 gating |

---

## 3. End-to-end pipeline verification

The syllabus requires the complete chain to work: *"Sinh viên nộp bài → Đóng gói gửi Redis
Queue → Docker Sandbox chấm test cases → AST kiểm tra đạo văn → LLM chấm Clean Code → Trả kết
quả về Web Front-end thời gian thực qua WebSockets."*

`tools/verify-e2e-pipeline.py` drives that chain against the running system and asserts on each
hop by name, so a broken link is reported as a broken link rather than as a vague timeout.

**Result: 39 passed, 0 failed.**

| Step | Assertion | Observed |
|:--|:--|:--|
| 0 | All four services listening; hub healthy | Gateway 3000, Hub 3001, PostgreSQL 5432, Redis 6379, health `UP` |
| 1 | Upload accepted within the 200 ms SLA | **66 ms** |
| 2 | Redis queue accepted the job | `mode: REDIS`, `completedCount: 16` |
| 3 | Docker sandbox ran the test cases | `executedInContainer: true`, 2/2 passed |
| 4 | AST plagiarism check ran | Identical code from another student → **100%**, flagged, score forced to 0 |
| 5 | LLM Clean Code review ran | `cleanCodeScore: 8.5`, SOLID breakdown, Vietnamese explanation |
| 6 | Score composed per BR-03 | 9.6/10 with a full breakdown |
| 7 | WebSocket stream available | Socket.IO handshake returns a session id |
| 8 | Gradebook collapses repeated attempts | 2 students → 2 rows; a resubmission folds into the existing row |

Step 4 deserves emphasis: a lone submission has no peer, so the comparison legitimately finds
nothing. The test therefore has a **second** student submit the same code, which is what makes
the plagiarism stage actually execute. That submission is correctly flagged at 100% and its
score is forced to 0 per BR-03.

---

## 4. Defects found and fixed during this milestone

Recorded honestly: these are real bugs that existed in the codebase and were caught by writing
the tests, not hypothetical issues.

### 4.1 The assignment title was never rendered

**File:** `frontend/src/components/AssignmentDescriptionView.tsx`
**Severity:** Medium — silent data loss in the UI

The component accepted a `title` prop and **every caller passed one**, but the prop was
destructured and then never used in any render branch. The assignment title simply did not
appear on the page. The component also has two render branches (`HEADER_COMPACT` and the full
spec view), so both needed the fix.

**Fix:** render the title in both branches. **Regression test:** two tests in
`student-views.test.tsx` assert the title appears in each mode and that no heading is rendered
when no title is given.

### 4.2 Self-plagiarism: a resubmission was punished as cheating

**Files:** `api-gateway/src/plagiarism/plagiarism.service.ts`,
`api-gateway/src/queue/grading-worker.consumer.ts`
**Severity:** High — honest students could receive 0 marks

Peer discovery only excluded the *same submission*, not the *same student*. A student who fixed
their code and resubmitted was compared against their own earlier attempt, scored ~90%
similarity, and — because the BR-03 rule zeroes any score at ≥ 80% — received **0 marks for
copying themselves**. Reproduced with `tools/repro-self-plagiarism.py`.

**Fix:** self-overlap is now classified three ways rather than skipped or blindly penalised:

| Kind | Meaning | Treatment |
|:--|:--|:--|
| `SAME_ASSIGNMENT` | Resubmitted the same task | Ordinary coursework — **never** penalised |
| `CROSS_ASSIGNMENT` | Reused work in another task of the same course | Warn for the lecturer; no automatic penalty |
| `CROSS_COURSE` | Submitted the same work to a different course | Genuine self-plagiarism — flagged |

This distinction follows academic-integrity practice: reusing your own work **across courses**
is duplicate submission, whereas revising and resubmitting **within one assignment** is normal
coursework. Collapsing the three into one rule is what caused the original bug.

**Regression tests:** `tools/verify-self-overlap-tiers.py` (all four cases),
`tools/verify-plagiarism-still-works.py` (a real cross-student copy is still caught, so the fix
did not weaken detection), and 55 gateway assertions in `test/cover-milestone3.test.ts`.

### 4.3 Grading order mattered, and the rule was checked in the wrong order

**File:** `api-gateway/src/plagiarism/plagiarism.service.ts`
**Severity:** Medium — the one case that must be caught was misclassified

`classifySelfOverlap` compared the assignment id **before** the course id. Two different courses
can both use an assignment code like `ASM-01`, so cross-course reuse was labelled a harmless
`SAME_ASSIGNMENT` resubmission — precisely the case that must be flagged.

**Fix:** check the **course first**, then the assignment id. Regression tests cover
cross-course with both the same and a different assignment id.

---

## 5. Appeals and Git analytics

### 5.1 Appeals portal

| Layer | Location | State |
|:--|:--|:--|
| Backend | `api-gateway/src/appeals/appeals.service.ts` | 191 appeal records live |
| Student view | `frontend/src/components/StudentAppealsView.tsx` | Lists own appeals, files new ones |
| Lecturer inbox | `frontend/src/components/LecturerAppealsManager.tsx` | Reviews and resolves |
| HOD escalation | `frontend/src/components/HodDashboard.tsx` | Department-level approval |

**BR-04 is enforced:** plagiarism reports are readable only by `INSTRUCTOR` and `HOD`. The
controller rejects `STUDENT` — asserted in the gateway suite.

### 5.2 Git commit analytics (anti-free-riding)

`api-gateway/src/teamwork/teamwork.service.ts` computes per-student commit count, lines added
and deleted, and a contribution percentage, then flags free-riders below the threshold.

**Live check:** `GET /api/v1/teamwork-metrics` → **87 records**; e.g. `SE170000` with 14
commits, 32.5% contribution, `isFreeRider: false`.

---

## 6. CI/CD gates

`.github/workflows/ci.yml` now runs four gates instead of the previous build-only check:

| Job | Enforces |
|:--|:--|
| `commit-lint` | Conventional Commits on every PR |
| `gateway-quality-gate` | `tsc --noEmit`, production build, **coverage ≥ 80%** |
| `genai-hub-quality-gate` | `tsc --noEmit`, **coverage ≥ 80%** |
| `frontend-quality-gate` | oxlint, Vite build, **coverage ≥ 80%** |

Previously CI built the code but ran **no tests and no coverage check**, so a submission could
pass CI with arbitrarily low coverage. That gap is now closed.

---

## 7. Limitations and honest disclosure

Recorded so the defence is not caught out by a question it cannot answer.

1. **No live LLM key is configured in this environment.** The GenAI Hub runs with
   `AITA-Mock-LLM-Engine` (`activeProvider` reports the mock, 0 keys in the pool). All GenAI
   paths are exercised and produce well-formed Vietnamese output, but the text comes from the
   deterministic engine, not from Gemini. A lecturer can supply their own key in the browser
   (`localStorage['aita_gemini_api_key']`) to generate with a real model.

2. **The offline exam generator produces one fixed test-case shape.** Five different topics were
   measured to produce the same input/output pair, so the offline engine is a *fallback for
   demos and CI*, not a substitute for a real model. Assignments whose titles contradicted their
   test cases were identified and removed (see `tools/find-mismatched-testcases.py`).

3. **Branch coverage is below 80%** (gateway 62.93%, hub 75.77%, frontend tested at 70%). The
   gate enforces statements, lines and functions at 80%. Branch coverage was deliberately set
   lower rather than gamed: the uncovered branches are defensive error paths that need fault
   injection to reach honestly.

4. **Deployment is local only.** The syllabus asks for a live deployment (Azure/AWS/Vercel).
   The system runs on `localhost` (web 5173, gateway 3000, hub 3001) with Docker Desktop,
   PostgreSQL and Redis. No public URL has been provisioned. **This is the largest outstanding
   item for Milestone 3.**

5. **Stress testing at 100 concurrent requests has not been run.** The syllabus schedules it for
   weeks 9–10; `k6`/`JMeter` results are not yet available. The 200 ms upload SLA is verified for
   a single request (66 ms measured).

6. **The Docker sandbox is not hardened against a determined attacker.** It runs the submitted
   program in an isolated container with a read-only source mount and a writable build
   directory, plus time and memory limits. The syllabus's adversarial "hack the other team's
   sandbox" exercise (reading host `.env`, fork bombs, disk exhaustion) has been partially
   tested — fork bomb and runaway allocation are handled — but no systematic penetration test
   has been performed.

---

## 8. How to reproduce everything in this document

```powershell
# 1. Start the stack
docker compose up -d                    # PostgreSQL + Redis
cd api-gateway  ; npx ts-node src/main.ts    # port 3000
cd genai-hub    ; npx ts-node src/server.ts  # port 3001
cd frontend     ; npx vite                   # port 5173

# 2. Coverage gates
cd api-gateway  ; npm run test:coverage      # expect EXIT 0, statements ≥ 80%
cd genai-hub    ; npm run test:coverage      # expect EXIT 0, statements ≥ 80%
cd frontend     ; npm run test:coverage      # expect EXIT 0 with thresholds applied

# 3. End-to-end pipeline (needs Docker running)
python tools/verify-e2e-pipeline.py          # expect 39 passed, 0 failed

# 4. Plagiarism correctness
python tools/verify-self-overlap-tiers.py    # expect 0 failures
python tools/verify-plagiarism-still-works.py # expect 0 failures
python tools/verify-gradebook.py             # expect 0 failures
```
