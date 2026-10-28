import { API_BASE_URL } from '../config';

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

export async function syncAssignmentTestCases(assignment: AssignmentTestCaseConfig): Promise<void> {
  if (assignment.testCases.length === 0 || assignment.testCases.some((tc) => !tc.input.trim() || !tc.output.trim())) {
    throw new Error('Bài tập cần có testcase với đầu vào và kết quả mong đợi đầy đủ.');
  }

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
    testcasesCount: assignment.testCases.length,
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

  const testCasesUrl = `${baseUrl}/test-cases/assignment/${encodeURIComponent(assignment.id)}?includeHidden=true`;
  const listResponse = await fetch(testCasesUrl);
  await assertOk(listResponse, 'Không thể đọc bộ testcase đã lưu');
  const listBody = await listResponse.json();
  const savedTestCases = listBody.data;
  if (!Array.isArray(savedTestCases)) {
    throw new Error('Máy chủ trả về danh sách testcase không hợp lệ.');
  }

  const isSameSet =
    savedTestCases.length === assignment.testCases.length &&
    assignment.testCases.every((configured) =>
      savedTestCases.some((saved: any) =>
        saved.inputData === configured.input &&
        saved.expectedOutput === configured.output &&
        Boolean(saved.isHidden) === configured.isHidden &&
        Number(saved.weight) === Number(configured.weight),
      ),
    );

  if (!isSameSet) {
    for (const saved of savedTestCases) {
      const response = await fetch(`${baseUrl}/test-cases/${encodeURIComponent(saved.testCaseId)}`, {
        method: 'DELETE',
      });
      await assertOk(response, `Không thể thay thế testcase ${saved.testCaseId}`);
    }

    for (const [index, testCase] of assignment.testCases.entries()) {
      const response = await fetch(`${baseUrl}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          inputData: testCase.input,
          expectedOutput: testCase.output,
          weight: Number(testCase.weight),
          isHidden: testCase.isHidden,
          timeLimitMs: assignment.timeLimitMs,
        }),
      });
      await assertOk(response, `Không thể lưu testcase ${index + 1}`);
    }
  }

  const verifyResponse = await fetch(testCasesUrl);
  await assertOk(verifyResponse, 'Không thể xác minh bộ testcase đã lưu');
  const verifyBody = await verifyResponse.json();
  if (!Array.isArray(verifyBody.data) || verifyBody.data.length !== assignment.testCases.length) {
    throw new Error(
      `Đã cấu hình ${assignment.testCases.length} testcase nhưng máy chủ chỉ xác nhận lưu được ${Array.isArray(verifyBody.data) ? verifyBody.data.length : 0}.`,
    );
  }
}

export async function verifyAssignmentTestCases(assignment: AssignmentTestCaseConfig): Promise<void> {
  const baseUrl = `${API_BASE_URL}/api/v1`;
  const assignmentResponse = await fetch(
    `${baseUrl}/assignments/${encodeURIComponent(assignment.id)}`,
  );
  await assertOk(assignmentResponse, 'Đề bài chưa được lưu trên máy chủ; giảng viên cần xuất bản lại đề');
  const assignmentBody = await assignmentResponse.json();
  if (assignmentBody.data?.testcasesCount !== assignment.testCases.length) {
    throw new Error(
      `Đề bài cấu hình ${assignment.testCases.length} testcase nhưng máy chủ khai báo ${assignmentBody.data?.testcasesCount ?? 0}.`,
    );
  }

  const testCasesResponse = await fetch(
    `${baseUrl}/test-cases/assignment/${encodeURIComponent(assignment.id)}`,
  );
  await assertOk(testCasesResponse, 'Không thể xác minh testcase của đề bài');
  const testCasesBody = await testCasesResponse.json();
  const savedTestCases = testCasesBody.data;
  if (!Array.isArray(savedTestCases) || savedTestCases.length !== assignment.testCases.length) {
    throw new Error(
      `Đã cấu hình ${assignment.testCases.length} testcase nhưng máy chủ chỉ xác nhận được ${Array.isArray(savedTestCases) ? savedTestCases.length : 0}.`,
    );
  }

  const publicConfigured = assignment.testCases.filter((testCase) => !testCase.isHidden);
  const publicSaved = savedTestCases.filter((testCase: any) => !testCase.isHidden);
  const publicCasesMatch =
    publicSaved.length === publicConfigured.length &&
    publicConfigured.every((configured) =>
      publicSaved.some((saved: any) =>
        saved.inputData === configured.input &&
        saved.expectedOutput === configured.output &&
        Number(saved.weight) === Number(configured.weight),
      ),
    );
  if (!publicCasesMatch) {
    throw new Error('Danh sách testcase công khai trên máy chủ không khớp với đề bài đã xuất bản.');
  }
}
