import { Injectable, Logger } from '@nestjs/common';
import { SubmissionRepository } from '../database/submission.repository';
import { AssignmentRepository } from '../database/assignment.repository';
import { UserRepository } from '../database/user.repository';
import { SubmissionRecord } from '../database/submission.entity';

/**
 * Which attempt counts when a student submits the same assignment more than once.
 *
 *   LAST   the most recent graded attempt — the common default, because a student who keeps
 *          working deserves the result of their latest work.
 *   BEST   the highest-scoring attempt — rewards improvement and is what some courses use.
 *   FIRST  the earliest attempt — only useful for exam-style one-shot assessments.
 *
 * Only `COMPLETED` attempts are eligible: a submission still queued has no score, and using it
 * would silently drop a student's real mark.
 */
export type AttemptPolicy = 'LAST' | 'BEST' | 'FIRST';

export interface GradebookEntry {
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  /** The attempt that counts, after applying the policy. */
  countedSubmissionId: string;
  score: number | null;
  maxScore: number;
  status: string;
  submittedAt: string;
  /** How many graded attempts exist for this student+assignment pair. */
  attemptsCount: number;
  /** Every attempt, newest first, so a lecturer can see how the mark was reached. */
  attempts: Array<{
    submissionId: string;
    score: number | null;
    status: string;
    submittedAt: string;
    /** True for the attempt that the policy selected. */
    counts: boolean;
  }>;
  /** Set when the counted attempt is not the last one, e.g. BEST picked an older attempt. */
  note?: string;
}

export interface GradebookResult {
  policy: AttemptPolicy;
  totalRows: number;
  totalSubmissionsConsidered: number;
  /** Submissions excluded because the student submitted the same assignment again. */
  supersededCount: number;
  entries: GradebookEntry[];
  generatedAt: string;
}

@Injectable()
export class GradebookService {
  private readonly logger = new Logger(GradebookService.name);

  constructor(
    private readonly submissionRepo: SubmissionRepository,
    private readonly assignmentRepo: AssignmentRepository,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Builds the "only one mark per student per assignment" view.
   *
   * This is the rule that makes resubmission safe: a student may upload as many times as the
   * course allows, but the gradebook shows a single authoritative row per assignment, chosen
   * by the policy. Without it a lecturer sees several rows for the same student and cannot tell
   * which one is the mark of record.
   */
  public async buildGradebook(options?: {
    assignmentId?: string;
    studentId?: string;
    policy?: AttemptPolicy;
  }): Promise<GradebookResult> {
    const policy: AttemptPolicy = options?.policy ?? 'LAST';

    const all = await this.submissionRepo.findAll({
      assignmentId: options?.assignmentId,
      studentId: options?.studentId,
    });

    // Group by the pair that actually defines a mark: one student, one assignment.
    const groups = new Map<string, SubmissionRecord[]>();
    for (const record of all) {
      if (!record || !record.studentId || !record.assignmentId) continue;
      const key = `${record.studentId}::${record.assignmentId}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(record);
      else groups.set(key, [record]);
    }

    const entries: GradebookEntry[] = [];
    let supersededCount = 0;

    for (const [, records] of groups) {
      // Newest first, so "LAST" is trivially the head and the attempts list reads naturally.
      const ordered = [...records].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const graded = ordered.filter((r) => r.status === 'COMPLETED' && typeof r.score === 'number');

      let counted: SubmissionRecord | undefined;
      if (policy === 'FIRST') {
        // Oldest graded attempt.
        counted = graded.length > 0 ? graded[graded.length - 1] : undefined;
      } else if (policy === 'BEST') {
        counted = graded.reduce<SubmissionRecord | undefined>((best, cur) => {
          if (!best) return cur;
          return (cur.score ?? -1) > (best.score ?? -1) ? cur : best;
        }, undefined);
      } else {
        counted = graded[0];
      }

      // Fall back to the newest attempt when nothing is graded yet, so a queued or failed
      // submission is still visible with its status instead of vanishing from the gradebook.
      const display = counted ?? ordered[0];

      const assignment = await this.safeAssignment(display.assignmentId);
      const studentName = await this.resolveStudentName(display.studentId);

      let note: string | undefined;
      if (!counted) {
        note = 'Chưa có lần nộp nào được chấm xong — điểm sẽ cập nhật khi hoàn tất.';
      } else if (policy === 'BEST' && counted.submissionId !== ordered[0].submissionId) {
        note = 'Điểm cao nhất đến từ một lần nộp cũ hơn, không phải lần gần nhất.';
      } else if (policy === 'FIRST' && counted.submissionId !== ordered[0].submissionId) {
        note = 'Chỉ tính lần nộp đầu tiên; các lần sau không được tính điểm.';
      }

      supersededCount += Math.max(0, ordered.length - 1);

      entries.push({
        studentId: display.studentId,
        studentName,
        assignmentId: display.assignmentId,
        assignmentTitle: assignment?.title ?? display.assignmentId,
        courseId: assignment?.courseId ?? '',
        countedSubmissionId: display.submissionId,
        score: typeof display.score === 'number' ? display.score : null,
        maxScore: assignment?.maxScore ?? 10,
        status: display.status,
        submittedAt: new Date(display.createdAt).toISOString(),
        attemptsCount: ordered.length,
        attempts: ordered.map((r) => ({
          submissionId: r.submissionId,
          score: typeof r.score === 'number' ? r.score : null,
          status: r.status,
          submittedAt: new Date(r.createdAt).toISOString(),
          counts: r.submissionId === display.submissionId,
        })),
        note,
      });
    }

    // Stable, readable ordering: by assignment then student.
    entries.sort((a, b) => {
      if (a.assignmentId !== b.assignmentId) return a.assignmentId.localeCompare(b.assignmentId);
      return a.studentId.localeCompare(b.studentId);
    });

    this.logger.log(
      `[Gradebook] policy=${policy}: ${entries.length} dòng điểm từ ${all.length} bài nộp ` +
        `(${supersededCount} lần nộp bị thay thế bởi bài được tính).`,
    );

    return {
      policy,
      totalRows: entries.length,
      totalSubmissionsConsidered: all.length,
      supersededCount,
      entries,
      generatedAt: new Date().toISOString(),
    };
  }

  private async safeAssignment(assignmentId: string) {
    try {
      return await this.assignmentRepo.findById(assignmentId);
    } catch {
      return null;
    }
  }

  private async resolveStudentName(studentId: string): Promise<string> {
    try {
      const user = await this.userRepo.findById(studentId);
      return user?.fullName || studentId;
    } catch {
      return studentId;
    }
  }
}
