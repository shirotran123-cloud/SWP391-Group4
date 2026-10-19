import { vi } from 'vitest';
import type { AIRating, PlagiarismMatch, User } from '../types';

/**
 * Shared test fixtures and a fetch stub.
 *
 * Every component in this app fetches on mount, so a test that leaves `fetch` alone either
 * hits a real gateway (flaky, and it fails when Docker or Redis is down) or throws. The
 * `installFetchStub` helper below routes requests by path and returns realistic payloads, so
 * component tests stay hermetic and fast.
 */

export const AIRatingFixture: AIRating = {
  cleanCodeScore: 8.5,
  solidScore: { s: 9, o: 8, l: 8.5, i: 7.5, d: 8 },
  codeSmells: [
    { line: 12, rule: 'Phương thức quá dài', description: 'Nên tách thành hàm nhỏ hơn.' },
    { line: 40, rule: 'Tên biến khó hiểu', description: 'Đặt tên có nghĩa hơn.' },
  ],
  explanation: 'Mã nguồn rõ ràng, còn vài điểm cần cải thiện về đặt tên.',
};

export const PlagiarismMatchFixture: PlagiarismMatch = {
  matchedStudentName: 'Nguyễn Hoàng Vinh',
  matchedStudentId: 'SE170123',
  similarityRate: 92.5,
  sourceCodeA: 'def solve(a):\n    return a\n',
  sourceCodeB: 'def solve(x):\n    return x\n',
  matchedTokens: [{ lineA: [1, 2], lineB: [1, 2] }],
  executionTimeMs: 42,
  isFlagged: true,
  status: 'FLAGGED_PLAGIARISM',
  jaccardSimilarity: 90,
  winnowingContainment: 94,
  astStructuralSimilarity: 93,
};

export const StudentUserFixture: User = {
  userId: 'SE170000',
  email: 'trungse170000@fpt.edu.vn',
  fullName: 'Đinh Thành Trung',
  role: 'STUDENT',
};

export const LecturerUserFixture: User = {
  userId: 'GV0001',
  email: 'trungdt@fe.edu.vn',
  fullName: 'Đinh Thanh Trung',
  role: 'INSTRUCTOR',
};

export const AdminUserFixture: User = {
  userId: 'AD0001',
  email: 'admin@aita.fpt.edu.vn',
  fullName: 'Quản trị viên AITA',
  role: 'ADMIN',
};

export const HodUserFixture: User = {
  userId: 'HOD001',
  email: 'hod@fe.edu.vn',
  fullName: 'Trưởng Bộ Môn',
  role: 'HOD',
};

export const AssignmentFixture = {
  assignmentId: 'ASM-SWP391-01',
  courseId: 'CRS-SWP391',
  title: 'Tính tổng dãy số',
  allowedLanguages: ['python'],
  deadline: '2030-01-01T00:00:00.000Z',
  testcasesCount: 2,
  description: 'Cho một dãy số nguyên, hãy tính tổng.',
};

export const SubmissionFixture = {
  submissionId: 'SUB-000001-AAAAAA',
  studentId: 'SE170000',
  studentName: 'Đinh Thành Trung',
  assignmentId: 'ASM-SWP391-01',
  assignmentTitle: 'Tính tổng dãy số',
  language: 'python',
  fileName: 'Solution.py',
  fileSizeBytes: 2048,
  status: 'COMPLETED',
  score: 8.5,
  createdAt: '2026-10-19T10:00:00.000Z',
  details: {
    aiRating: AIRatingFixture,
    scoreBreakdown: { testcase1: 4, testcase2: 3, cleanCode: 1.7, solid: 0.8, total: 9.5 },
    passedTestcases: 2,
    totalTestcases: 2,
  },
};

export const CourseFixture = {
  courseId: 'CRS-SWP391',
  courseCode: 'SWP391',
  courseName: 'Dự án Phần mềm',
  semester: 'SU2026',
  lecturerId: 'GV0001',
};

export const AppealFixture = {
  appealId: 'APL-000001',
  submissionId: 'SUB-000001-AAAAAA',
  studentId: 'SE170000',
  studentName: 'Đinh Thành Trung',
  reason: 'Em nghĩ bài của em đúng testcase 2 ạ.',
  status: 'PENDING' as const,
  createdAt: '2026-10-19T11:00:00.000Z',
  originalScore: 5.0,
};

