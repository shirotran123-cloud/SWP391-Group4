# INTEGRATION NOTES — Workflow 2 Step 6 (REAL AST/Winnowing Plagiarism Detection)

Owner of this module: plagiarism workstream. **Do not edit the files listed below from another
workstream** — the integrator applies the wiring only.

Files this workstream owns (already created, do not modify):
`api-gateway/src/plagiarism/*`, `api-gateway/src/database/plagiarism.repository.ts`,
`api-gateway/src/database/plagiarism-report.entity.ts`,
`api-gateway/src/database/ast-fingerprint.entity.ts`, `api-gateway/test/plagiarism-ast.test.ts`.

---

## 1. `api-gateway/src/app.module.ts`

Add exactly two lines.

**Line 1 — add to the import block** (after `import { InternalEventsController } from './internal/internal-events.controller';`):

```ts
import { PlagiarismModule } from './plagiarism/plagiarism.module';
```

**Line 2 — add to the `imports: [...]` array** (after `SandboxModule,`):

```ts
    PlagiarismModule,
```

Resulting diff:

```diff
 import { InternalEventsController } from './internal/internal-events.controller';
+import { PlagiarismModule } from './plagiarism/plagiarism.module';
@@
     TeamworkModule,
     SandboxModule,
+    PlagiarismModule,
   ],
```

## 2. `api-gateway/src/database/database.module.ts` — NO CHANGE NEEDED

`DatabaseModule` is already `@Global()`. `PlagiarismModule` declares `PlagiarismRepository` as its
own provider, and it resolves `PostgresService` from the global `DatabaseModule` automatically.

If the integrator prefers `PlagiarismRepository` to live in `DatabaseModule` instead (mirroring
`AppealRepository`), then add these lines there **and** remove `PlagiarismRepository` from the
`providers`/`exports` arrays of `plagiarism.module.ts`:

```ts
import { PlagiarismRepository } from './plagiarism.repository';
// providers: [ ...existing, PlagiarismRepository ],
// exports:   [ ...existing, PlagiarismRepository ],
```

Both layouts compile and behave identically; pick one, not both.

---

## 3. `api-gateway/src/queue/grading-worker.consumer.ts` (owned by another workstream)

### 3a. Import

```ts
import { PlagiarismService } from '../plagiarism/plagiarism.service';
```

### 3b. Constructor injection

```ts
  constructor(
    private readonly queueService: QueueService,
    private readonly gradingGateway: GradingGateway,
    private readonly submissionRepo: SubmissionRepository,
    private readonly sandboxService: SandboxService,
    private readonly plagiarismService: PlagiarismService,   // <-- ADD
  ) {}
```

### 3c. Replace the Step 6 stub (currently lines ~397-412)

```ts
    // BƯỚC 6: AST Plagiarism – Winnowing Fingerprinting
    // ═══════════════════════════════════════════════════════════════════════════
    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '6', stepName: 'Phân tích AST & Winnowing',
      status: 'in_progress', detail: 'Chuẩn hóa AST token, đối chiếu kho bài nộp cục bộ...',
    });
    await sleep(400);

    // REAL AST/Winnowing detection. Never throws: returns comparedCount 0 + topMatch null
    // when there are no peers, and degrades to LOCAL_AST_ENGINE when the GenAI Hub is offline.
    const plagiarismResult = await this.plagiarismService.detectForSubmission({
      submissionId,
      studentId,
      assignmentId,
      language,
      sourceCode,
    });

    const plagiarismMatch: GradingCompletedPayload['plagiarismMatch'] =
      plagiarismResult.topMatch
        ? {
            matchedStudentName: plagiarismResult.topMatch.matchedStudentName,
            matchedStudentId: plagiarismResult.topMatch.matchedStudentId,
            similarityRate: plagiarismResult.topMatch.similarityRate,
            sourceCodeA: plagiarismResult.topMatch.sourceCodeA,
            sourceCodeB: plagiarismResult.topMatch.sourceCodeB,
            matchedTokens: plagiarismResult.topMatch.matchedTokens,
          }
        : null;

    this.gradingGateway.emitGradingProgress({
      submissionId, stepId: '6', stepName: 'Phân tích AST & Winnowing',
      status: 'passed',
      detail: plagiarismResult.topMatch
        ? `Hoàn tất phân tích AST (${plagiarismResult.engine}, ${plagiarismResult.comparedCount} bài đối chiếu). ` +
          `Trùng khớp cao nhất ${plagiarismResult.topMatch.similarityRate}% với ${plagiarismResult.topMatch.matchedStudentName}` +
          `${plagiarismResult.topMatch.isFlagged ? ' — NGHI VẤN ĐẠO VĂN!' : ''}.`
        : `Hoàn tất phân tích AST. Kho bài nộp cục bộ hiện tại chưa có bài trùng khớp (${plagiarismResult.comparedCount} bài đối chiếu).`,
    });
```

