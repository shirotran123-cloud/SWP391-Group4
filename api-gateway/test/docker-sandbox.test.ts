/**
 * Docker sandbox runner regression suite.
 *
 * Two modes:
 *   - Docker UNAVAILABLE (this machine by default): asserts that detection is honest
 *     and that the runner refuses to fake a result. This is the regression guard
 *     against the original bug, where `executeInDocker()` returned a hard-coded
 *     `'1 2 3 4 5\n'` so the pipeline scored regex matches instead of real runs.
 *   - Docker AVAILABLE: compiles and runs REAL code in a container, verifying that
 *     stdout matching, COMPILE_ERROR, TLE and wrong-answer verdicts are produced by
 *     actual execution.
 *
 * Run: cd api-gateway && npx ts-node --transpile-only test/docker-sandbox.test.ts
 */
import { DockerSandboxRunner, getDockerSandboxRunner } from '../src/sandbox/docker-runner';

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

const SORT_PY = `import sys


def bubble_sort(values):
    n = len(values)
    for i in range(n):
        for j in range(0, n - i - 1):
            if values[j] > values[j + 1]:
                values[j], values[j + 1] = values[j + 1], values[j]
    return values


def main():
    data = sys.stdin.read().split()
    if not data:
        return
    count = int(data[0])
    numbers = [int(x) for x in data[1:1 + count]]
    print(" ".join(str(v) for v in bubble_sort(numbers)))


main()
`;

const WRONG_PY = `import sys

data = sys.stdin.read().split()
if data:
    # Deliberately wrong: prints the input unchanged instead of sorting it.
    print(" ".join(data[1:]))
`;

const BROKEN_PY = `def main(
    # syntax error on purpose
    this is not valid python
`;

const INFINITE_PY = `while True:
    pass
`;

async function main(): Promise<boolean> {
  const runner = getDockerSandboxRunner();

  const available = await runner.isAvailable();
  console.log(`--- docker-sandbox: daemon available = ${available} (${runner.getAvailabilityReason()})`);

  // ── Assertions that hold regardless of Docker presence ─────────────────────
  check(typeof available === 'boolean', 'availability probe returns a boolean, never throws');
  check(
    typeof runner.getAvailabilityReason() === 'string' && runner.getAvailabilityReason().length > 0,
    'availability probe always explains itself',
    runner.getAvailabilityReason(),
  );

  // Output comparison is pure logic and must be correct either way.
  check(runner.outputsMatch('1 2 3\n', '1 2 3'), 'outputsMatch ignores trailing newline');
  check(runner.outputsMatch('1 2 3\r\n', '1 2 3\n'), 'outputsMatch normalises CRLF');
  check(runner.outputsMatch('  1 2 3  ', '1 2 3'), 'outputsMatch tolerates surrounding whitespace');
  check(!runner.outputsMatch('3 2 1', '1 2 3'), 'outputsMatch rejects a genuinely different answer');

  const testCases = [{ input: '5\n4 2 5 1 3', expectedOutput: '1 2 3 4 5', timeLimitMs: 5000 }];

  if (!available) {
    // ── Honest-degradation mode ──────────────────────────────────────────────
    const outcome = await runner.runTestCases('python', SORT_PY, testCases);
    check(outcome.available === false, 'runner reports available=false when the daemon is down');
    check(outcome.mode === 'DOCKER_UNAVAILABLE', 'runner reports DOCKER_UNAVAILABLE mode', outcome.mode);
    check(outcome.results.length === 0, 'runner returns NO fabricated results when unavailable');
    check(
      typeof outcome.reason === 'string' && outcome.reason.length > 0,
      'runner explains why Docker could not be used',
      outcome.reason,
    );
    check(
      !outcome.results.some((r) => r.stdout.includes('1 2 3 4 5')),
      'runner NEVER fabricates the old hard-coded "1 2 3 4 5" output',
    );
    console.log('');
    console.log('Docker is not available on this machine, so the real-execution assertions were skipped.');
    console.log('Install Docker Desktop, run: docker pull python:3.11-slim gcc:13 eclipse-temurin:17-jdk');
    console.log('then re-run this suite to exercise real container execution.');
    console.log(`---\nDOCKER-SANDBOX: ${passed} passed, ${failed} failed (degraded mode)`);
    return failed === 0;
  }

  // ── Real container execution ───────────────────────────────────────────────
  check(await runner.hasImage('python'), 'python:3.11-slim image is present locally');

  const ok = await runner.runTestCases('python', SORT_PY, testCases);
  check(ok.available === true, 'runner reports available=true with a live daemon');
  check(ok.mode === 'DOCKER', 'runner reports DOCKER mode');
  check(ok.results.length === 1, 'one result per test case', `got ${ok.results.length}`);
  if (ok.results[0]) {
    check(
      ok.results[0].stdout.trim() === '1 2 3 4 5',
      'REAL container produced the correct sorted output',
      `stdout=${JSON.stringify(ok.results[0].stdout)} exit=${ok.results[0].exitCode}`,
    );
    check(ok.results[0].verdict === 'PASSED', 'correct code verdict is PASSED', ok.results[0].verdict);
    check(ok.results[0].matched === true, 'correct code is marked matched');
  }

  const wrong = await runner.runTestCases('python', WRONG_PY, testCases);
  if (wrong.results[0]) {
    check(
      wrong.results[0].verdict === 'FAILED',
      'wrong answer is detected by comparing real stdout (not regex)',
      `verdict=${wrong.results[0].verdict} stdout=${JSON.stringify(wrong.results[0].stdout)}`,
    );
    check(wrong.results[0].matched === false, 'wrong answer is not marked matched');
  } else {
    check(false, 'wrong-answer submission should still execute');
  }

  const broken = await runner.runTestCases('python', BROKEN_PY, testCases);
  if (broken.compileError) {
    check(true, 'syntax-error submission yields COMPILE_ERROR without running tests');
  } else if (broken.results[0]) {
    check(
      broken.results[0].verdict === 'RUNTIME_ERROR',
      'syntax-error submission is NOT scored as PASSED',
      `verdict=${broken.results[0].verdict} exit=${broken.results[0].exitCode}`,
    );
  } else {
    check(false, 'syntax-error submission produced neither compile error nor a run result');
  }

  const tle = await runner.runTestCases('python', INFINITE_PY, [
    { input: '', expectedOutput: '', timeLimitMs: 1500 },
  ]);
  if (tle.results[0]) {
    check(
      tle.results[0].verdict === 'TIME_LIMIT_EXCEEDED',
      'infinite loop is killed by the watchdog as TLE',
      `verdict=${tle.results[0].verdict} timeMs=${tle.results[0].timeMs} exit=${tle.results[0].exitCode}`,
    );
    check(tle.results[0].timeMs < 12000, 'watchdog kills promptly', `timeMs=${tle.results[0].timeMs}`);
  }

  // A fresh runner instance must also detect the daemon (no sticky state).
  const second = new DockerSandboxRunner();
  check(await second.isAvailable(), 'a second runner instance also detects the daemon');

  console.log(`---\nDOCKER-SANDBOX: ${passed} passed, ${failed} failed (real execution)`);
  return failed === 0;
}

export { main as runDockerSandboxSuite };

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
