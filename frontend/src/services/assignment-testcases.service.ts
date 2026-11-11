import { API_BASE_URL } from '../config/api';

export interface ConfiguredTestCase {
  input: string;
  output: string;
  weight: number;
  isHidden: boolean;
}

export interface AssignmentTestCaseConfig {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: string[];
  testCases: ConfiguredTestCase[];
}

async function readError(response: Response, action: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.message || `${action} (HTTP ${response.status}).`);
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (!response.ok) throw await readError(response, action);
}

export function normalizeTestCaseWeight(rawWeight: unknown): number {
  let safeWeight = Number(String(rawWeight ?? '').replace('%', '').trim());
  if (!Number.isFinite(safeWeight) || safeWeight <= 0) {
    return 1.0;
  }
  if (safeWeight > 10 && safeWeight <= 100) {
    safeWeight = Math.min(10, Math.round((safeWeight / 10) * 100) / 100);
    return safeWeight > 0 ? safeWeight : 1.0;
  }
  return Math.min(10, safeWeight);
}

export async function syncAssignmentTestCases(assignment: AssignmentTestCaseConfig): Promise<void> {
  if (
    assignment.testCases.length === 0 ||
    assignment.testCases.some(
      (tc) => tc.input === undefined || tc.input === null || !String(tc.output ?? '').trim(),
    )
  ) {
    throw new Error('Bài tập cần ít nhất 1 testcase với đầu ra mong đợi (Expected Output) không để trống.');
  }

  const seenPairs = new Set<string>();
  const normalizedCases = assignment.testCases.map((tc, index) => {
    const inputData = String(tc.input ?? '');
    const expectedOutput = String(tc.output ?? '');
    const key = `${inputData}\u0000${expectedOutput}`;
    if (seenPairs.has(key)) {
      throw new Error(`Testcase #${index + 1} bị trùng lặp Input và Expected Output với testcase khác.`);
    }
    seenPairs.add(key);
    return {
      inputData,
      expectedOutput,
      weight: normalizeTestCaseWeight(tc.weight),
      isHidden: Boolean(tc.isHidden),
      timeLimitMs: assignment.timeLimitMs || 2000,
    };
  });

  const baseUrl = `${API_BASE_URL}/api/v1`;
  const assignmentUrl = `${baseUrl}/assignments/${encodeURIComponent(assignment.id)}`;
  const assignmentPayload = {
    assignmentId: assignment.id,
    courseId: assignment.courseId,
    title: assignment.title,
    description: assignment.description,
    allowedLanguages: assignment.allowedLanguages,
    maxScore: 10,
    deadline: new Date(assignment.deadline).toISOString(),
    timeLimitMs: assignment.timeLimitMs,
    memoryLimitMb: assignment.memoryLimitMb,
    testcasesCount: normalizedCases.length,
  };

  const existingAssignment = await fetch(assignmentUrl);
  if (existingAssignment.status === 404) {
    const response = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignmentPayload),
    });
    await assertOk(response, 'Không thể lưu đề bài');
  } else {
    await assertOk(existingAssignment, 'Không thể kiểm tra đề bài đã lưu');
    const response = await fetch(assignmentUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignmentPayload),
    });
    await assertOk(response, 'Không thể cập nhật cấu hình đề bài');
  }

  // Cập nhật nguyên tử (atomic transaction trong PostgreSQL) thay thế cho chuỗi DELETE/POST rời rạc
  const replaceUrl = `${baseUrl}/test-cases/assignment/${encodeURIComponent(assignment.id)}`;
  const replaceResponse = await fetch(replaceUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCases: normalizedCases }),
  });
  await assertOk(replaceResponse, 'Không thể lưu đồng bộ bộ testcase lên máy chủ');

  const testCasesUrl = `${baseUrl}/test-cases/assignment/${encodeURIComponent(assignment.id)}?includeHidden=true`;
  const verifyResponse = await fetch(testCasesUrl);
  await assertOk(verifyResponse, 'Không thể xác minh bộ testcase đã lưu');
  const verifyBody = await verifyResponse.json();
  if (!Array.isArray(verifyBody.data) || verifyBody.data.length !== normalizedCases.length) {
    throw new Error(
      `Đã cấu hình ${normalizedCases.length} testcase nhưng máy chủ chỉ xác nhận lưu được ${Array.isArray(verifyBody.data) ? verifyBody.data.length : 0}.`,
    );
  }
}

export async function verifyServerAssignmentReady(
  assignmentId: string,
  baseApiUrl: string = API_BASE_URL,
): Promise<{ testCasesCount: number; savedTestCases: any[] }> {
  const baseUrl = `${baseApiUrl}/api/v1`;
  const assignmentResponse = await fetch(`${baseUrl}/assignments/${encodeURIComponent(assignmentId)}`);
  await assertOk(assignmentResponse, 'Đề bài chưa tồn tại trên máy chủ; giảng viên cần xuất bản lại đề');
  const assignmentBody = await assignmentResponse.json();
  if (assignmentBody.data?.isActive === false) {
    throw new Error('Bài tập hiện đã đóng nộp trên máy chủ.');
  }

  const testCasesResponse = await fetch(`${baseUrl}/test-cases/assignment/${encodeURIComponent(assignmentId)}`);
  await assertOk(testCasesResponse, 'Không thể kiểm tra danh sách testcase của đề bài');
  const testCasesBody = await testCasesResponse.json();
  const savedTestCases = testCasesBody.data;
  if (!Array.isArray(savedTestCases) || savedTestCases.length === 0) {
    throw new Error(
      'Đề bài hiện có 0 testcase trên máy chủ (hoặc bộ testcase trước đó chưa được lưu). Giảng viên cần cấu hình và lưu lại testcase trước khi sinh viên nộp bài.',
    );
  }

  const declaredCount = assignmentBody.data?.testcasesCount;
  if (typeof declaredCount === 'number' && declaredCount > 0 && savedTestCases.length !== declaredCount) {
    throw new Error(
      `Đề bài khai báo ${declaredCount} testcase nhưng máy chủ chỉ có ${savedTestCases.length} testcase.`,
    );
  }

  return { testCasesCount: savedTestCases.length, savedTestCases };
}

export async function verifyAssignmentTestCases(assignment: AssignmentTestCaseConfig): Promise<void> {
  const { savedTestCases } = await verifyServerAssignmentReady(assignment.id);
  if (savedTestCases.length !== assignment.testCases.length) {
    throw new Error(
      `Đã cấu hình ${assignment.testCases.length} testcase nhưng máy chủ chỉ xác nhận được ${savedTestCases.length}.`,
    );
  }

  const publicConfigured = assignment.testCases.filter((testCase) => !testCase.isHidden);
  const publicSaved = savedTestCases.filter((testCase: any) => !testCase.isHidden);
  const publicCasesMatch =
    publicSaved.length === publicConfigured.length &&
    publicConfigured.every((configured) =>
      publicSaved.some(
        (saved: any) =>
          String(saved.inputData ?? '').trim() === String(configured.input ?? '').trim() &&
          String(saved.expectedOutput ?? '').trim() === String(configured.output ?? '').trim(),
      ),
    );
  if (!publicCasesMatch) {
    throw new Error('Danh sách testcase công khai trên máy chủ không khớp với đề bài đã xuất bản.');
  }
}