export const GradingStepsFixture = [
  { id: 'testcase', label: 'Chạy testcase trong Docker', status: 'passed' as const, detail: '2/2 đạt' },
  { id: 'plagiarism', label: 'Kiểm tra đạo văn AST', status: 'passed' as const, detail: '12% tương đồng' },
  { id: 'review', label: 'AI chấm Clean Code', status: 'in_progress' as const },
];

export const TeamworkMetricFixture = {
  metricId: 'TW-1',
  classId: 'CRS-SWP391',
  studentId: 'SE170000',
  studentName: 'Đinh Thành Trung',
  commitCount: 42,
  linesAdded: 5200,
  linesDeleted: 800,
  contributionPct: 32.5,
  isFreeRider: false,
  analyzedAt: '2026-10-19T10:00:00.000Z',
};

export interface FetchStubOptions {
  /** Extra or overriding routes, keyed by a substring of the request URL. */
  routes?: Array<{ match: string; status?: number; body?: unknown; headers?: Record<string, string> }>;
  /** Default status for unmatched requests. */
  defaultStatus?: number;
  /** Default body for unmatched requests. */
  defaultBody?: unknown;
}

/**
 * Replaces `globalThis.fetch` with a router. Returns a spy so a test can assert which
 * endpoints were called, plus a `restore` function.
 */
export function installFetchStub(options: FetchStubOptions = {}) {
  const defaults: Array<{ match: string; body: unknown; status?: number }> = [
    {
      match: '/api/v1/auth/login',
      body: { statusCode: 200, data: { user: StudentUserFixture, token: 'stub-token' } },
    },
    { match: '/api/v1/assignments', body: { statusCode: 200, data: [AssignmentFixture] } },
    { match: '/api/v1/courses', body: { statusCode: 200, data: [CourseFixture] } },
    {
      match: '/api/v1/submissions/gradebook',
      body: {
        statusCode: 200,
        total: 1,
        data: {
          policy: 'LAST',
          totalRows: 1,
          totalSubmissionsConsidered: 3,
          supersededCount: 2,
          entries: [
            {
              studentId: 'SE170000',
              studentName: 'Đinh Thành Trung',
              assignmentId: 'ASM-SWP391-01',
              assignmentTitle: 'Tính tổng dãy số',
              courseId: 'CRS-SWP391',
              countedSubmissionId: 'SUB-000001-AAAAAA',
              score: 8.5,
              maxScore: 10,
              status: 'COMPLETED',
              submittedAt: '2026-10-19T10:00:00.000Z',
              attemptsCount: 3,
              attempts: [
                { submissionId: 'SUB-000001-AAAAAA', score: 8.5, status: 'COMPLETED', submittedAt: '2026-10-19T10:00:00.000Z', counts: true },
              ],
            },
          ],
          generatedAt: '2026-10-19T12:00:00.000Z',
        },
      },
    },
    { match: '/api/v1/submissions', body: { statusCode: 200, total: 1, data: [SubmissionFixture] } },
    { match: '/api/v1/appeals', body: { statusCode: 200, data: [AppealFixture] } },
    { match: '/api/v1/users', body: { statusCode: 200, data: [StudentUserFixture, LecturerUserFixture] } },
    { match: '/api/v1/plagiarism', body: { statusCode: 200, data: [] } },
    { match: '/api/v1/queue/stats', body: { statusCode: 200, data: { waiting: 0, active: 0, completed: 3, failed: 0 } } },
    { match: '/api/v1/queue/dlq', body: { statusCode: 200, data: [] } },
    { match: '/api/v1/test-cases', body: { statusCode: 200, data: [] } },
    { match: '/api/v1/teamwork', body: { statusCode: 200, data: [TeamworkMetricFixture] } },
  ];

  const routes = [...(options.routes ?? []), ...defaults];

  const spy = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    for (const route of routes) {
      if (url.includes(route.match)) {
        const status = (route as any).status ?? 200;
        return {
          ok: status >= 200 && status < 300,
          status,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => route.body,
          text: async () => JSON.stringify(route.body ?? {}),
          clone() {
            return this;
          },
        } as any;
      }
    }
    const status = options.defaultStatus ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => options.defaultBody ?? { statusCode: 200, data: [] },
      text: async () => JSON.stringify(options.defaultBody ?? { statusCode: 200, data: [] }),
      clone() {
        return this;
      },
    } as any;
  });

  const original = globalThis.fetch;
  (globalThis as any).fetch = spy;

  return {
    spy,
    restore: () => {
      (globalThis as any).fetch = original;
    },
  };
}
