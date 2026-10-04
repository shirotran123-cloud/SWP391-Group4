# Workflow 1 (UC-08) integration notes

Owner: exams slice. **Do not** edit `src/app.module.ts` here — the integrator applies the lines below.

## 1. Add the import (top of `api-gateway/src/app.module.ts`, with the other module imports)

```ts
import { ExamsModule } from './exams/exams.module';
```

## 2. Register the module (one line inside the `imports: [...]` array)

```ts
    ExamsModule,
```

Recommended placement: immediately after `TestCasesModule,`.

## 3. Registration line the integrator must add (exact, one line)

```ts
    ExamsModule,
```

## Wiring notes

- `DatabaseModule` is `@Global()` and already exports `AssignmentRepository`, `TestCaseRepository` and `PostgresService`; `ExamsModule` does **not** need to import it.
- `ExamsModule` imports `TestCasesModule` because that module exports `TestCasesService` (used to persist generated test cases with duplicate detection).
- No new npm dependency is required. `@nestjs/testing` is **not** in `node_modules`, so the regression suite uses `NestFactory.createApplicationContext` over `[DatabaseModule, ExamsModule]` when `@nestjs/testing` is absent; it prefers `Test.createTestingModule` whenever the package is present.

## Endpoints exposed

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/exams/generate` | Generate **and persist** the assignment + all test cases. HTTP 201. |
| `POST` | `/api/v1/exams/preview` | Generate only, no persistence. HTTP 200. |
| `GET` | `/api/v1/exams/health` | `{ statusCode, data: { hub: 'UP'\|'DOWN', offlineFallbackAvailable: true } }`. |

All three use the project's `{ statusCode, message?, data }` response envelope.

## Environment

- GenAI Hub base URL: `GENAI_HUB_URL` (default `http://localhost:3001`).
- With the hub unreachable, the gateway transparently falls back to a deterministic local generator (`source: 'LOCAL_DETERMINISTIC'`); no LLM key, network, Docker, Redis or PostgreSQL is required.

## Regression suite

```
npx ts-node --transpile-only test/exams-workflow1.test.ts
```
