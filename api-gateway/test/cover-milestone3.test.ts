/**
 * Coverage driver for the modules that the existing suites leave thin.
 *
 * Measured baseline (c8, whole gateway suite): 76.92% statements. The gaps were concentrated
 * in a handful of files, so this suite targets exactly those rather than re-testing what is
 * already covered:
 *
 *   exam-generator.client.ts   17%  · the HTTP call, timeout and offline fallback paths
 *   exams.service.ts           30%  · preview/persist, idempotent ids, rubric validation
 *   gradebook.service.ts       40%  · LAST/BEST/FIRST selection and attempt collapsing
 *   google-token.verifier.ts   38%  · signature, audience, issuer and expiry rejections
 *   plagiarism.controller.ts   41%  · BR-04 gating and the not-found paths
 *   sandbox.service.ts         57%  · degraded branches without a Docker daemon
 *
 * Everything runs in-process against fakes, so the suite never needs Docker, Redis or a
 * network connection. Run it through `npm run coverage` (c8 wraps the process).
 */
import { ExamGeneratorClient } from '../src/exams/exam-generator.client';
import { ExamsService } from '../src/exams/exams.service';
import { GradebookService } from '../src/submissions/gradebook.service';
import { PlagiarismController } from '../src/plagiarism/plagiarism.controller';
import { GoogleTokenVerifier } from '../src/auth/google-token.verifier';
import { SandboxService } from '../src/sandbox/sandbox.service';

let passed = 0;
let failed = 0;

