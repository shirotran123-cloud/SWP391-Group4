/**
 * WORKFLOW 2 / STEP 6 REGRESSION: the grading pipeline must run REAL AST + Winnowing
 * plagiarism detection instead of the old stub (`const plagiarismMatch = null;`).
 *
 * This suite drives the REAL `GradingWorkerConsumer.executeGradingPipeline` for two
 * submissions of the same assignment:
 *   - submission A: original code
 *   - submission B: the same algorithm, obfuscated the way Generative AI rewrites it
 *     (every identifier renamed, `for` rewritten as `while`, comments injected)
 *
 * Expected: B's pipeline run reports a top match against A above the 70% flag
 * threshold and emits that match on the `grading:completed` WebSocket event.
 *
 * Runs fully offline: no Docker, no Redis, no PostgreSQL, no GenAI Hub.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip = require('adm-zip');
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GradingWorkerConsumer } from '../src/queue/grading-worker.consumer';
import { GradingGateway, GradingCompletedPayload } from '../src/websocket/grading.gateway';
import { SubmissionRepository } from '../src/database/submission.repository';
import { SUBMISSION_STATUS } from '../src/common/constants/queue.constants';

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, details?: string): void {
  if (ok) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

// ─── Real Python source used by both submissions (a complete sort + search module) ───
const ORIGINAL_CODE = `import sys


def read_numbers(text):
    parts = text.split()
    numbers = []
    for part in parts:
        numbers.append(int(part))
    return numbers


def bubble_sort(values):
    n = len(values)
    for i in range(n):
        for j in range(0, n - i - 1):
            if values[j] > values[j + 1]:
                values[j], values[j + 1] = values[j + 1], values[j]
    return values


def binary_search(values, target):
    low = 0
    high = len(values) - 1
    while low <= high:
        middle = (low + high) // 2
        if values[middle] == target:
            return middle
        if values[middle] < target:
            low = middle + 1
        else:
            high = middle - 1
    return -1


def main():
    raw = sys.stdin.read()
    numbers = read_numbers(raw)
    ordered = bubble_sort(numbers)
    print(" ".join(str(item) for item in ordered))
    print(binary_search(ordered, ordered[0]))


if __name__ == "__main__":
    main()
`;

/** GenAI-style disguise: rename everything, `for` -> `while`, swap statements, add comments. */
const OBFUSCATED_CODE = `# Utility helpers for numeric processing.
import sys


def parse_input(payload):
    # Split the payload into integer tokens.
    tokens = payload.split()
    collected = []
    position = 0
    while position < len(tokens):
        collected.append(int(tokens[position]))
        position = position + 1
    return collected


def find_target_index(sorted_values, wanted):
    start = 0
    end = len(sorted_values) - 1
    while start <= end:
        midpoint = (start + end) // 2
        if sorted_values[midpoint] == wanted:
            return midpoint
        elif sorted_values[midpoint] < wanted:
            start = midpoint + 1
        else:
            end = midpoint - 1
    return -1


def arrange_in_order(data):
    # Classical exchange sort implementation.
    total = len(data)
    outer = 0
    while outer < total:
        inner = 0
        limit = total - outer - 1
        while inner < limit:
            left_value = data[inner]
            right_value = data[inner + 1]
            if left_value > right_value:
                swap_holder = data[inner]
                data[inner] = data[inner + 1]
                data[inner + 1] = swap_holder
            inner = inner + 1
        outer = outer + 1
    return data


def run():
    contents = sys.stdin.read()
    parsed = parse_input(contents)
    ordered = arrange_in_order(parsed)
    rendered = " ".join(str(entry) for entry in ordered)
    print(rendered)
    print(find_target_index(ordered, ordered[0]))


if __name__ == "__main__":
    run()
`;

