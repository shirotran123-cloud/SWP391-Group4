/**
 * Workflow 1 (UC-08) regression suite: AI-Assisted Exam & Rubric Generation.
 *
 * Pure in-process Nest DI: Test.createTestingModule({ imports: [DatabaseModule,
 * ExamsModule] }) with the JSON file stores under process.cwd()/data. No Docker,
 * no Redis, no PostgreSQL required. Works with the GenAI Hub up (real HTTP path,
 * source = GENAI_HUB) or down (source = LOCAL_DETERMINISTIC).
 *
 * Run: npx ts-node --transpile-only test/exams-workflow1.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from '../src/database/database.module';
import { AssignmentRepository } from '../src/database/assignment.repository';
import { ExamsModule } from '../src/exams/exams.module';
import { ExamsService } from '../src/exams/exams.service';
import { ExamGeneratorClient } from '../src/exams/exam-generator.client';
import { GenerateExamDto } from '../src/exams/dto/generate-exam.dto';

const STORE_FILES = ['assignments_store.json', 'test_cases_store.json'];

/** Real-DI module composition used by the harness below. */
@Module({ imports: [DatabaseModule, ExamsModule] })
class ExamsWorkflow1HarnessModule {}

interface Harness {
  get(token: any): any;
  close(): Promise<void>;
}

/**
 * Preferred path is Nest's testing utility. This repo's node_modules does not
 * ship @nestjs/testing, so the harness degrades to NestFactory.
 * createApplicationContext over the same [DatabaseModule, ExamsModule] graph,
 * which still yields REAL DI instances (identical providers/wiring).
 */
async function createHarness(): Promise<Harness> {
  try {
    const testing = require('@nestjs/testing');
    if (testing && testing.Test) {
      const moduleRef = await testing.Test.createTestingModule({
        imports: [DatabaseModule, ExamsModule],
      }).compile();
      return { get: (token: any) => moduleRef.get(token), close: () => moduleRef.close() };
    }
  } catch {
    // @nestjs/testing unavailable: fall through to the application context harness.
  }
  const app = await NestFactory.createApplicationContext(ExamsWorkflow1HarnessModule, { logger: false });
  return { get: (token: any) => app.get(token), close: () => app.close() };
}

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