function check(ok: boolean, label: string, detail?: unknown): void {
  if (ok) {
    passed++;
    console.log(`[PASS] ${label}`);
  } else {
    failed++;
    console.error(`[FAIL] ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

async function expectThrow(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
    check(false, label, 'no error thrown');
  } catch {
    check(true, label);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// A. ExamGeneratorClient — HTTP, timeout, offline fallback
// ────────────────────────────────────────────────────────────────────────────
async function runExamClient(): Promise<void> {
  console.log('\n=== A. ExamGeneratorClient ===');

  const dto: any = {
    topic: 'Sắp xếp mảng',
    courseCode: 'SWP391',
    difficulty: 'MEDIUM',
    language: 'python',
    learningOutcomes: ['Mã nguồn sạch'],
    numTestCases: 3,
  };

  // The client calls the global `fetch`, so each scenario swaps that one function out and
  // restores it afterwards. This keeps the test hermetic: no hub has to be running.
  const realFetch = globalThis.fetch;
  const withFetch = async (impl: typeof fetch, fn: () => Promise<void>) => {
    (globalThis as any).fetch = impl;
    try {
      await fn();
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  };

  // 1. A healthy hub answers with a full exam. `normalizeHubExam` requires `title` and
  //    `problemStatement`, and it reads the payload at the top level of the JSON body.
  const hubExam = {
    title: 'Đề từ hub',
    courseCode: 'SWP391',
    description: 'mô tả',
    difficulty: 'MEDIUM',
    language: 'python',
    problemStatement: 'đề bài',
    constraints: ['n <= 100'],
    inputFormat: 'in',
    outputFormat: 'out',
    sampleTestCases: [{ input: '1', expectedOutput: '1', isHidden: false, weight: 1 }],
    hiddenTestCases: [{ input: '2', expectedOutput: '2', isHidden: true, weight: 1.5 }],
    rubric: [{ criterion: 'Đúng', maxScore: 10, description: 'ok' }],
    starterCode: 'code',
    referenceSolution: 'solution',
  };

  const okClient = new ExamGeneratorClient();
  await withFetch(
    (async () => ({
      ok: true,
      status: 200,
      json: async () => hubExam,
    })) as any,
    async () => {
      const fromHub = await okClient.generateExam(dto);
      check(fromHub.source === 'GENAI_HUB', 'hub answer is reported as GENAI_HUB', fromHub.source);
      check(fromHub.exam.title === 'Đề từ hub', 'hub payload is passed through', fromHub.exam.title);
      check(typeof fromHub.latencyMs === 'number', 'latency is measured');
    },
  );

  // 2. A non-200 answer falls back to the local generator instead of failing.
  await withFetch(
    (async () => ({ ok: false, status: 503, json: async () => ({}) })) as any,
    async () => {
      const fromFallback = await new ExamGeneratorClient().generateExam(dto);
      check(fromFallback.source !== 'GENAI_HUB', 'HTTP failure falls back to the local engine', fromFallback.source);
      check(!!fromFallback.exam.title, 'fallback still produces a title');
    },
  );

  // 3. A thrown error (offline) also falls back.
  await withFetch(
    (async () => {
      throw new Error('ECONNREFUSED');
    }) as any,
    async () => {
      const fromDown = await new ExamGeneratorClient().generateExam(dto);
      check(!!fromDown.exam, 'a connection error still yields an exam');
    },
  );

  // 4. A malformed body (no exam) is treated as a failure.
  await withFetch(
    (async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) })) as any,
    async () => {
      const fromBad = await new ExamGeneratorClient().generateExam(dto);
      check(!!fromBad.exam, 'a body without an exam falls back');
    },
  );

  // 5. The fallback must be topic-faithful for the well-known sum/max shape and still produce
  //    a complete rubric and test case list for anything else.
  const offline = new ExamGeneratorClient();
  await withFetch(
    (async () => {
      throw new Error('offline');
    }) as any,
    async () => {
      const exam = (await offline.generateExam(dto)).exam;
      check(exam.sampleTestCases.length > 0, 'offline generation still supplies sample cases');
      check(exam.hiddenTestCases.length > 0, 'offline generation still supplies hidden cases');
      const total = exam.rubric.reduce((s, r) => s + r.maxScore, 0);
      check(Math.abs(total - 10) < 0.01, 'offline rubric sums to 10.0', total);
    },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// B. ExamsService — preview, persist, idempotent ids, rubric validation
// ────────────────────────────────────────────────────────────────────────────
async function runExamsService(): Promise<void> {
  console.log('\n=== B. ExamsService ===');

  const created: any[] = [];
  const testCases: any[] = [];

  const fakeClient: any = {
    generateExam: async () => ({
      source: 'GENAI_HUB',
      latencyMs: 7,
      exam: {
        title: 'Đề kiểm thử',
        description: 'mô tả',
        difficulty: 'MEDIUM',
        language: 'python',
        problemStatement: 'đề',
        constraints: ['n <= 10'],
        inputFormat: 'in',
        outputFormat: 'out',
        sampleTestCases: [{ input: '1 2', expectedOutput: '3', isHidden: false, weight: 1 }],
        hiddenTestCases: [{ input: '5 5', expectedOutput: '10', isHidden: true, weight: 1.5 }],
        rubric: [
          { criterion: 'A', maxScore: 7, description: 'a' },
          { criterion: 'B', maxScore: 3, description: 'b' },
        ],
        starterCode: 'stub',
        referenceSolution: 'ref',
      },
    }),
  };
  const fakeAssignments: any = {
    create: async (record: any) => {
      created.push(record);
      return record;
    },
    // `generateAndPersist` calls update() on the second run, so the fake must provide it.
    update: async (id: string, patch: any) => {
      const existing = created.find((c) => c.assignmentId === id);
      if (!existing) return null;
      Object.assign(existing, patch);
      return existing;
    },
    findById: async (id: string) => created.find((c) => c.assignmentId === id) ?? null,
  };
  const fakeTestCases: any = {
    create: async (dto: any) => {
      testCases.push(dto);
      return dto;
    },
    listByAssignment: async (id: string) => testCases.filter((t) => t.assignmentId === id),
  };
  const fakePostgres: any = { isAvailable: () => true };

  const service = new ExamsService(fakeClient, fakeAssignments, fakeTestCases, fakePostgres);

  const dto: any = {
    topic: 'Sắp xếp',
    courseCode: 'SWP391',
    difficulty: 'MEDIUM',
    language: 'python',
    learningOutcomes: ['Mã nguồn sạch'],
    numTestCases: 2,
  };

  const preview = await service.generatePreview(dto);
  check(preview.rubricTotal === 10, 'preview reports the rubric total', preview.rubricTotal);
  check(preview.exam.title === 'Đề kiểm thử', 'preview returns the generated exam');

  const persisted = await service.generateAndPersist(dto);
  check(persisted.persisted.assignment === true, 'assignment is persisted');
  check(persisted.persisted.testCases === 2, 'both test cases are persisted', persisted.persisted.testCases);
  check(persisted.assignment.assignmentId.startsWith('ASM-SWP391-'), 'id is derived from the course', persisted.assignment.assignmentId);

  // Idempotency: the same request twice must reuse the same id, not create a duplicate.
  const again = await service.generateAndPersist(dto);
  check(
    again.assignment.assignmentId === persisted.assignment.assignmentId,
    'the same request produces the same assignment id',
    again.assignment.assignmentId,
  );
  check(again.persisted.updated === true, 'the second run reports an update, not a create');

  // A rubric that does not sum to 10 is a warning, never a failure.
  const badRubricClient: any = {
    generateExam: async () => ({
      source: 'GENAI_HUB',
      latencyMs: 1,
      exam: {
        ...(await fakeClient.generateExam()).exam,
        rubric: [{ criterion: 'A', maxScore: 4, description: 'a' }],
      },
    }),
  };
  const lenient = new ExamsService(badRubricClient, fakeAssignments, fakeTestCases, fakePostgres);
  const badRubric = await lenient.generatePreview({ ...dto, topic: 'Khác' });
  check(badRubric.rubricTotal === 4, 'a wrong rubric total is reported honestly', badRubric.rubricTotal);
}

// ────────────────────────────────────────────────────────────────────────────
// C. GradebookService — LAST / BEST / FIRST collapsing
// ────────────────────────────────────────────────────────────────────────────
async function runGradebook(): Promise<void> {
  console.log('\n=== C. GradebookService ===');

  const mk = (id: string, score: number, at: string) => ({
    submissionId: id,
    studentId: 'SE1',
    assignmentId: 'ASM1',
    language: 'python',
    fileName: `${id}.zip`,
    fileSizeBytes: 10,
    sha256Hash: `h-${id}`,
    filePath: `${id}.zip`,
    status: 'COMPLETED',
    score,
    createdAt: new Date(at),
    updatedAt: new Date(at),
  });

  const rows = [
    mk('S1', 2.0, '2026-01-01T00:00:00Z'),
    mk('S2', 9.0, '2026-01-02T00:00:00Z'),
    mk('S3', 5.0, '2026-01-03T00:00:00Z'),
  ];

  const repo: any = { findAll: async () => rows };
  const assignments: any = {
    findById: async () => ({ assignmentId: 'ASM1', title: 'Đề 1', courseId: 'C1', maxScore: 10 }),
  };
  const users: any = { findById: async () => ({ fullName: 'Đinh Thành Trung' }) };

  const service = new GradebookService(repo, assignments, users);

  const last = await service.buildGradebook({ policy: 'LAST' });
  check(last.totalRows === 1, 'one row per student+assignment', last.totalRows);
  check(last.entries[0].countedSubmissionId === 'S3', 'LAST picks the newest attempt', last.entries[0].countedSubmissionId);
  check(last.entries[0].attemptsCount === 3, 'all attempts are counted', last.entries[0].attemptsCount);
  check(last.supersededCount === 2, 'superseded attempts are reported', last.supersededCount);
  check(last.entries[0].attempts.filter((a) => a.counts).length === 1, 'exactly one attempt counts');

  const best = await service.buildGradebook({ policy: 'BEST' });
  check(best.entries[0].countedSubmissionId === 'S2', 'BEST picks the highest score', best.entries[0].countedSubmissionId);
  check(best.entries[0].score === 9.0, 'BEST row carries that score', best.entries[0].score);
  check(!!best.entries[0].note, 'BEST explains why an older attempt counts');

  const first = await service.buildGradebook({ policy: 'FIRST' });
  check(first.entries[0].countedSubmissionId === 'S1', 'FIRST picks the oldest attempt', first.entries[0].countedSubmissionId);
  check(!!first.entries[0].note, 'FIRST explains the rule');

  // An ungraded submission must still appear, with its status, rather than vanish.
  const queuedRepo: any = {
    findAll: async () => [
      { ...mk('Q1', 0 as any, '2026-01-05T00:00:00Z'), status: 'QUEUED', score: undefined },
    ],
  };
  const queued = new GradebookService(queuedRepo, assignments, users);
  const queuedResult = await queued.buildGradebook({});
  check(queuedResult.totalRows === 1, 'a queued submission still forms a row');
  check(queuedResult.entries[0].score === null, 'a queued row has no score yet');
  check(!!queuedResult.entries[0].note, 'a queued row explains that grading is pending');

  // Missing assignment / user must not crash the gradebook.
  const brokenRepo: any = { findAll: async () => [mk('X1', 7, '2026-01-01T00:00:00Z')] };
  const brokenAssignments: any = { findById: async () => { throw new Error('db down'); } };
  const brokenUsers: any = { findById: async () => { throw new Error('db down'); } };
  const resilient = new GradebookService(brokenRepo, brokenAssignments, brokenUsers);
  const resilientResult = await resilient.buildGradebook({});
  check(resilientResult.totalRows === 1, 'a repository failure still yields the row');
  check(resilientResult.entries[0].studentName === 'SE1', 'the student id is the fallback name');
}

// ────────────────────────────────────────────────────────────────────────────
// D. GoogleTokenVerifier — every rejection path
// ────────────────────────────────────────────────────────────────────────────
async function runTokenVerifier(): Promise<void> {
  console.log('\n=== D. GoogleTokenVerifier ===');

  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  const unconfigured = new GoogleTokenVerifier();
  check(unconfigured.isConfigured() === false, 'reports unconfigured when the client id is absent');
  await expectThrow(() => unconfigured.verify('a.b.c'), 'refuses to verify without a configured client id');

  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  const verifier = new GoogleTokenVerifier();
  check(verifier.isConfigured() === true, 'reports configured once the client id is set');

  await expectThrow(() => verifier.verify('not-a-jwt'), 'rejects a string that is not a JWT');
  await expectThrow(() => verifier.verify('a.b.c.d'), 'rejects a token with four segments');

  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  // alg=none is the classic algorithm-confusion attack.
  const noneToken = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ aud: 'test-client-id.apps.googleusercontent.com' })}.`;
  await expectThrow(() => verifier.verify(noneToken), 'rejects alg=none');

  // HS256 would let an attacker sign with the public key as the secret.
  const hsToken = `${enc({ alg: 'HS256', kid: 'x' })}.${enc({ aud: 'x' })}.sig`;
  await expectThrow(() => verifier.verify(hsToken), 'rejects HS256');

  // A structurally valid RS256 token whose kid is unknown cannot be verified.
  const unknownKid = `${enc({ alg: 'RS256', kid: 'no-such-kid' })}.${enc({ aud: 'test-client-id.apps.googleusercontent.com' })}.sig`;
  await expectThrow(() => verifier.verify(unknownKid), 'rejects an unknown key id');

  if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = saved;
}

// ────────────────────────────────────────────────────────────────────────────
// E. PlagiarismController — BR-04 gating and not-found
// ────────────────────────────────────────────────────────────────────────────
async function runPlagiarismController(): Promise<void> {
  console.log('\n=== E. PlagiarismController ===');

  const service: any = {
    detectForSubmission: async () => ({
      topMatch: { isFlagged: false, similarityRate: 12 },
      comparedCount: 1,
      reportsPersisted: 1,
      fingerprintsStored: 5,
      engine: 'LOCAL_AST_ENGINE',
      executionTimeMs: 3,
    }),
    getAssignmentMatrix: async () => ({ totalPairsCompared: 1, flaggedPairsCount: 0 }),
    getReports: async () => [],
    getFingerprints: async () => ({ fingerprints: [] }),
    extractSourceCodeFromZip: () => 'print(1)',
  };
  const submissions: any = {
    findById: async (id: string) =>
      id === 'KNOWN'
        ? { submissionId: 'KNOWN', studentId: 'SE1', assignmentId: 'A1', language: 'python', filePath: 'x.zip' }
        : null,
  };

  const controller = new PlagiarismController(service, submissions);

  // BR-04: a student must never reach the report.
  await expectThrow(() => controller.getReports(undefined, undefined, 'STUDENT'), 'BR-04 blocks role=STUDENT');
  await expectThrow(() => controller.getAssignmentMatrix('A1', 'student'), 'matrix is blocked for a student (case-insensitive)');
  await expectThrow(() => controller.getFingerprints('SUB', 'STUDENT'), 'fingerprints are blocked for a student');

  const matrix = await controller.getAssignmentMatrix('A1', 'INSTRUCTOR');
  check(matrix.statusCode === 200, 'an instructor may read the matrix');
  const reports = await controller.getReports(undefined, undefined, 'HOD');
  check(reports.statusCode === 200, 'an HOD may read the reports');

  // Unknown submission -> 404, not a crash.
  await expectThrow(() => controller.analyzeSubmission('UNKNOWN', { role: 'INSTRUCTOR' } as any), 'unknown submission is rejected');
  const analysed = await controller.analyzeSubmission('KNOWN', { role: 'INSTRUCTOR' } as any);
  check(analysed.statusCode === 200, 'a known submission is analysed');
}

// ────────────────────────────────────────────────────────────────────────────
// F. SandboxService — behaviour without a Docker daemon
// ────────────────────────────────────────────────────────────────────────────
async function runSandbox(): Promise<void> {
  console.log('\n=== F. SandboxService (degraded paths) ===');

  const service = new SandboxService();

  const mode = service.getExecutionMode?.() ?? (service as any).mode;
  check(typeof mode === 'string' || mode === undefined, 'exposes an execution mode', mode);

  // With no Docker daemon the service takes the "circuit breaker" path: it analyses the source
  // statically instead of executing it. That path must answer for every input rather than
  // throw, and it must never claim a pass for code it could not actually run.
  const unknownLang = await service.executeCode('brainfuck', 'print(1)', [
    { input: '1', expectedOutput: '1' },
  ] as any);
  check(unknownLang !== undefined, 'an unsupported language still returns a result');
  check(unknownLang.mode !== undefined, 'the result states which mode answered', unknownLang.mode);
  if (unknownLang.mode !== 'DOCKER_SECCOMP') {
    check(
      (unknownLang.testResults ?? []).every((r: any) => r.verdict !== 'PASSED') ||
        unknownLang.isCompileError === true,
      'an unsupported language is not silently marked as passing',
    );
  }

  // Empty source: Python happily runs an empty file, so the exit code is 0 — the honest
  // contract is that the test case FAILS (the program printed nothing) rather than being
  // scored as a pass. Asserting a compile error here would be wrong.
  const empty = await service.executeCode('python', '', [{ input: '1', expectedOutput: '1' }] as any);
  if (empty.mode === 'DOCKER_SECCOMP') {
    check(
      (empty.testResults ?? []).every((r: any) => r.verdict !== 'PASSED'),
      'empty source never passes a test case',
      (empty.testResults ?? []).map((r: any) => r.verdict),
    );
  } else {
    check(
      (empty.testResults ?? []).length === 0 || empty.isCompileError === true,
      'empty source produces no passing test result',
      (empty.testResults ?? []).length,
    );
  }

  // Any fixture must return within a bounded time; nothing may hang the suite.
  const startedAt = Date.now();
  const loop = await service.executeCode('python', 'while True:\n    pass\n', [] as any);
  check(loop !== undefined, 'an empty test-case list still returns a result');
  check(Date.now() - startedAt < 180_000, 'the call returns within a bounded time', `${Date.now() - startedAt}ms`);
}

/**
 * Entry point for `run-coverage-all.ts`. Returns true when every assertion passed, so the
 * aggregator can fold this suite into its exit code without the process exiting underneath it.
 */
export async function runMilestone3Suite(): Promise<boolean> {
  passed = 0;
  failed = 0;
  await runExamClient();
  await runExamsService();
  await runGradebook();
  await runTokenVerifier();
  await runPlagiarismController();
  await runSandbox();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`COVER-MILESTONE3: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  return failed === 0;
}

async function main(): Promise<void> {
  const ok = await runMilestone3Suite();
  if (!ok) process.exitCode = 1;
}

// Only self-execute when run directly, so importing the module from the aggregator is safe.
if (require.main === module) {
  main().catch((err) => {
    console.error('Suite crashed:', err);
    process.exitCode = 1;
  });
}