/** A genuinely unrelated submission: a stack/queue data-structure module, no sorting. */
const UNRELATED_CODE = `"""A small bounded ring buffer implementation."""


class RingBuffer:
    def __init__(self, capacity):
        self.capacity = capacity
        self.storage = [None] * capacity
        self.head = 0
        self.count = 0

    def is_full(self):
        return self.count == self.capacity

    def is_empty(self):
        return self.count == 0

    def push(self, item):
        if self.is_full():
            raise OverflowError("ring buffer is full")
        index = (self.head + self.count) % self.capacity
        self.storage[index] = item
        self.count = self.count + 1

    def pop(self):
        if self.is_empty():
            raise IndexError("ring buffer is empty")
        item = self.storage[self.head]
        self.storage[self.head] = None
        self.head = (self.head + 1) % self.capacity
        self.count = self.count - 1
        return item

    def size(self):
        return self.count
`;

const STORE_FILES = [
  'submissions_store.json',
  'plagiarism_store.json',
  'users_store.json',
  'assignments_store.json',
];

function dataDir(): string {
  return path.resolve(process.cwd(), 'data');
}

function snapshotStores(): Map<string, Buffer | null> {
  const snap = new Map<string, Buffer | null>();
  for (const f of STORE_FILES) {
    const p = path.join(dataDir(), f);
    snap.set(f, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  return snap;
}

function restoreStores(snap: Map<string, Buffer | null>): void {
  const dir = dataDir();
  for (const f of STORE_FILES) {
    const p = path.join(dir, f);
    const buf = snap.get(f);
    if (buf === null || buf === undefined) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else {
      fs.writeFileSync(p, buf);
    }
  }
}

/** Writes a real .zip containing the given python file and returns its path. */
function writeSubmissionZip(dir: string, name: string, code: string): string {
  const zip = new AdmZip();
  zip.addFile('Solution.py', Buffer.from(code, 'utf-8'));
  const filePath = path.join(dir, `${name}.zip`);
  zip.writeZip(filePath);
  return filePath;
}

async function main(): Promise<boolean> {
  const snap = snapshotStores();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aita-plag-e2e-'));
  let app: any = null;

  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });

    const worker = app.get(GradingWorkerConsumer);
    const gateway = app.get(GradingGateway);
    const submissionRepo = app.get(SubmissionRepository);

    check(!!worker, 'GradingWorkerConsumer resolved from the real DI graph');
    check(!!submissionRepo, 'SubmissionRepository resolved');

    // Capture the grading:completed payload instead of broadcasting it.
    const completedPayloads: GradingCompletedPayload[] = [];
    const origCompleted = gateway.emitGradingCompleted.bind(gateway);
    gateway.emitGradingCompleted = ((payload: GradingCompletedPayload) => {
      completedPayloads.push(payload);
      return origCompleted(payload);
    }) as typeof gateway.emitGradingCompleted;

    const assignmentId = `ASM-PLAG-${Date.now()}`;

    // ── Submission A: original ────────────────────────────────────────────────
    const pathA = writeSubmissionZip(tempDir, 'submission-a', ORIGINAL_CODE);
    const subA = `SUB-PLAGA-${Date.now()}`;
    await submissionRepo.create({
      submissionId: subA,
      studentId: 'SE170000',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathA).size,
      sha256Hash: 'a'.repeat(64),
      filePath: pathA,
      status: SUBMISSION_STATUS.QUEUED,
    } as any);

    // ── Submission B: GenAI-obfuscated copy of A ─────────────────────────────
    const pathB = writeSubmissionZip(tempDir, 'submission-b', OBFUSCATED_CODE);
    const subB = `SUB-PLAGB-${Date.now()}`;
    await submissionRepo.create({
      submissionId: subB,
      studentId: 'SE170123',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathB).size,
      sha256Hash: 'b'.repeat(64),
      filePath: pathB,
      status: SUBMISSION_STATUS.QUEUED,
    } as any);

    // ── Run the REAL pipeline for B (A is now a peer in the same assignment) ──
    await worker.executeGradingPipeline({
      submissionId: subB,
      studentId: 'SE170123',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathB).size,
      sha256Hash: 'b'.repeat(64),
      filePath: pathB,
      enqueuedAt: new Date().toISOString(),
    } as any);

    const completed = completedPayloads.find((p) => p.submissionId === subB);
    check(!!completed, 'pipeline emitted grading:completed for the obfuscated submission');

    const match = completed && completed.plagiarismMatch;
    check(!!match, 'grading:completed payload carries a plagiarismMatch (step 6 is no longer a stub)');

    if (match) {
      check(
        match.similarityRate >= 70,
        'GenAI-obfuscated copy is flagged above the 70% threshold',
        `similarityRate=${match.similarityRate}`,
      );
      check(
        match.matchedStudentId === 'SE170000',
        'top match points at the original submission author',
        `matchedStudentId=${match.matchedStudentId}`,
      );
      // sourceCodeA is ALWAYS the submission under analysis (B, the obfuscated one);
      // sourceCodeB is the peer it matched (A, the original with bubble_sort).
      check(
        typeof match.sourceCodeA === 'string' && match.sourceCodeA.includes('arrange_in_order'),
        'match carries the ANALYSED source (the obfuscated submission) as sourceCodeA',
        `sourceCodeA head=${String(match.sourceCodeA).slice(0, 60)}`,
      );
      check(
        typeof match.sourceCodeB === 'string' && match.sourceCodeB.includes('bubble_sort'),
        'match carries the MATCHED PEER source (the original) as sourceCodeB',
        `sourceCodeB head=${String(match.sourceCodeB).slice(0, 60)}`,
      );
      check(
        Array.isArray(match.matchedTokens) && match.matchedTokens.length > 0,
        'match exports matched token/line coordinates for the diff viewer',
        `matchedTokens=${match.matchedTokens ? match.matchedTokens.length : 'n/a'}`,
      );
      check(match.sourceCodeA !== match.sourceCodeB, 'the two compared sources are genuinely different files');
    }

    // ── BR-03: confirmed plagiarism (>= 80%) forces the score to 0 ────────────
    if (match && match.similarityRate >= 80) {
      check(
        completed!.confirmedPlagiarism === true,
        'BR-03: payload flags confirmedPlagiarism when similarity >= 80%',
        `confirmedPlagiarism=${completed!.confirmedPlagiarism} similarity=${match.similarityRate}`,
      );
      check(
        completed!.score === 0,
        'BR-03: final score is forced to 0 for confirmed plagiarism (irreversible)',
        `score=${completed!.score}`,
      );
      check(
        completed!.scoreBreakdown !== undefined && completed!.scoreBreakdown.total === 0,
        'BR-03: score breakdown total is zeroed too, not just the headline score',
        `breakdown.total=${completed!.scoreBreakdown ? completed!.scoreBreakdown.total : 'n/a'}`,
      );
      check(
        typeof completed!.computedScoreBeforePenalty === 'number' && completed!.computedScoreBeforePenalty > 0,
        'BR-03: the pre-penalty score is preserved for the audit trail',
        `computedScoreBeforePenalty=${completed!.computedScoreBeforePenalty}`,
      );
    } else if (match) {
      check(
        completed!.confirmedPlagiarism === false,
        'BR-03: a 70-79% match is flagged but does NOT zero the score (needs >= 80%)',
        `similarity=${match.similarityRate}`,
      );
      check(
        completed!.score > 0 || completed!.scoreBreakdown === undefined,
        'BR-03: score is left intact below the 80% threshold',
        `score=${completed!.score}`,
      );
    }

    // ── Submission C: genuinely unrelated code must NOT be flagged ───────────
    const pathC = writeSubmissionZip(tempDir, 'submission-c', UNRELATED_CODE);
    const subC = `SUB-PLAGC-${Date.now()}`;
    await submissionRepo.create({
      submissionId: subC,
      studentId: 'SE170456',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathC).size,
      sha256Hash: 'c'.repeat(64),
      filePath: pathC,
      status: SUBMISSION_STATUS.QUEUED,
    } as any);

    completedPayloads.length = 0;
    await worker.executeGradingPipeline({
      submissionId: subC,
      studentId: 'SE170456',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathC).size,
      sha256Hash: 'c'.repeat(64),
      filePath: pathC,
      enqueuedAt: new Date().toISOString(),
    } as any);

    const completedC = completedPayloads.find((p) => p.submissionId === subC);
    check(!!completedC, 'pipeline emitted grading:completed for the unrelated submission');
    const matchC = completedC && completedC.plagiarismMatch;
    if (matchC) {
      check(
        matchC.similarityRate < 70,
        'unrelated algorithm is NOT flagged as plagiarism',
        `similarityRate=${matchC.similarityRate}`,
      );
    } else {
      check(true, 'unrelated submission reported no plagiarism match at all');
    }

    // ── Submission D: near-verbatim copy of A -> BR-03 must zero the score ───
    // Same algorithm AND nearly the same tokens (only comments and whitespace differ),
    // so the similarity lands in the >= 80% "confirmed plagiarism" band.
    const nearCopy = ORIGINAL_CODE.replace(
      'def bubble_sort(values):',
      '# rewritten by a friend\ndef bubble_sort(values):',
    );
    const pathD = writeSubmissionZip(tempDir, 'submission-d', nearCopy);
    const subD = `SUB-PLAGD-${Date.now()}`;
    await submissionRepo.create({
      submissionId: subD,
      studentId: 'SE170789',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathD).size,
      sha256Hash: 'd'.repeat(64),
      filePath: pathD,
      status: SUBMISSION_STATUS.QUEUED,
    } as any);

    completedPayloads.length = 0;
    await worker.executeGradingPipeline({
      submissionId: subD,
      studentId: 'SE170789',
      assignmentId,
      language: 'python',
      fileName: 'Solution.zip',
      fileSizeBytes: fs.statSync(pathD).size,
      sha256Hash: 'd'.repeat(64),
      filePath: pathD,
      enqueuedAt: new Date().toISOString(),
    } as any);

    const completedD = completedPayloads.find((p) => p.submissionId === subD);
    check(!!completedD, 'pipeline emitted grading:completed for the near-verbatim copy');

    const matchD = completedD && completedD.plagiarismMatch;
    if (matchD && matchD.similarityRate >= 80) {
      check(
        matchD.similarityRate >= 80,
        'near-verbatim copy reaches the BR-03 confirmed-plagiarism band (>= 80%)',
        `similarityRate=${matchD.similarityRate}`,
      );
      check(
        completedD!.score === 0,
        'BR-03: near-verbatim copy is scored 0',
        `score=${completedD!.score}`,
      );
      check(
        completedD!.confirmedPlagiarism === true,
        'BR-03: confirmedPlagiarism flag set for the near-verbatim copy',
        `confirmedPlagiarism=${completedD!.confirmedPlagiarism}`,
      );
      check(
        completedD!.scoreBreakdown !== undefined &&
          completedD!.scoreBreakdown.testcase1 === 0 &&
          completedD!.scoreBreakdown.testcase2 === 0,
        'BR-03: every score component is zeroed, not only the total',
        JSON.stringify(completedD!.scoreBreakdown),
      );
      const persisted = await submissionRepo.findById(subD);
      check(
        !!persisted && persisted.score === 0,
        'BR-03: the zeroed score is what gets persisted to the submissions store',
        `persisted score=${persisted ? persisted.score : 'n/a'}`,
      );
    } else {
      check(
        false,
        'near-verbatim copy should reach >= 80% similarity for the BR-03 test',
        `similarityRate=${matchD ? matchD.similarityRate : 'no match'}`,
      );
    }

    // ── Fingerprints must have been persisted for every submission ───────────
    const storePath = path.join(dataDir(), 'plagiarism_store.json');
    let fingerprintCount = 0;
    let reportCount = 0;
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      const fingerprints = store.fingerprints || (Array.isArray(store) ? [] : []);
      const reports = store.reports || [];
      fingerprintCount = Array.isArray(fingerprints) ? fingerprints.length : Object.keys(fingerprints).length;
      reportCount = Array.isArray(reports) ? reports.length : 0;
    }
    check(fingerprintCount > 0, 'AST fingerprints were persisted to the store', `count=${fingerprintCount}`);
    check(reportCount > 0, 'plagiarism_reports rows were persisted', `count=${reportCount}`);

    console.log(`---\nGRADING-PLAGIARISM-E2E: ${passed} passed, ${failed} failed`);
    return failed === 0;
  } finally {
    // Always restore the JSON stores so the suite is repeatable.
    if (app) {
      try {
        await app.close();
      } catch {
        // ignore shutdown errors
      }
    }
    restoreStores(snap);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export { main as runGradingPlagiarismE2ESuite };

if (require.main === module) {
  main()
    .then((ok) => {
      if (!ok) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