function snapshotStores(): Map<string, Buffer | null> {
  const snap = new Map<string, Buffer | null>();
  const dir = path.resolve(process.cwd(), 'data');
  for (const f of STORE_FILES) {
    const p = path.join(dir, f);
    snap.set(f, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  return snap;
}

function restoreStores(snap: Map<string, Buffer | null>): void {
  const dir = path.resolve(process.cwd(), 'data');
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

function sampleDto(): GenerateExamDto {
  const dto = new GenerateExamDto();
  dto.topic = 'Mang tich luy va xu ly tran so nguyen';
  dto.courseCode = 'SWP391';
  dto.difficulty = 'MEDIUM';
  dto.language = 'python';
  dto.learningOutcomes = ['Phan tich yeu cau', 'Toi uu do phuc tap O(N)'];
  dto.numTestCases = 5;
  return dto;
}

function rubricTotal(exam: any): number {
  return (exam.rubric || []).reduce((s: number, r: any) => s + (r.maxScore || 0), 0);
}

async function main(): Promise<boolean> {
  const snap = snapshotStores();
  let moduleRef: Harness = null;
  try {
    moduleRef = await createHarness();

    const examsService = moduleRef.get(ExamsService);
    const assignmentRepo = moduleRef.get(AssignmentRepository);

    const dto = sampleDto();
    const hubUp = await moduleRef.get(ExamGeneratorClient).isHubHealthy();
    console.log(`--- exams-workflow1: GenAI Hub reachable = ${hubUp}`);

    // ---- 1. Deterministic fallback produces a complete exam ----
    const local = ExamGeneratorClient.buildDeterministicExam(dto);
    check(!!local.title && local.title.includes(dto.topic), 'local exam title mentions the topic', local.title);
    check(!!local.description && local.description.length > 0, 'local exam has non-empty description');
    check(!!local.problemStatement && local.problemStatement.length > 0, 'local exam has non-empty problemStatement');
    check(local.sampleTestCases.length >= 3, 'local exam has >= 3 sample test cases', `got ${local.sampleTestCases.length}`);
    check(local.hiddenTestCases.length >= 1, 'local exam has >= 1 hidden test case', `got ${local.hiddenTestCases.length}`);
    check(local.rubric.length >= 1, 'local exam has >= 1 rubric item', `got ${local.rubric.length}`);
    check(!!local.referenceSolution && local.referenceSolution.length > 0, 'local exam has non-empty referenceSolution');
    check(!!local.starterCode && local.starterCode.length > 0, 'local exam has non-empty starterCode');

    // ---- 2. Rubric scores sum to exactly 10.0 ----
    const localTotal = rubricTotal(local);
    check(Math.abs(localTotal - 10.0) <= 0.01, 'local rubric maxScore sums to 10.0', `got ${localTotal}`);

    // ---- 3. Determinism: same DTO in => deep-equal out ----
    const local2 = ExamGeneratorClient.buildDeterministicExam(sampleDto());
    check(JSON.stringify(local) === JSON.stringify(local2), 'local generator is deterministic for identical DTO');
    const otherDto = sampleDto();
    otherDto.topic = 'Do thi va duong di ngan nhat';
    const local3 = ExamGeneratorClient.buildDeterministicExam(otherDto);
    check(JSON.stringify(local) !== JSON.stringify(local3), 'local generator varies with different DTO');

    // ---- 4. Test case integrity ----
    const allLocal = [...local.sampleTestCases, ...local.hiddenTestCases];
    check(allLocal.every((t) => typeof t.input === 'string' && t.input.length > 0), 'every test case has non-empty input');
    check(allLocal.every((t) => typeof t.expectedOutput === 'string' && t.expectedOutput.length > 0), 'every test case has non-empty expectedOutput');
    check(local.hiddenTestCases.every((t) => t.isHidden === true), 'every hidden case is marked isHidden: true');
    check(local.sampleTestCases.every((t) => t.isHidden === false), 'every sample case is marked isHidden: false');

    // ---- 5. generatePreview: no persistence ----
    const before = (await assignmentRepo.findAll()).length;
    const preview = await examsService.generatePreview(dto);
    const after = (await assignmentRepo.findAll()).length;
    console.log(`--- exams-workflow1 preview source = ${preview.source}, rubricTotal = ${preview.rubricTotal}`);
    check(Math.abs(preview.rubricTotal - rubricTotal(preview.exam)) < 1e-9, 'preview rubricTotal equals sum of rubric maxScore', `${preview.rubricTotal} vs ${rubricTotal(preview.exam)}`);
    check(preview.source === 'GENAI_HUB' || preview.source === 'LOCAL_DETERMINISTIC', 'preview reports a known source', preview.source);
    if (preview.source === 'LOCAL_DETERMINISTIC') {
      check(Math.abs(preview.rubricTotal - 10.0) <= 0.01, 'preview rubricTotal is 10.0 on the deterministic engine', `${preview.rubricTotal}`);
    }
    check(after === before, 'generatePreview performs NO persistence', `before=${before} after=${after}`);

    // ---- 6. generateAndPersist: creates + idempotent re-generate ----
    const countBefore = (await assignmentRepo.findAll()).length;
    const first = await examsService.generateAndPersist(dto);
    const countAfterFirst = (await assignmentRepo.findAll()).length;
    const expectedCases = first.exam.sampleTestCases.length + first.exam.hiddenTestCases.length;
    console.log(`--- exams-workflow1 persist source = ${first.source}, assignment = ${first.assignment.assignmentId}, testCases = ${first.testCases.length}/${expectedCases}`);

    check(countAfterFirst === countBefore + 1, 'generateAndPersist creates exactly one assignment', `before=${countBefore} after=${countAfterFirst}`);
    check(first.persisted.assignment === true, 'generateAndPersist reports assignment persisted');
    check(first.persisted.updated === false, 'first call reports created (updated=false)');
    check(first.testCases.length === expectedCases, 'all generated test cases persisted', `${first.testCases.length} of ${expectedCases}`);
    check(first.persisted.testCases === first.testCases.length, 'persisted.testCases matches returned rows');
    check(first.assignment.maxScore === 10.0, 'assignment maxScore is 10', `${first.assignment.maxScore}`);
    check(first.assignment.timeLimitMs === 2000, 'assignment timeLimitMs is 2000', `${first.assignment.timeLimitMs}`);
    check(first.assignment.memoryLimitMb === 512, 'assignment memoryLimitMb is 512', `${first.assignment.memoryLimitMb}`);
    check(first.assignment.isActive === true, 'assignment isActive is true');
    check((first.assignment.allowedLanguages || []).map((l: string) => l.toLowerCase()).includes(dto.language), 'allowedLanguages includes the requested language', JSON.stringify(first.assignment.allowedLanguages));
    check(first.assignment.title === first.exam.title, 'persisted title comes from the generated exam');
    check(!!first.assignment.assignmentId && first.assignment.assignmentId.startsWith('ASM-SWP391-'), 'assignmentId is deterministic and course-scoped', first.assignment.assignmentId);

    const second = await examsService.generateAndPersist(sampleDto());
    const countAfterSecond = (await assignmentRepo.findAll()).length;
    check(countAfterSecond === countAfterFirst, 'second generate with same DTO creates NO duplicate assignment', `first=${countAfterFirst} second=${countAfterSecond}`);
    check(second.persisted.updated === true, 'second call reports the assignment was UPDATED');
    check(second.assignment.assignmentId === first.assignment.assignmentId, 'idempotent assignmentId across calls');

    console.log(`---\nEXAMS-WORKFLOW1: ${passed} passed, ${failed} failed (hub ${hubUp ? 'UP' : 'DOWN'})`);
    return failed === 0;
  } finally {
    if (moduleRef) await moduleRef.close().catch(() => undefined);
    restoreStores(snap);
  }
}

export { main as runExamsWorkflow1Suite };

if (require.main === module) {
  main().then((ok) => {
    if (!ok) process.exit(1);
  }).catch((err) => {
    console.error('[FAIL] exams-workflow1 crashed:', err);
    process.exit(1);
  });
}
