# SWP391-Group4 AITA-Intelligent — Master Project Context & AI Guidance


Các thành viên trong nhóm:

Nguyễn Hoàng Vinh

Văn Thái Trung

Đinh Thành Trung

Trần Công Tiến

Trần Thanh Nguyên

---

## Milestone 2 — Documentation

| Document | Purpose |
|:---|:---|
| [docs/MILESTONE_2_RUBRIC_EVIDENCE.md](docs/MILESTONE_2_RUBRIC_EVIDENCE.md) | **Rubric-by-rubric acceptance evidence**: the exact command run for every criterion, the observed result, the 9 real defects found and fixed, and an honest list of what could *not* be verified (no Docker/Redis/PostgreSQL/LLM keys on the review machine) |
| [MILESTONE_2_COMPLETION_REPORT.md](MILESTONE_2_COMPLETION_REPORT.md) | Vietnamese technical completion report and P2P defence script |
| [docs/SRS_AITA_Group4.md](docs/SRS_AITA_Group4.md) | IEEE 830-1998 software requirements specification |
| [docs/SDD_ERD_AITA_Group4.md](docs/SDD_ERD_AITA_Group4.md) | System design document and ERD |
| [docs/IEEE_RBL_AST_Winnowing_Paper.md](docs/IEEE_RBL_AST_Winnowing_Paper.md) | RBL research paper on AST + Winnowing plagiarism detection |
| [GEMINI.md](GEMINI.md) | Project SSOT rules: 13 database entities, 12 use cases, business rules |

## Quick start (works fully offline)

```bash
npm install --prefix api-gateway
npm install --prefix genai-hub
npm install --prefix sandbox/worker
npm install --prefix frontend

npm run start:gateway   # NestJS API Gateway + Socket.IO  -> http://localhost:3000
npm run start:ai        # GenAI Hub & AST engine          -> http://localhost:3001
npm run start:ui        # React 19 client (Vite)          -> http://localhost:5173
```

Docker / Redis / PostgreSQL are **optional**. Without them the platform automatically uses the
resilient sandbox fallback engine, an in-memory queue, and JSON file stores, so every demo and
test still runs. `npm run db:up` starts PostgreSQL 15 + Redis 7 via `docker-compose.yml` when
those services are available.

## Verification commands

```bash
npm run verify:schema                                        # 15 tables, 15/15 PK, 21 FK, 13/13 SSOT
cd api-gateway && npx ts-node --transpile-only test/run-coverage-all.ts
cd genai-hub   && npm test && npx ts-node test/run-ast-benchmark.ts
cd sandbox/worker && npx ts-node --transpile-only test-exception-paths.ts
npm run build --prefix frontend
```

