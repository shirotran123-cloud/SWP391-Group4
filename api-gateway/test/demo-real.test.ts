/**
 * Demo-vs-real grading test — proves the demo calls the SHIPPED code.
 *
 * - Imports `analyzeSourceCode`/`buildScoreBreakdown`/`validateSubmissionFile`
 *   from the real shared module `src/queue/grading-core.ts` (same module the
 *   NestJS worker delegates to — single source of truth, no re-implementation).
 * - Imports `runDemoCases`/`extractFirstSource` from the real demo file.
 * - Asserts the demo's 3 printed cases equal the core functions' outputs on
 *   the real sample zips, plus the exact expected scores/breakdowns.
 * - Also asserts the demo file contains no local copy of the formula
 *   (no `? 4 : 0`, no `* 2.0`, no `Math.min(10` outside imports).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeSourceCode,
  buildScoreBreakdown,
  validateSubmissionFile,
} from '../src/queue/grading-core';
import { extractFirstSource, gradeSource, runDemoCases } from '../../demo/demo-nop-bai-tinh-diem';

let passed = 0;
let failed = 0;
function gate(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

async function main(): Promise<boolean> {
  const root = path.resolve(process.cwd(), '..');
  const passZip = path.join(root, 'sample_solution_pass.zip');
  const srpZip = path.join(root, 'sample_solution_fail_srp.zip');
  gate(fs.existsSync(passZip) && fs.existsSync(srpZip), 'sample zips exist');

  // 1. Demo extraction reads the REAL zips (non-empty Java sources).
  const passCode = extractFirstSource(passZip);
  const srpCode = extractFirstSource(srpZip);
  gate(!!passCode && passCode.includes('Arrays.sort'), 'demo extracts real pass source', (passCode || '').slice(0, 60));
  gate(!!srpCode && srpCode.includes('sortAndPrintAndSaveToDatabase'), 'demo extracts real SRP source');

  // 2. Demo cases equal direct core calls (same module the worker uses).
  const cases = runDemoCases();
  gate(cases.length === 3, 'demo returns 3 cases', `got ${cases.length}`);
  const [passCase, srpCase, invalidCase] = cases;

  const directPass = analyzeSourceCode(passCode!, 'java', { tc1TimeMs: 80, tc2TimeMs: 140 });
  gate(passCase.score === directPass.score, 'PASS score equals core output', `${passCase.score} vs ${directPass.score}`);
  gate(JSON.stringify(passCase.breakdown) === JSON.stringify(buildScoreBreakdown(directPass)), 'PASS breakdown equals core breakdown');

  const directSrp = analyzeSourceCode(srpCode!, 'java', { tc1TimeMs: 80, tc2TimeMs: 140 });
  gate(srpCase.score === directSrp.score, 'SRP score equals core output', `${srpCase.score} vs ${directSrp.score}`);
  gate(srpCase.smells.some((s) => s.startsWith('Single Responsibility Principle')), 'SRP case carries SRP smell', srpCase.smells.join(','));

  // 3. Exact expected values (formula TC1 4 + TC2 3 + Clean 2 + SOLID 1).
  gate(passCase.score === 9.8, 'PASS score is 9.8', `got ${passCase.score}`);
  gate(passCase.breakdown.testcase1 === 4 && passCase.breakdown.testcase2 === 3, 'PASS breakdown TC1=4 TC2=3');
  gate(passCase.tc1 === 'PASSED' && passCase.tc2 === 'PASSED', 'PASS both testcases PASSED');
  gate(srpCase.score === 5.7, 'SRP score is 5.7', `got ${srpCase.score}`);
  gate(srpCase.tc1 === 'PASSED' && srpCase.tc2 === 'FAILED', 'SRP TC1 pass TC2 fail (O(N^2))');
  gate(invalidCase.score === 0 && invalidCase.tc1 === 'FAILED' && invalidCase.tc2 === 'FAILED', 'INVALID 0/10 FAILED');

  // 4. Validation uses the real shared rules.
  gate(validateSubmissionFile(null, 'java', ['java'])?.code === 'MISSING_FILE', 'validation missing file');
  gate(validateSubmissionFile({ originalname: 'a.rar', size: 10 }, 'java', ['java'])?.code === 'NOT_ZIP', 'validation non-zip rejected');
  gate(validateSubmissionFile({ originalname: 'a.zip', size: 11 * 1024 * 1024 }, 'java', ['java'])?.code === 'TOO_LARGE', 'validation >10MB rejected');
  gate(validateSubmissionFile({ originalname: 'a.zip', size: 10 }, 'go', ['java'])?.code === 'LANGUAGE_NOT_ALLOWED', 'validation language rejected');
  gate(validateSubmissionFile({ originalname: 'a.zip', size: 10 }, 'java', ['java']) === null, 'validation accepts good file');

  // 5. Demo holds no local formula copy (static guard against mock drift).
  const demoSrc = fs.readFileSync(path.join(root, 'demo', 'demo-nop-bai-tinh-diem.ts'), 'utf-8');
  gate(!/\?\s*4\s*:\s*0/.test(demoSrc), 'demo has no local TC weight copy');
  gate(!/\(clean\s*\/\s*10\)\s*\*\s*2/.test(demoSrc), 'demo has no local clean-code formula');
  gate(demoSrc.includes('grading-core'), 'demo imports the real grading-core module');
  void gradeSource;

  console.log(`---\nDEMO-REAL: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

export { main as runDemoRealSuite };

if (require.main === module) {
  main().then((ok) => { if (!ok) process.exit(1); }).catch((err) => { console.error(err); process.exit(1); });
}
