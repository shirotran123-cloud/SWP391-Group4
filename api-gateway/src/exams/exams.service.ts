import { Injectable, Logger } from '@nestjs/common';
import { AssignmentRepository } from '../database/assignment.repository';
import { AssignmentRecord } from '../database/assignment.entity';
import { TestCaseRecord } from '../database/test-case.entity';
import { TestCasesService } from '../test-cases/test-cases.service';
import { PostgresService } from '../database/postgres.service';
import { ExamGeneratorClient } from './exam-generator.client';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { GeneratedExamShape } from './exam.types';

export interface GenerateAndPersistResult {
  assignment: AssignmentRecord;
  testCases: TestCaseRecord[];
  exam: GeneratedExamShape;
  persisted: {
    assignment: boolean;
    updated: boolean;
    testCases: number;
    postgres: boolean;
  };
  source: string;
  latencyMs: number;
}

/** Workflow 1 (UC-08): AI-Assisted Exam & Rubric Generation, end to end. */
@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly examGeneratorClient: ExamGeneratorClient,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly testCasesService: TestCasesService,
    private readonly postgresService: PostgresService,
  ) {}

  public async generatePreview(dto: GenerateExamDto) {
    const { exam, source, latencyMs } = await this.examGeneratorClient.generateExam(dto);
    const rubricTotal = exam.rubric.reduce((sum, item) => sum + (item.maxScore || 0), 0);
    this.warnIfRubricInvalid(rubricTotal, `preview ${dto.courseCode}/${dto.topic}`);
    this.logger.log(
      `[Workflow1] generated (${source}) exam "${exam.title}" | rubric=${rubricTotal.toFixed(2)}/10 | ${latencyMs}ms`,
    );
    return { exam, source, latencyMs, rubricTotal };
  }

  public async generateAndPersist(dto: GenerateExamDto): Promise<GenerateAndPersistResult> {
    const { exam, source, latencyMs } = await this.examGeneratorClient.generateExam(dto);
    this.logger.log(`[Workflow1] generated (${source}) exam "${exam.title}" in ${latencyMs}ms`);

    const rubricTotal = exam.rubric.reduce((sum, item) => sum + (item.maxScore || 0), 0);
    this.warnIfRubricInvalid(rubricTotal, `persist ${dto.courseCode}/${dto.topic}`);

    const assignmentId = ExamsService.buildAssignmentId(dto);
    const courseId = dto.courseId || `COURSE-${dto.courseCode.toUpperCase()}`;
    const deadline = ExamsService.resolveDeadline(dto.dueDate);
    const allCases = [...exam.sampleTestCases, ...exam.hiddenTestCases];

    const payload = {
      assignmentId,
      courseId,
      title: exam.title,
      description: exam.description,
      allowedLanguages: ExamsService.mergeLanguages(dto.language),
      maxScore: 10.0,
      deadline,
      timeLimitMs: 2000,
      memoryLimitMb: 512,
      testcasesCount: allCases.length,
      isActive: true,
    };

    const existing = await this.assignmentRepo.findById(assignmentId);
    let assignment: AssignmentRecord;
    let updated = false;
    if (existing) {
      const { assignmentId: _ignored, ...updatable } = payload;
      const result = await this.assignmentRepo.update(assignmentId, updatable);
      assignment = result || existing;
      updated = true;
      this.logger.log(`[Workflow1] persisted assignment ${assignmentId} (UPDATED - idempotent re-generate).`);
    } else {
      assignment = await this.assignmentRepo.create(payload);
      this.logger.log(`[Workflow1] persisted assignment ${assignmentId} (CREATED).`);
    }

    const testCases = await this.persistTestCases(assignmentId, allCases);
    this.logger.log(`[Workflow1] persisted ${testCases.length} test cases for ${assignmentId}.`);

    return {
      assignment,
      testCases,
      exam,
      persisted: {
        assignment: true,
        updated,
        testCases: testCases.length,
        postgres: this.postgresService.isAvailable(),
      },
      source,
      latencyMs,
    };
  }

  private async persistTestCases(assignmentId: string, cases: GeneratedExamShape['sampleTestCases']): Promise<TestCaseRecord[]> {
    const persisted: TestCaseRecord[] = [];
    for (const tc of cases) {
      const input = tc.input ?? '';
      const expectedOutput = tc.expectedOutput ?? '';
      if (!input.trim() || !expectedOutput.trim()) {
        this.logger.warn(`[Workflow1] Bo qua test case ${tc.id} vi thieu input/expectedOutput.`);
        continue;
      }
      try {
        const record = await this.testCasesService.create({
          assignmentId,
          inputData: input,
          expectedOutput,
          isHidden: !!tc.isHidden,
          weight: tc.weight > 0 ? tc.weight : 1.0,
          timeLimitMs: 2000,
        });
        persisted.push(record);
      } catch (err: any) {
        // Duplicate (re-generate) or invalid case: keep the workflow idempotent instead of failing.
        this.logger.warn(`[Workflow1] Bo qua test case ${tc.id} (${err.message}).`);
      }
    }
    return persisted;
  }

  /** Deterministic, idempotent assignment id: same DTO -> same id. */
  public static buildAssignmentId(dto: GenerateExamDto): string {
    const course = ExamsService.slug(dto.courseCode);
    const topic = ExamsService.slug(dto.topic).slice(0, 40);
    const difficulty = ExamsService.slug(dto.difficulty || 'MEDIUM');
    const suffix = ExamsService.stableSuffix(`${dto.courseCode}|${dto.topic}|${dto.difficulty}`).slice(0, 6);
    return `ASM-${course}-${topic}-${difficulty}-${suffix}`.toUpperCase();
  }

  private static slug(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  private static stableSuffix(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  private static resolveDeadline(dueDate?: string): Date {
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 14);
    return fallback;
  }

  private static mergeLanguages(language: string): string[] {
    const defaults = ['java', 'python', 'cpp', 'dotnet'];
    const requested = (language || '').toLowerCase();
    if (!requested) return defaults;
    if (defaults.includes(requested)) return defaults;
    return [...defaults, requested];
  }

  /** Warns (never throws) when the generated rubric does not sum to 10.0. */
  private warnIfRubricInvalid(total: number, context: string): void {
    if (Math.abs(total - 10.0) > 0.01) {
      this.logger.warn(
        `[Workflow1] Rubric cua ${context} khong dat tong 10.0 (thuc te: ${total.toFixed(2)}). Van tiep tuc vi day khong phai loi chan.`,
      );
    }
  }
}