`submissionId`, `studentId`, `assignmentId`, `language`, `sourceCode` are all already in scope at
that point in `processSubmission`. Add `GradingCompletedPayload` to the existing
`../websocket/grading.gateway` import if it is not already there.

### 3d. Downstream (no change needed)

`plagiarismMatch` continues to flow untouched into:

```ts
      plagiarismMatch,
      completedAt: new Date().toISOString(),
    };
    await this.submissionRepo.updateStatus(submissionId, SUBMISSION_STATUS.COMPLETED, completedPayload, finalScore);
    this.gradingGateway.emitGradingCompleted(completedPayload);
```

---

## 4. Call signature + payload mapping

```ts
public async detectForSubmission(params: {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;    // 'python' | 'java' | 'cpp' | 'dotnet' (any case)
  sourceCode: string;  // already-extracted source, NOT a zip path
}): Promise<PlagiarismDetectionResult>
```

```ts
export interface PlagiarismDetectionResult {
  submissionId: string;
  comparedCount: number;     // peer submissions that existed AND were compared
  reportsPersisted: number;  // one canonical row per compared pair
  fingerprintsStored: number;
  topMatch: {
    matchedStudentName: string;   // UserRepository.fullName (falls back to studentId)
    matchedStudentId: string;     // peer studentId
    similarityRate: number;       // 0..100, ensemble
    sourceCodeA: string;          // ALWAYS the submission under analysis
    sourceCodeB: string;          // ALWAYS the matched peer
    matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
    isFlagged: boolean;           // similarityRate >= 70
    status: string;               // 'CLEAN' | 'SUSPECTED' | 'FLAGGED_PLAGIARISM'
    jaccardSimilarity: number;
    winnowingContainment: number;
    astStructuralSimilarity: number;
  } | null;
  engine: 'GENAI_HUB_HTTP' | 'LOCAL_AST_ENGINE';
  executionTimeMs: number;
}
```

### Mapping to `GradingCompletedPayload.plagiarismMatch` (in `api-gateway/src/websocket/grading.gateway.ts`)

| payload field | source |
| --- | --- |
| `matchedStudentName` | `result.topMatch.matchedStudentName` |
| `matchedStudentId` | `result.topMatch.matchedStudentId` |
| `similarityRate` | `result.topMatch.similarityRate` |
| `sourceCodeA` | `result.topMatch.sourceCodeA` (current submission) |
| `sourceCodeB` | `result.topMatch.sourceCodeB` (peer) |
| `matchedTokens[].lineA` | `result.topMatch.matchedTokens[].lineA` — already `[startLine, endLine]` |
| `matchedTokens[].lineB` | `result.topMatch.matchedTokens[].lineB` — already `[startLine, endLine]` |

`topMatch` is `null` when `comparedCount === 0` — pass `null` through so the websocket payload and
`SubmissionRepository.details` keep the existing `plagiarismMatch: null` contract.

Extra fields (`isFlagged`, `status`, `jaccardSimilarity`, `winnowingContainment`,
`astStructuralSimilarity`) are returned for the REST endpoints and for logging; they are **not**
part of the `GradingCompletedPayload` type and must not be spread into it.

---

## 5. HTTP surface (already mounted by `PlagiarismModule`)

| method | route | role guard |
| --- | --- | --- |
| POST | `/api/v1/plagiarism/analyze/:submissionId` | body `{ role }`; `STUDENT` -> 403 |
| GET | `/api/v1/plagiarism/assignment/:assignmentId/matrix` | `?role=`; `STUDENT` -> 403 |
| GET | `/api/v1/plagiarism/reports?assignmentId=&flaggedOnly=&limit=&role=` | `?role=`; `STUDENT` -> 403 |
| GET | `/api/v1/plagiarism/fingerprints/:submissionId?role=` | `?role=`; `STUDENT` -> 403 |

403 message is exactly `Báo cáo đạo văn chỉ dành cho Giảng viên/HOD (BR-04).` (business rule BR-04).

---

## 6. Fallback chain

1. `PlagiarismRepository` / `PostgresService` → JSON `data/plagiarism_store.json` when Postgres is
   offline; write-through to `ast_fingerprints` + `plagiarism_reports` when available.
2. `POST http://localhost:3001/api/v1/ast/matrix` with `AbortSignal.timeout(4000)` → on transport
   error, non-200, or malformed body, fall back to the in-process mirror
   `api-gateway/src/plagiarism/ast-plagiarism.engine.ts` and report `engine: 'LOCAL_AST_ENGINE'`.

Both engines are the same algorithm (k=5, w=3, FNV-1a winnowing; ensemble
`0.65 * containment + 0.35 * AST cosine`, flag ≥ 70%), so results are identical either way.
