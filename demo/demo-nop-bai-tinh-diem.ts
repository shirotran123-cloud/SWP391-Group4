/**
 * Demo nop bai + co che tinh diem (AITA-Intelligent)
 *
 * KHONG con mock viet lai cong thuc: file nay import TRUC TIEP logic that tu
 * `api-gateway/src/queue/grading-core.ts` — cung module ma NestJS worker
 * (`grading-worker.consumer.ts`) dang dung:
 *  - `validateSubmissionFile`: quy tac .zip / 10MB / ngon ngu cho phep
 *  - `analyzeSourceCode`: phan tich + cong thuc TC1 4.0 + TC2 3.0 + Clean 2.0 + SOLID 1.0
 *  - `buildScoreBreakdown`: bang diem chi tiet nhu payload `grading:completed`
 *
 * 3 case chay tren SOURCE THAT giai nen tu 2 file zip mau o root repo:
 *  1. PASS  <- sample_solution_pass.zip   (Arrays.sort O(N log N))
 *  2. SRP-FAIL <- sample_solution_fail_srp.zip (BubbleSort O(N^2) + sortAndPrintAndSaveToDatabase)
 *  3. INVALID <- zip khong co source hop le (early return 0/10 FAILED)
 *
 * Chay dung lenh tai lieu:
 *   node --experimental-strip-types demo/demo-nop-bai-tinh-diem.ts
 * (hoac: npx ts-node --transpile-only demo/demo-nop-bai-tinh-diem.ts)
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('../api-gateway/node_modules/adm-zip/adm-zip.js');
import {
  analyzeSourceCode,
  buildScoreBreakdown,
  validateSubmissionFile,
  type SourceAnalysis,
} from '../api-gateway/src/queue/grading-core';

const REPO_ROOT = path.resolve(__dirname, '..');
const ALLOWED_LANGUAGES = ['java', 'python', 'cpp', 'dotnet'];

// Timing co dinh de output demo on dinh giua cac lan chay
// (worker truyen timing do duoc/random; cong thuc diem khong doi).
const DEMO_TIMING = { tc1TimeMs: 80, tc2TimeMs: 140 };

export interface DemoCaseResult {
  caseName: string;
  zipName: string;
  validation: string;
  sha256Prefix: string;
  tc1: string;
  tc2: string;
  score: number;
  breakdown: { testcase1: number; testcase2: number; cleanCode: number; solid: number; total: number };
  cleanCode: number;
  smells: string[];
}

const EXT_MAP: Record<string, string[]> = {
  java: ['.java'],
  python: ['.py'],
  cpp: ['.cpp', '.cc', '.cxx', '.c'],
  dotnet: ['.cs'],
};

/** Giai nen va lay source code dau tien KHOP DUOI ngon ngu (AdmZip, giong worker). */
export function extractFirstSource(zipPath: string, language = 'java'): string | null {
  try {
    const targetExts = EXT_MAP[language.toLowerCase()] || ['.java', '.py', '.cpp', '.cs'];
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (!entry.isDirectory && !entry.entryName.includes('__MACOSX')) {
        const name = entry.entryName.toLowerCase();
        if (targetExts.some((ext) => name.endsWith(ext))) {
          return zip.readAsText(entry);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function gradeSource(caseName: string, zipName: string, code: string | null): DemoCaseResult {
  const zipPath = path.join(REPO_ROOT, zipName);
  const zipBytes = fs.readFileSync(zipPath);
  const sha = crypto.createHash('sha256').update(zipBytes).digest('hex');
  const stat = fs.statSync(zipPath);

  const err = validateSubmissionFile(
    { originalname: zipName, size: stat.size },
    'java',
    ALLOWED_LANGUAGES,
  );

  let analysis: SourceAnalysis;
  if (err) {
    analysis = analyzeSourceCode('', 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  } else if (!code || code.trim().length === 0) {
    analysis = analyzeSourceCode('', 'java', { tc1TimeMs: 0, tc2TimeMs: 0 });
  } else {
    analysis = analyzeSourceCode(code, 'java', DEMO_TIMING);
  }
  const breakdown = buildScoreBreakdown(analysis);

  return {
    caseName,
    zipName,
    validation: err ? `${err.code}: ${err.message}` : 'OK',
    sha256Prefix: sha.substring(0, 12),
    tc1: analysis.tc1Status,
    tc2: analysis.tc2Status,
    score: analysis.score,
    breakdown,
    cleanCode: analysis.cleanCodeScore,
    smells: analysis.codeSmells.map((s) => `${s.rule}@L${s.line}`),
  };
}

function printCase(r: DemoCaseResult): void {
  console.log(`--- ${r.caseName} (${r.zipName}) ---`);
  console.log(`Validate: ${r.validation} | SHA-256: ${r.sha256Prefix}...`);
  console.log(`TC1: ${r.tc1} | TC2: ${r.tc2}`);
  console.log(
    `Score: ${r.score}/10 ` +
    `(TC1 ${r.breakdown.testcase1} + TC2 ${r.breakdown.testcase2} + ` +
    `Clean ${r.breakdown.cleanCode} + SOLID ${r.breakdown.solid})`,
  );
  console.log(`CleanCode: ${r.cleanCode}/10 | Smells: ${r.smells.length > 0 ? r.smells.join(', ') : 'none'}`);
  console.log('');
}

export function runDemoCases(): DemoCaseResult[] {
  const passCode = extractFirstSource(path.join(REPO_ROOT, 'sample_solution_pass.zip'));
  const srpCode = extractFirstSource(path.join(REPO_ROOT, 'sample_solution_fail_srp.zip'));
  return [
    gradeSource('PASS', 'sample_solution_pass.zip', passCode),
    gradeSource('SRP-FAIL', 'sample_solution_fail_srp.zip', srpCode),
    gradeSource('INVALID', 'sample_solution_fail_srp.zip', ''),
  ];
}

if (require.main === module) {
  console.log('=== AITA Demo: nop bai + co che tinh diem (code that) ===');
  console.log('Cong thuc worker: TC1 4.0 + TC2 3.0 + CleanCode 2.0 + SOLID 1.0 = 10');
  console.log('');
  for (const r of runDemoCases()) printCase(r);
}
