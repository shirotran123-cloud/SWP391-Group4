/**
 * AITA Goal Gates — GenAI / Sandbox verification.
 *
 * Drives REAL shipped code:
 *  - ASTPlagiarismEngine.compareSubmissions (src/ast-engine/plagiarism-engine.ts)
 *  - WinnowingEngine.computeFingerprints (src/ast-engine/winnowing.ts)
 *  - sandbox fallback engine (sandbox/worker/index.ts, whichever export exists)
 *
 * ts-node runnable, exits non-zero on any failure. Runtime target: < 60s.
 */

// --- dockerode stub ---------------------------------------------------------
// sandbox/worker/index.ts imports dockerode at module top, but dockerode is
// only installed under api-gateway/node_modules. The fallback engine under
// test never touches Docker, so stub the loader before requiring the real
// shipped file (test-only shim; shipped code untouched).
const ModuleShim = require('module') as { _load: (...args: any[]) => any };
const originalLoad = ModuleShim._load;
ModuleShim._load = function (request: string, ...rest: any[]) {
  if (request === 'dockerode') {
    class DockerStub {
      public ping(): Promise<string> {
        return Promise.reject(new Error('goal-gates stub: no Docker daemon'));
      }
    }
    return DockerStub;
  }
  return originalLoad.call(this, request, ...rest);
};

import { ASTPlagiarismEngine } from '../src/ast-engine/plagiarism-engine';
import { ASTNormalizer } from '../src/ast-engine/ast-normalizer';
import { WinnowingEngine } from '../src/ast-engine/winnowing';

// Require AFTER the stub is installed; restore loader right after.
const sandboxWorker: any = require('../../sandbox/worker/index');
ModuleShim._load = originalLoad;

// --- Fixtures ---------------------------------------------------------------
const ORIGINAL_SORT = [
  'def bubble_sort(arr):',
  '    n = len(arr)',
  '    for i in range(n):',
  '        for j in range(0, n - i - 1):',
  '            if arr[j] > arr[j + 1]:',
  '                arr[j], arr[j + 1] = arr[j + 1], arr[j]',
  '    return arr',
].join('\n');

const RENAMED_COPY = [
  'def sort_list(xs):',
  '    # helper: identifiers renamed, logic identical',
  '    m = len(xs)',
  '    for a in range(m):',
  '        for b in range(0, m - a - 1):',
  '            if xs[b] > xs[b + 1]:',
  '                xs[b], xs[b + 1] = xs[b + 1], xs[b]',
  '    return xs',
].join('\n');

const UNRELATED = [
  'def greet_user(name):',
  '    message = "Hello " + name',
  '    print(message)',
  '    return message',
].join('\n');

const FORK_BOMB_C = [
  '#include <unistd.h>',
  'int main() {',
  '    while (1) { fork(); }',
  '    return 0;',
  '}',
].join('\n');

const HUGE_MALLOC_C = [
  '#include <stdlib.h>',
  'int main() {',
  '    int *p = malloc(1000000000);',
  '    p[0] = 1;',
  '    return 0;',
  '}',
].join('\n');

const NORMAL_PY = 'print(sorted([3, 1, 2]))\n';

// --- Harness ----------------------------------------------------------------
let passed = 0;
let failed = 0;

function gate(condition: boolean, name: string, details?: string): void {
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function main(): Promise<boolean> {
  const started = Date.now();
  console.log('=== AITA GOAL GATES (genai-hub + sandbox) ===');

  // (a) Plagiarism: renamed copy must flag; unrelated must not.
  const renamed = ASTPlagiarismEngine.compareSubmissions(
    { submissionId: 'GATE-ORIG', sourceCode: ORIGINAL_SORT, language: 'python' },
    { submissionId: 'GATE-RENAME', sourceCode: RENAMED_COPY, language: 'python' },
  );
  console.log(`renamed similarity=${renamed.similarityRate} flagged=${renamed.isFlagged}`);
  gate(renamed.similarityRate >= 70, 'plagiarism renamed copy similarity >= 70', `got ${renamed.similarityRate}`);
  gate(renamed.isFlagged === true, 'plagiarism renamed copy isFlagged true');

  const unrelated = ASTPlagiarismEngine.compareSubmissions(
    { submissionId: 'GATE-ORIG', sourceCode: ORIGINAL_SORT, language: 'python' },
    { submissionId: 'GATE-OTHER', sourceCode: UNRELATED, language: 'python' },
  );
  console.log(`unrelated similarity=${unrelated.similarityRate} flagged=${unrelated.isFlagged}`);
  gate(unrelated.similarityRate < 70, 'plagiarism unrelated similarity < 70', `got ${unrelated.similarityRate}`);
  gate(unrelated.isFlagged === false, 'plagiarism unrelated isFlagged false');

  // (b) Winnowing fingerprints non-empty.
  const norm = ASTNormalizer.normalize(ORIGINAL_SORT, 'python');
  const fps = WinnowingEngine.computeFingerprints(norm.tokens);
  console.log(`fingerprints=${fps.length} tokens=${norm.tokens.length}`);
  gate(fps.length > 0, 'winnowing fingerprints non-empty', `got ${fps.length}`);

  // (c) Sandbox fallback: resolve whichever export exists.
  const fallbackFn =
    sandboxWorker.runSafeFallbackSandbox || sandboxWorker.runSandbox || sandboxWorker.runDockerSandbox;
  gate(typeof fallbackFn === 'function', 'sandbox fallback export exists', Object.keys(sandboxWorker).join(','));

  const forkRes = await fallbackFn('c', FORK_BOMB_C);
  console.log(`fork-bomb exit=${forkRes.exitCode} stderr=${JSON.stringify(forkRes.stderr).slice(0, 160)}`);
  gate(forkRes.exitCode !== 0, 'sandbox fork-bomb exitCode != 0', `got ${forkRes.exitCode}`);
  gate(
    /seccomp/i.test(forkRes.stderr || '') && /pidslimit/i.test(forkRes.stderr || ''),
    'sandbox fork-bomb stderr mentions SECCOMP/PidsLimit',
  );

  const mallocRes = await fallbackFn('c', HUGE_MALLOC_C);
  console.log(`huge-malloc exit=${mallocRes.exitCode} stderr=${JSON.stringify(mallocRes.stderr).slice(0, 160)}`);
  gate(
    mallocRes.exitCode !== 0 && /mle/i.test(mallocRes.stderr || ''),
    'sandbox huge-malloc MLE marker or non-zero exit',
    `exit=${mallocRes.exitCode}`,
  );

  let normalThrew = false;
  let normalRes: any = null;
  try {
    normalRes = await fallbackFn('python', NORMAL_PY);
  } catch (err) {
    normalThrew = true;
  }
  gate(!normalThrew, 'sandbox normal snippet handled without throw');
  gate(normalRes && normalRes.exitCode === 0, 'sandbox normal snippet exitCode 0', normalRes ? `got ${normalRes.exitCode}` : 'threw');

  const elapsed = Date.now() - started;
  console.log(`---\nGATES: ${passed} passed, ${failed} failed (${elapsed}ms)`);
  gate(elapsed < 60000, 'total runtime < 60s', `${elapsed}ms`);
  return failed === 0;
}

export { main as runGoalGatesSuite };

if (require.main === module) {
  main().then((ok) => {
    if (!ok) process.exit(1);
  }).catch((err) => {
    console.error('[FAIL] goal-gates crashed:', err);
    process.exit(1);
  });
}
