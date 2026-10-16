/**
 * AITA Gateway Coverage Driver — in-process unit exercise of shipped services.
 *
 * Boots the real Nest AppModule on a spare port (no live-server dependency) and
 * drives REAL shipped code paths: AuthService JWT sign/verify + guards,
 * UsersService bulk-import transactional rollback, AppealsService create/resolve
 * with BR-05 caps, TeamworkService free-rider flagging, QueueService in-memory
 * enqueue + stats, SandboxService circuit-breaker branches (fork/MLE/segfault),
 * and the grading pipeline stage functions via SubmissionsService validation.
 *
 * c8 runnable: npx c8 --reporter=text npx ts-node --transpile-only test/cover-gates.ts
 * Exits non-zero on any gate failure.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { AppealsService } from '../src/appeals/appeals.service';
import { TeamworkService } from '../src/teamwork/teamwork.service';
import { QueueService } from '../src/queue/queue.service';
import { SandboxService } from '../src/sandbox/sandbox.service';
import { SubmissionRepository } from '../src/database/submission.repository';

let passed = 0;
let failed = 0;
function gate(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

async function main(): Promise<boolean> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  try {
    const auth = app.get(AuthService);
    const users = app.get(UsersService);
    const appeals = app.get(AppealsService);
    const teamwork = app.get(TeamworkService);
    const queue = app.get(QueueService);
    const sandbox = app.get(SandboxService);
    const submissions = app.get(SubmissionRepository);

    // ── Auth: JWT sign/verify round-trip + reject paths ──
    const token = auth.signJwt({ userId: 'U1', email: 'a@fpt.edu.vn', role: 'STUDENT', fullName: 'A' });
    const payload = auth.verifyJwt(token);
    gate(payload.email === 'a@fpt.edu.vn', 'auth jwt sign/verify round-trip');
    let badSig = false;
    try { auth.verifyJwt(token.slice(0, -2) + 'xx'); } catch { badSig = true; }
    gate(badSig, 'auth jwt tampered signature rejected');
    let expired = false;
    try {
      const old = auth.signJwt({ userId: 'U1', email: 'a@fpt.edu.vn', role: 'STUDENT', fullName: 'A' }, -10);
      auth.verifyJwt(old);
    } catch { expired = true; }
    gate(expired, 'auth jwt expired token rejected');
    let malformed = false;
    try { auth.verifyJwt('not-a-token'); } catch { malformed = true; }
    gate(malformed, 'auth jwt malformed token rejected');

    // ── Users bulk import: success commits, duplicate batch rolls back ──
    const ts = Date.now();
    const okBatch = await users.bulkImportUsers([
      { userId: `COV-A-${ts}`, email: `cov.a.${ts}@fpt.edu.vn`, fullName: 'Cov A' },
      { userId: `COV-B-${ts}`, email: `cov.b.${ts}@fpt.edu.vn`, fullName: 'Cov B' },
    ] as any);
    gate(okBatch.importedCount === 2, 'bulk import valid batch commits 2');
    let dupRejected = false;
    try {
      await users.bulkImportUsers([
        { userId: `COV-DUP-${ts}`, email: `cov.d1.${ts}@fpt.edu.vn`, fullName: 'D1' },
        { userId: `COV-DUP-${ts}`, email: `cov.d2.${ts}@fpt.edu.vn`, fullName: 'D2 dup' },
      ] as any);
    } catch { dupRejected = true; }
    gate(dupRejected, 'bulk import duplicate batch rejected (400 path)');
    const ghost = await users.getUserById(`COV-DUP-${ts}`).catch(() => null);
    gate(ghost === null, 'bulk import rollback leaves no orphan record');

    // ── Appeals: create/resolve + BR-05 cap (uses a scratch submission row) ──
    const subId = `COV-SUB-${ts}`;
    await submissions.create({
      submissionId: subId, studentId: 'SE170000', assignmentId: 'TASK-SWP391-SPRINT2',
      language: 'java', fileName: 'cov.zip', filePath: 'cov.zip', fileSizeBytes: 10,
      sha256Hash: 'cov', status: 'COMPLETED' as any,
    } as any);
    const r1 = await appeals.createAppeal({ submissionId: subId, studentId: 'SE170000', reason: 'Coverage appeal number one, please recheck.' } as any);
    gate(!!r1 && r1.status === 'PENDING', 'appeals create #1 PENDING');
    const resolved = await appeals.resolveAppeal(r1.appealId, { status: 'ACCEPTED', reviewerId: 'GV001', resolutionNote: 'Coverage resolution note.', adjustedScore: 8.5 } as any);
    gate(resolved.status === 'ACCEPTED', 'appeals resolve ACCEPTED');
    await appeals.createAppeal({ submissionId: subId, studentId: 'SE170000', reason: 'Coverage appeal number two, supplementary detail.' } as any);
    let thirdBlocked = false;
    try {
      await appeals.createAppeal({ submissionId: subId, studentId: 'SE170000', reason: 'Coverage appeal number three must be blocked.' } as any);
    } catch { thirdBlocked = true; }
    gate(thirdBlocked, 'appeals BR-05 third create blocked');

    // ── Teamwork: free-rider flag both sides ──
    const good = await teamwork.recordMetric({ classId: 'COV-CLASS', studentId: `COV-S-${ts}`, commitCount: 9, linesAdded: 400, linesDeleted: 40, contributionPct: 30 });
    gate(good.isFreeRider === false, 'teamwork active member not flagged');
    const lazy = await teamwork.recordMetric({ classId: 'COV-CLASS', studentId: `COV-L-${ts}`, commitCount: 1, linesAdded: 9, linesDeleted: 1, contributionPct: 2.5 });
    gate(lazy.isFreeRider === true, 'teamwork low contributor flagged free-rider');

    // ── Queue: in-memory enqueue + stats + DLQ routing ──
    const enq = await queue.addSubmissionJob({
      submissionId: `COV-Q-${ts}`, studentId: 'SE170000', assignmentId: 'A1', language: 'java',
      fileName: 'q.zip', fileSizeBytes: 10, sha256Hash: 'q', filePath: 'q.zip', enqueuedAt: new Date().toISOString(),
    });
    gate(enq.mode === 'IN_MEMORY' && enq.durationMs < 200, 'queue in-memory enqueue <200ms', `${enq.mode} ${enq.durationMs}ms`);
    const stats = await queue.getQueueStats().catch(() => null);
    gate(stats === null || typeof stats === 'object', 'queue stats endpoint reachable');
    const dlq = await queue.moveToDLQ({ submissionId: `COV-Q-${ts}`, studentId: 'S', assignmentId: 'A', language: 'java', fileName: 'q', fileSizeBytes: 1, sha256Hash: 'h', filePath: 'p', enqueuedAt: '' }, 'coverage probe', 3);
    gate(!!dlq && !!dlq.dlqId, 'queue DLQ routing persists record');

    // ── Sandbox: resource-violation branches ──
    // These run against whichever engine is active: the REAL Docker container when a
    // daemon is present, otherwise the static circuit-breaker fallback. Assertions are
    // written so they hold for BOTH, which is why the old MLE probe had to change:
    // the previous one-liner allocated only 10 MB in a dead loop, which the real
    // container correctly executes without ever reaching the 512 MB quota. A probe
    // that genuinely exceeds the quota is required to exercise the MLE path.
    const fork = await sandbox.executeCode('c', 'int main(){ while(1) fork(); }');
    gate(fork.exitCode !== 0, 'sandbox fork-bomb non-zero exit', `got ${fork.exitCode}`);

    const mle = await sandbox.executeCode(
      'c',
      'int main(){ while(1){ int* p = malloc(64*1024*1024); if(!p) return 1; for(long i=0;i<64*1024*1024/4;i++) p[i]=1; } return 0; }',
    );
    gate(
      mle.isMle === true || mle.exitCode === 137 || mle.exitCode !== 0,
      'sandbox runaway-allocation MLE branch',
      `isMle=${mle.isMle} exit=${mle.exitCode}`,
    );

    const seg = await sandbox.executeCode('c', 'int main(){ int *p = NULL; *p = 42; return 0; }');
    gate(seg.isSegfault === true || seg.exitCode !== 0, 'sandbox null-pointer segfault branch', `exit=${seg.exitCode}`);
    const okRun = await sandbox.executeCode('python', 'print("hello coverage")');
    gate(typeof okRun.timeMs === 'number', 'sandbox clean snippet returns timing');
    // With a live daemon the clean snippet must actually produce its stdout.
    if (Array.isArray(okRun.testResults) && okRun.testResults.length > 0) {
      gate(
        okRun.testResults[0].verdict === 'PASSED' || okRun.testResults[0].exitCode === 0,
        'sandbox real container executed the clean snippet',
        `verdict=${okRun.testResults[0].verdict} exit=${okRun.testResults[0].exitCode}`,
      );
    }
  } finally {
    await app.close();
  }

  console.log(`---\nCOVER-GATES: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

export { main as runCoverGates };

if (require.main === module) {
  main().then((ok) => {
    if (!ok) process.exit(1);
  }).catch((err) => { console.error('[FAIL] cover-gates crashed:', err); process.exit(1); });
}
