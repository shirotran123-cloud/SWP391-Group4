/**
 * AITA Docker Runner – Live smoke tests
 * Chạy bằng: node --experimental-vm-modules tools/docker-smoke-test.mjs
 * Yêu cầu: Docker Desktop đang chạy, 4 image đã có sẵn
 */
import { getDockerSandboxRunner } from '../api-gateway/src/sandbox/docker-runner.js';

const run = getDockerSandboxRunner();

const cases = [
  {
    name: 'C++ đúng kết quả',
    lang: 'cpp',
    code: '#include<iostream>\nusing namespace std;\nint main(){cout<<"hello"<<endl;}',
    tc: [{ input: '', expectedOutput: 'hello' }],
    expect: (r) => r.results[0]?.verdict === 'ACCEPTED',
  },
  {
    name: 'C++ lỗi biên dịch (CE)',
    lang: 'cpp',
    code: 'this is not c++',
    tc: [{ input: '', expectedOutput: '' }],
    expect: (r) => !!r.compileError,
  },
  {
    name: 'C++ sai đáp án (WA)',
    lang: 'cpp',
    code: '#include<iostream>\nusing namespace std;\nint main(){cout<<"wrong"<<endl;}',
    tc: [{ input: '', expectedOutput: 'correct' }],
    expect: (r) => r.results[0]?.verdict === 'WRONG_ANSWER',
  },
  {
    name: 'C++ TLE (vòng lặp vô hạn)',
    lang: 'cpp',
    code: '#include<iostream>\nusing namespace std;\nint main(){while(true){}}',
    tc: [{ input: '', expectedOutput: '', timeLimitMs: 2000 }],
    expect: (r) => r.results[0]?.verdict === 'TIME_LIMIT_EXCEEDED',
  },
  {
    name: 'Python đúng kết quả',
    lang: 'python',
    code: 'print(int(input())*2)',
    tc: [{ input: '5', expectedOutput: '10' }],
    expect: (r) => r.results[0]?.verdict === 'ACCEPTED',
  },
  {
    name: 'Python nhiều testcase (6 TC)',
    lang: 'python',
    code: 'print(int(input())*2)',
    tc: [1,2,3,4,5,6].map(n => ({ input: String(n), expectedOutput: String(n*2) })),
    expect: (r) => r.results.length === 6 && r.results.every(x => x.verdict === 'ACCEPTED'),
  },
];

let passed = 0;
let failed = 0;

console.log('\n========================================');
console.log('  AITA Docker Runner – Live Smoke Tests');
console.log('========================================\n');

for (const c of cases) {
  process.stdout.write(`  ▶ ${c.name} ... `);
  try {
    const outcome = await run.runTestCases(c.lang, c.code, c.tc);
    const ok = c.expect(outcome);
    if (ok) {
      const details = outcome.results.map(r => `${r.verdict}(${r.timeMs}ms,${r.memoryKb}KB)`).join(', ');
      console.log(`✅ PASS  ${details || (outcome.compileError ? 'CE' : '')}`);
      passed++;
    } else {
      console.log(`❌ FAIL`);
      console.log(`     outcome:`, JSON.stringify(outcome, null, 2).slice(0, 400));
      failed++;
    }
  } catch (err) {
    console.log(`💥 ERROR: ${err.message}`);
    failed++;
  }
}

console.log(`\n  Kết quả: ${passed}/${passed+failed} passed\n`);
process.exit(failed > 0 ? 1 : 0);
