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
  calculateTestcaseScore,
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

  // 3. Exact expected values (formula TC1 3.5 + TC2 3.5 + Clean 2 + SOLID 1).
  gate(passCase.score === 9.8, 'PASS score is 9.8', `got ${passCase.score}`);
  gate(passCase.breakdown.testcase1 === 3.5 && passCase.breakdown.testcase2 === 3.5, 'PASS breakdown TC1=3.5 TC2=3.5');
  gate(passCase.tc1 === 'PASSED' && passCase.tc2 === 'PASSED', 'PASS both testcases PASSED');
  gate(srpCase.score === 5.2, 'SRP score is 5.2', `got ${srpCase.score}`);
  gate(srpCase.tc1 === 'PASSED' && srpCase.tc2 === 'FAILED', 'SRP TC1 pass TC2 fail (O(N^2))');
  gate(invalidCase.score === 0 && invalidCase.tc1 === 'FAILED' && invalidCase.tc2 === 'FAILED', 'INVALID 0/10 FAILED');

  // 3b. Overall rule: all testcases must pass (worker: passedCount === total).
  const overallOf = (tc1: string, tc2: string) =>
    ([tc1, tc2].filter((s) => s === 'PASSED').length === 2 ? 'PASSED' : 'FAILED');
  gate(overallOf(passCase.tc1, passCase.tc2) === 'PASSED', 'PASS overall PASSED (2/2)');
  gate(overallOf(srpCase.tc1, srpCase.tc2) === 'FAILED', 'SRP overall FAILED (1/2 — rot 1 la rot ca bai)');
  gate(overallOf(invalidCase.tc1, invalidCase.tc2) === 'FAILED', 'INVALID overall FAILED (0/2)');
  gate(passCase.breakdown.total === passCase.score && srpCase.breakdown.total === srpCase.score, 'breakdown total equals score (diem thanh phan giu nguyen)');
  gate(calculateTestcaseScore(6, 10) === 4.2, 'dynamic testcase score uses 6/10 * 7');
  gate(calculateTestcaseScore(10, 10) === 7.0, 'dynamic testcase score reaches 7/7');
  gate(calculateTestcaseScore(0, 0) === 0, 'dynamic testcase score handles empty cases');

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

  // 6. No-code hardening: wrong-extension / empty / gibberish score 0.
  const noJava = analyzeSourceCode('plain english report '.repeat(30), 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  gate(noJava.score === 0 && noJava.tc1Status === 'FAILED', 'non-code text scores 0/FAILED');
  const emptySrc = analyzeSourceCode('', 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  gate(emptySrc.score === 0 && emptySrc.codeSmells[0]?.rule === 'Invalid Submission', 'empty source flagged INVALID');
  const shortJava = analyzeSourceCode('public class Main {}', 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  gate(shortJava.score === 0, 'short skeleton scores 0');
  gate(extractFirstSource(passZip, 'python') === null, 'demo extract ignores wrong-language zip (py filter on java zip)');
  gate(extractFirstSource(passZip, 'java')!.includes('Arrays.sort'), 'demo extract matches java extension');

  // 7. Code-identity hardening: keyword-stuffed non-source scores 0.
  const stuffedTxt = ('sorting memo print via System out Scanner read for ( item while ( next sort( list output result record line number N total order arrange sequence value data element entry point item set group batch row column table view tone note remark comment detail summary brief story text prose paragraph passage phrase sentence remark again repeat loop around over under through across beyond within without above below between among along across plus minus times divide equal total whole each every all any some few many much more most other such only own same than too very can will just should now here there then when where which while for print sort Scanner System out output read list order arrange ').repeat(12);
  gate(!/[{;}]/.test(stuffedTxt), 'stuffed fixture has no code-structure marker');
  const stuffedRes = analyzeSourceCode(stuffedTxt, 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  gate(stuffedRes.score === 0 && stuffedRes.tc1Status === 'FAILED' && stuffedRes.tc2Status === 'FAILED', 'keyword-stuffed txt scores 0/FAILED');
  gate(stuffedRes.codeSmells[0]?.rule === 'Invalid Submission' && stuffedRes.cleanCodeScore === 0, 'keyword-stuffed txt flagged INVALID');
  const noIdentity = ('sorting memo print via System out Scanner read for ( item while ( next sort( list output result record line total order arrange sequence value data element entry point item set group batch row table view tone note remark detail summary brief story text prose paragraph passage phrase sentence again repeat loop around over under through across beyond within without above below between among along plus minus times divide total whole each every all any some few many much more most other such only own same than too very can will just should now here there then when where which while for print sort Scanner System out output read list order ').repeat(4);
  const noIdentityRes = analyzeSourceCode(noIdentity, 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  gate(noIdentityRes.score === 0 && noIdentityRes.tc1Status === 'FAILED', 'code without identity marker scores 0');
  gate(analyzeSourceCode(passCode!, 'java', { tc1TimeMs: 80, tc2TimeMs: 140 }).score === 9.8, 'identity gate keeps PASS at 9.8');
  gate(analyzeSourceCode(srpCode!, 'java', { tc1TimeMs: 80, tc2TimeMs: 140 }).score === 5.2, 'identity gate keeps SRP at 5.2');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZipTest = require('adm-zip');
  const txtOnlyZip = path.join(root, 'txt-only-identity-check.zip');
  try {
    const z = new AdmZipTest();
    z.addFile('notes.txt', Buffer.from(stuffedTxt, 'utf-8'));
    z.writeZip(txtOnlyZip);
    gate(extractFirstSource(txtOnlyZip, 'java') === null, 'txt-only zip extracts null (java filter)');
    gate(extractFirstSource(txtOnlyZip) === null, 'txt-only zip extracts null (default filter)');
  } finally {
    try { fs.unlinkSync(txtOnlyZip); } catch { /* ignore */ }
  }

  console.log(`---\nDEMO-REAL: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

export { main as runDemoRealSuite };

if (require.main === module) {
  main().then((ok) => { if (!ok) process.exit(1); }).catch((err) => { console.error(err); process.exit(1); });
}
