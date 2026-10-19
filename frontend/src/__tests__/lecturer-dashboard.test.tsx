/**
 * Deep behaviour tests for `LecturerDashboard`.
 *
 * `dashboards.test.tsx` already pins the shell of this screen: it renders, the six tab buttons
 * exist, the gradebook is requested, the attempt-policy selector re-queries with `policy=BEST`,
 * and a failing/empty gradebook does not crash. This file deliberately repeats none of that.
 *
 * What is covered here is what a lecturer actually does in the six tabs — composing an exam with
 * Gemini (including the missing-key, rejected-key, hub-fallback and every-model-failed paths),
 * importing a class roster from CSV, creating a course, publishing an assignment, reading and
 * writing `aita_published_assignments`, and working the gradebook rows (attempt badge, download,
 * detail modal). Every test installs the shared fetch router so nothing reaches the network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Monaco loads its editor bundle from a CDN: jsdom cannot run it and a test must not fetch it.
// The stub echoes whatever value the modal hands the editor, which makes the code tab assertable.
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language }: { value?: string; language?: string }) => (
    <pre data-testid="monaco-editor" data-language={language}>
      {value}
    </pre>
  ),
  DiffEditor: () => <div data-testid="monaco-diff" />,
}));

import { LecturerDashboard, type PublishedAssignment } from '../components/LecturerDashboard';
import { installFetchStub } from '../test/fixtures';

const AI_KEY = 'AIzaStubKeyForTests';

/** The six sub-tabs, matched on their numbered labels. */
const TAB = {
  courses: /1\. Khóa Học & Lớp Học Phần/,
  ai: /2\. Soạn Đề & Barem AI/,
  excel: /3\. Nhập Danh Sách Lớp Từ Excel/,
  submissions: /4\. Sổ Điểm & Bài Nộp/,
  rbl: /5\. Phòng Nghiên Cứu/,
  appeals: /6\. Phúc Khảo Điểm/,
} as const;

const STORAGE_KEY = 'aita_published_assignments';

/**
 * `LecturerDashboard` is a ~3,500-line component that renders six sub-screens; a single test in
 * this file mounts it, drives several tabs and awaits real network round-trips. The 5s default is
 * tight enough that a loaded CI box fails correct tests, so give the whole file room to breathe.
 */
vi.setConfig({ testTimeout: 20_000 });

/**
 * Every modal in this component closes through an icon-only button (`<X />` with no text), so it
 * has no accessible name and cannot be matched by role+name. They are the only buttons in the
 * document whose text content is empty, which makes them unambiguous to locate.
 */
const iconOnlyButtons = () =>
  screen.getAllByRole('button').filter((b) => (b.textContent ?? '').trim() === '');

/** Clicks the single icon-only button on screen — the open modal's close control. */
const clickModalClose = async (user: ReturnType<typeof userEvent.setup>) => {
  const candidates = iconOnlyButtons();
  expect(candidates).toHaveLength(1);
  await user.click(candidates[0]);
};

/** A published assignment exactly as the component persists it. */
const storedAssignment = (over: Partial<PublishedAssignment> = {}): PublishedAssignment => ({
  id: 'ASM-SWP391-KIEM-THU',
  courseId: 'CRS-SWP391',
  title: 'Bài tập kiểm thử đã xuất bản',
  description: 'Cho một dãy số nguyên, hãy tính tổng và in ra kết quả.',
  deadline: '2030-01-01T00:00:00.000Z',
  timeLimitMs: 2000,
  memoryLimitMb: 512,
  allowedLanguages: ['python'],
  testCases: [{ input: '2\n1 2', output: '3', weight: 10, isHidden: false }],
  createdAt: '2026-01-01 10:00:00',
  status: 'PUBLISHED',
  submissionCount: 0,
  ...over,
});

/** One gradebook row: three attempts, so the "Lượt Nộp" badge must read "3 lần". */
const gradebookWithAttempts = {
  statusCode: 200,
  total: 2,
  data: {
    policy: 'BEST',
    totalRows: 2,
    totalSubmissionsConsidered: 4,
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
        note: 'Điểm cao nhất nằm ở lượt nộp thứ 2',
      },
      {
        studentId: 'SE170002',
        studentName: 'Lê Minh Châu',
        assignmentId: 'ASM-SWP391-02',
        assignmentTitle: 'Cây nhị phân tìm kiếm',
        courseId: 'CRS-SWP391',
        countedSubmissionId: 'SUB-000002-BBBBBB',
        score: 0,
        maxScore: 10,
        status: 'FAILED',
        submittedAt: null,
        attemptsCount: 1,
      },
    ],
    generatedAt: '2026-10-19T12:00:00.000Z',
  },
};

/** `ListModels` only ever returns text models; the TTS entry must be filtered out. */
const MODEL_LIST = {
  models: [
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
  ],
};

const generatedExam = {
  title: 'Đề thi Dijkstra với hàng đợi ưu tiên',
  description: 'Bối cảnh: điều phối robot kho vận. Yêu cầu: tối ưu O(N log N).',
  timeLimitMs: 3000,
  memoryLimitMb: 256,
  testCases: [
    { input: '3 2\n1 2 5', output: '5', weight: 2.5, isHidden: false },
    { input: '1 0', output: '0', weight: 3.0, isHidden: true },
  ],
  rubric: [
    {
      criterion: 'Tính đúng đắn thuật toán',
      maxScore: 7,
      description: 'Vượt qua toàn bộ testcase',
      levels: [{ scorePercent: 100, description: 'Đúng hoàn toàn' }],
    },
    { criterion: 'Mã nguồn sạch & SOLID', maxScore: 3, description: 'Tách lớp rõ ràng' },
  ],
  starterCode: '// TODO: cài đặt Dijkstra',
  referenceSolution: 'class Solution { /* lời giải chuẩn */ }',
};

const geminiTextResponse = (payload: unknown) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
});

/** What the GenAI Hub behind `/api/v1/exams/preview` answers with. */
const hubExamResponse = {
  statusCode: 200,
  data: {
    latencyMs: 1200,
    exam: {
      title: 'Đề từ trợ lý AI của hệ thống',
      description: 'Mô tả do hub sinh ra.',
      problemStatement: 'Bài toán mẫu.',
      timeLimitMs: 2500,
      memoryLimitMb: 256,
      sampleTestCases: [{ input: '1 2', expectedOutput: '3', weight: 1.0 }],
      hiddenTestCases: [{ input: '5 5', output: '10' }],
      rubric: [{ criterion: 'Đúng', maxScore: 10, description: 'Chạy đúng' }],
      starterCode: '// hub-starter',
      referenceSolution: '// hub-solution',
    },
  },
};

const csvFile = (content: string, name = 'roster.csv') =>
  new File([content], name, { type: 'text/csv' });

describe('LecturerDashboard — tab content', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  const openTab = async (user: ReturnType<typeof userEvent.setup>, tab: RegExp) => {
    await user.click(screen.getByRole('button', { name: tab }));
  };

  const renderDashboard = async () => {
    const utils = render(<LecturerDashboard />);
    // The tab bar is in the initial markup; waiting for it keeps the assertions deterministic.
    await screen.findByRole('button', { name: TAB.courses });
    return utils;
  };

  it('opens on the course list and shows the classes loaded from the gateway', async () => {
    await renderDashboard();
    expect(screen.getByText(/Các Lớp Học Phần Đang Giảng Dạy \(1 Môn\)/)).toBeInTheDocument();
    expect(await screen.findByText('Dự án Phần mềm')).toBeInTheDocument();
    expect(screen.getByText('SWP391')).toBeInTheDocument();
    expect(screen.getByText(/Sĩ số:/)).toBeInTheDocument();
  });

  it('renders the AI composer with its prompt box, testcase editor and rubric controls', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openTab(user, TAB.ai);

    expect(
      screen.getByText(/Soạn Thảo Đề Bài Tập & Sinh Barem Bằng Google Gemini AI Thật/),
    ).toBeInTheDocument();
    // Without a stored key the composer advertises that one is needed.
    expect(screen.getByText(/Nhập khóa API để sinh đề/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Ví dụ: 'Tạo bài tập về cây AVL/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bộ Test Cases Tự Động - Tổng 2 Test/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Thêm Test Case' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ })).toBeInTheDocument();
  });

  it('renders the roster import tab with the course picker and both transaction scenarios', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openTab(user, TAB.excel);

    expect(
      screen.getByText(/Nhập Danh Sách Sinh Viên Hàng Loạt & Kiểm Định Giao Dịch An Toàn/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\. Chọn Lớp Học Phần Cần Ghi Danh:/)).toBeInTheDocument();
    expect(document.querySelector('#roster-csv-input')).toBeTruthy();
    expect(screen.getByText(/Kịch Bản 1: Nhập Thành Công Trọn Vẹn/)).toBeInTheDocument();
    expect(screen.getByText(/Kịch Bản 2: Minh Chứng Lỗi Dòng N & Hoàn Tác Toàn Bộ/)).toBeInTheDocument();
  });

  it('renders the gradebook tab with its table headers and row actions', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openTab(user, TAB.submissions);

    expect(
      screen.getByText(/Sổ Theo Dõi Bài Nộp Lập Trình & Giám Sát Liêm Chính Học Thuật/),
    ).toBeInTheDocument();
    for (const header of ['Mã Nộp', 'Sinh Viên', 'Lượt Nộp', 'File Nén (.zip)', 'Tổng Điểm']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(await screen.findByRole('button', { name: 'Xem Chi Tiết' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải .zip' })).toBeInTheDocument();
  });

  it('renders the research lab tab through RblBenchmarkView', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openTab(user, TAB.rbl);

    expect(
      screen.getByText(/Phòng Thí Nghiệm Nghiên Cứu Đối Soát Mã Nguồn/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cặp Bài #01/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chạy Kiểm Tra Đối Soát Cặp Này/ })).toBeInTheDocument();
  });

  it('renders the appeals tab through LecturerAppealsManager and loads the inbox', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openTab(user, TAB.appeals);

    expect(await screen.findByText(/Quản Lý & Thẩm Định Đơn Phúc Khảo/)).toBeInTheDocument();
    // The fixture inbox holds a single PENDING appeal.
    expect(screen.getByRole('button', { name: /Chờ Duyệt \(1\)/ })).toBeInTheDocument();
    expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/appeals'))).toBe(true);
  });

  it('jumps to the composer from the header shortcut', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole('button', { name: /Tạo Đề Bài Mới/ }));
    expect(
      screen.getByText(/Soạn Thảo Đề Bài Tập & Sinh Barem Bằng Google Gemini AI Thật/),
    ).toBeInTheDocument();
  });
});

describe('LecturerDashboard — Gemini AI exam generation', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  const openComposer = async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    return user;
  };

  const geminiRoutes = (overrides: Array<{ match: string; status?: number; body?: unknown }> = []) => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        ...overrides,
        { match: ':generateContent', body: geminiTextResponse(generatedExam) },
        { match: 'generativelanguage', body: MODEL_LIST },
      ],
    });
  };

  it('asks for an API key instead of calling Gemini when none is configured', async () => {
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Dùng AI Sinh Đề & Barem/ }));

    expect(
      screen.getByText(/Cấu Hình Trí Tuệ Nhân Tạo Thật \(Google Gemini AI\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hãy nhập khóa API Google Gemini của bạn để sinh đề/),
    ).toBeInTheDocument();
    // The primary path is the lecturer's own key, so no request may leave for Google.
    expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('generativelanguage'))).toBe(false);
  });

  it('reopens the config modal from the inline "Nhập Khóa Ngay" shortcut', async () => {
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Dùng AI Sinh Đề & Barem/ }));
    await user.click(screen.getByRole('button', { name: /Nhập Khóa Ngay/ }));
    expect(screen.getByPlaceholderText('Dán khóa API của bạn vào đây...')).toBeInTheDocument();
  });

  it('saves the key to localStorage and flips the header badge', async () => {
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));
    await user.type(screen.getByPlaceholderText('Dán khóa API của bạn vào đây...'), AI_KEY);
    await user.click(screen.getByRole('button', { name: /Lưu Khóa & Áp Dụng/ }));

    expect(localStorage.getItem('aita_gemini_api_key')).toBe(AI_KEY);
    expect(screen.queryByText(/Cấu Hình Trí Tuệ Nhân Tạo Thật \(Google Gemini AI\)/)).toBeNull();
    expect(screen.getByRole('button', { name: /Đã Cấu Hình Khóa Google Gemini/ })).toBeInTheDocument();
    expect(screen.getByText(/Đã có khóa API — sẵn sàng sinh đề/)).toBeInTheDocument();
  });

  it('prefills the config modal with the stored key', async () => {
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Đã Cấu Hình Khóa Google Gemini/ }));
    expect(screen.getByPlaceholderText('Dán khóa API của bạn vào đây...')).toHaveValue(AI_KEY);
  });

  it('refuses to ping Gemini while the key field is empty', async () => {
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));
    await user.click(screen.getByRole('button', { name: /Kiểm Tra Kết Nối AI/ }));
    expect(await screen.findByText(/Vui lòng nhập khóa API trước khi kiểm tra/)).toBeInTheDocument();
  });

  it('pings Gemini and lists only the text models it offers', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: 'generativelanguage', body: MODEL_LIST }] });
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));
    await user.type(screen.getByPlaceholderText('Dán khóa API của bạn vào đây...'), AI_KEY);
    await user.click(screen.getByRole('button', { name: /Kiểm Tra Kết Nối AI/ }));

    expect(await screen.findByText(/Tìm thấy 1 mô hình văn bản khả dụng/)).toBeInTheDocument();
    // The available list replaces the hard-coded options, and the best text model is selected.
    const modelSelect = screen
      .getByRole('option', { name: /Tự Động Chọn Mô Hình Nhanh Nhất/ })
      .closest('select') as HTMLSelectElement;
    expect(modelSelect).toHaveValue('gemini-2.0-flash');
    expect(screen.getByRole('option', { name: /gemini-2\.0-flash \(Siêu tốc/ })).toBeInTheDocument();
  });

  it('surfaces a rejected key when the ping fails', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: 'generativelanguage',
          status: 400,
          body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
        },
      ],
    });
    const user = await openComposer();
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));
    await user.type(screen.getByPlaceholderText('Dán khóa API của bạn vào đây...'), 'khóa-sai');
    await user.click(screen.getByRole('button', { name: /Kiểm Tra Kết Nối AI/ }));

    expect(await screen.findByText(/Lỗi kết nối \(400\): API key not valid/)).toBeInTheDocument();
  });

  it('generates an exam, rewrites the form and offers the AI starter code', async () => {
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    geminiRoutes();
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    expect(await screen.findByText(/đã sinh đề & barem thành công/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập tên bài tập hoặc chủ đề...')).toHaveValue(generatedExam.title);
    expect(screen.getByText(/Tổng 2 Test/)).toBeInTheDocument();
    expect(screen.getByText(/Barem Chấm Điểm Học Thuật \(Sinh Bởi Google Gemini AI\)/)).toBeInTheDocument();
    expect(screen.getByText(/1\. Tính đúng đắn thuật toán/)).toBeInTheDocument();
    expect(screen.getByText(/100% điểm:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Đã tạo đề bài "Đề thi Dijkstra với hàng đợi ưu tiên" kèm 2 testcases và 2 tiêu chí barem/),
    ).toBeInTheDocument();

    // The starter code / reference solution become reachable through their own modal.
    await user.click(screen.getByRole('button', { name: /Xem Lời Giải & Mã Nguồn Mẫu AI/ }));
    expect(screen.getByText(/Lời Giải Chuẩn & Khung Mã Nguồn/)).toBeInTheDocument();
    expect(screen.getByText('// TODO: cài đặt Dijkstra')).toBeInTheDocument();
    expect(screen.getByText('class Solution { /* lời giải chuẩn */ }')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Đóng$/ }));
    expect(screen.queryByText(/Lời Giải Chuẩn & Khung Mã Nguồn/)).toBeNull();
  });

  it('reports the last model error when every Gemini attempt fails', async () => {
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    geminiRoutes([
      { match: ':generateContent', status: 503, body: { error: { message: 'máy chủ Gemini đang quá tải' } } },
    ]);
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    // The service bounds itself to three models, then reports the genuine last error.
    expect(
      await screen.findByText(/Đã thử 3 model nhưng không thành công.*máy chủ Gemini đang quá tải/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/đã sinh đề & barem thành công/)).toBeNull();
  });

  it('falls back to the system AI hub when the lecturer key is rejected', async () => {
    localStorage.setItem('aita_gemini_api_key', 'khóa-hết-hạn');
    geminiRoutes([
      {
        match: ':generateContent',
        status: 400,
        body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      },
      { match: '/api/v1/exams/preview', body: hubExamResponse },
    ]);
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    expect(await screen.findByText(/Đã sinh đề bằng trợ lý AI của hệ thống/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập tên bài tập hoặc chủ đề...')).toHaveValue(
      'Đề từ trợ lý AI của hệ thống',
    );
    // Sample and hidden cases arrive separately and are merged into one editable list.
    expect(screen.getByText(/Tổng 2 Test/)).toBeInTheDocument();
    expect(
      screen.getByText(/Đã tạo đề bài "Đề từ trợ lý AI của hệ thống" kèm 2 test case và 1 tiêu chí chấm điểm/),
    ).toBeInTheDocument();

    const hubCall = stub.spy.mock.calls.find((c) => String(c[0]).includes('/api/v1/exams/preview'));
    expect(hubCall?.[1]?.method).toBe('POST');
  });

  it('reports both engines unavailable when the hub does not answer either', async () => {
    localStorage.setItem('aita_gemini_api_key', 'khóa-hỏng');
    geminiRoutes([
      {
        match: ':generateContent',
        status: 400,
        body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      },
      { match: '/api/v1/exams/preview', status: 500, body: { message: 'hub không phản hồi' } },
    ]);
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    expect(
      await screen.findByText(/trợ lý AI của hệ thống cũng không phản hồi/),
    ).toBeInTheDocument();
  });

  it('sets the AI error when the hub answers without an exam payload', async () => {
    localStorage.setItem('aita_gemini_api_key', 'khóa-hỏng');
    geminiRoutes([
      {
        match: ':generateContent',
        status: 400,
        body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      },
      { match: '/api/v1/exams/preview', body: { statusCode: 200, data: { latencyMs: 5 } } },
    ]);
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));
    expect(
      await screen.findByText(/trợ lý AI của hệ thống cũng không phản hồi/),
    ).toBeInTheDocument();
  });

  it('follows the desired test-case count and the lecturer suggestions', async () => {
    const user = await openComposer();

    await user.click(screen.getByRole('button', { name: /^3 Test Cases/ }));
    expect(screen.getByText(/sẽ tạo đủ đúng 3 testcases/)).toBeInTheDocument();

    // A count written into the prompt wins over the button selection.
    const prompt = screen.getByPlaceholderText(/Ví dụ: 'Tạo bài tập về cây AVL/);
    await user.clear(prompt);
    await user.type(prompt, 'Tạo bài tập về cây AVL, tạo 7 test case với trọng số khác nhau');
    expect(screen.getByText(/sẽ tạo đủ đúng 7 testcases/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /\+ Cây AVL cân bằng có phép xoay trái phải/ }));
    expect(prompt).toHaveValue('Cây AVL cân bằng có phép xoay trái phải');
    expect(screen.getByPlaceholderText('Nhập tên bài tập hoặc chủ đề...')).toHaveValue(
      'Cây AVL cân bằng có phép xoay trái phải',
    );
  });

  it('adds, removes and re-balances test cases', async () => {
    const user = await openComposer();
    // The seeded pair weighs 3.5 + 3.5 = 7.0, so the 7.0 normaliser is already satisfied.
    expect(screen.getByText(/Tổng Điểm TC: 7\.0đ ✅ Chuẩn/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quy đổi về 7\.0đ/ })).toBeNull();

    // Editing a weight off the two "standard" totals brings up the proportional-scaling hint.
    // Only the test-case weights use step 0.5; the time/RAM limits are earlier spinbuttons.
    const weightInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => (el as HTMLInputElement).step === '0.5');
    expect(weightInputs).toHaveLength(2);
    await user.clear(weightInputs[0]);
    await user.type(weightInputs[0], '1');
    expect(screen.getByText(/Tổng Điểm TC: 4\.5đ/)).toBeInTheDocument();
    expect(screen.getByText(/khác 10đ/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quy đổi về 10\.0đ/ }));
    expect(screen.getByText(/Tổng Điểm TC: 10\.0đ ✅ Chuẩn/)).toBeInTheDocument();
    // Satisfied totals drop their own normaliser button.
    expect(screen.queryByRole('button', { name: /Quy đổi về 10\.0đ/ })).toBeNull();
    expect(screen.queryByText(/khác 10đ/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /Quy đổi về 7\.0đ \(Barem\)/ }));
    expect(screen.getByText(/Tổng Điểm TC: 7\.0đ ✅ Chuẩn/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quy đổi về 10\.0đ/ })).toBeInTheDocument();

    // Adding a case seeds it with 3.0 points, and every row carries its own "×" delete button.
    await user.click(screen.getByRole('button', { name: '+ Thêm Test Case' }));
    expect(screen.getByText(/Bộ Test Cases Tự Động - Tổng 3 Test/)).toBeInTheDocument();
    expect(screen.getByText(/Tổng Điểm TC: 10\.0đ ✅ Chuẩn/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '×' })[0]);
    expect(screen.getByText(/Bộ Test Cases Tự Động - Tổng 2 Test/)).toBeInTheDocument();
    // The 7.0 normalisation left [1.5, 5.5]; dropping the first row leaves 5.5 + 3.0.
    expect(screen.getByText(/Tổng Điểm TC: 8\.5đ/)).toBeInTheDocument();
  });

  it('toggles a test case between public and hidden and edits its data', async () => {
    const user = await openComposer();
    const inputs = screen.getAllByPlaceholderText('Dữ liệu đầu vào...');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '9 9');
    expect(screen.getAllByPlaceholderText('Dữ liệu đầu vào...')[0]).toHaveValue('9 9');

    // Test #1 is public, test #2 is hidden: flipping #1 must relabel it.
    const modes = screen.getAllByText(/^(Công Khai|Test Ẩn)$/);
    expect(modes[0]).toHaveTextContent('Công Khai');
    await user.click(modes[0]);
    expect(screen.getAllByText(/^(Công Khai|Test Ẩn)$/)[0]).toHaveTextContent('Test Ẩn');
  });

  it('drops a language from the allowed list', async () => {
    const user = await openComposer();
    const cpp = screen.getByRole('checkbox', { name: 'CPP' });
    expect(cpp).toBeChecked();
    await user.click(cpp);
    expect(cpp).not.toBeChecked();
  });
});

describe('LecturerDashboard — CSV roster import', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  const openImportTab = async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.excel }));
    return user;
  };

  const attachCsv = (content: string, name = 'roster.csv') => {
    const input = document.querySelector('#roster-csv-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [csvFile(content, name)] } });
  };

  it('previews the parsed roster and posts it to the course bulk-import endpoint', async () => {
    const user = await openImportTab();
    attachCsv(
      'Mã Sinh Viên,Họ Và Tên,Email FPT\n' +
        'SE170001,Nguyễn Văn A,nguyenvana@fpt.edu.vn\n' +
        'SE170002,Trần Thị B,tranthib@fpt.edu.vn\n',
    );

    expect(await screen.findByText(/Đã nhận diện 2 sinh viên từ file \[roster.csv\]/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('SE170001')).toBeInTheDocument();
    expect(within(table).getByText('Trần Thị B')).toBeInTheDocument();
    expect(within(table).getByText('tranthib@fpt.edu.vn')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Bắt Đầu Nạp 2 Sinh Viên Vào Lớp/ }));

    expect(await screen.findByText(/GIAO DỊCH THÀNH CÔNG/)).toBeInTheDocument();
    const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/bulk-import'));
    expect(String(call?.[0])).toContain('/api/v1/courses/CRS-SWP391/bulk-import');
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(call?.[1]?.body)).toEqual({
      students: [
        { studentCode: 'SE170001', fullName: 'Nguyễn Văn A', email: 'nguyenvana@fpt.edu.vn' },
        { studentCode: 'SE170002', fullName: 'Trần Thị B', email: 'tranthib@fpt.edu.vn' },
      ],
    });
  });

  it('accepts the two-column roster shape and falls back to the code as the name', async () => {
    await openImportTab();
    attachCsv('MSSV,Email FPT\nSE170009,se170009@fpt.edu.vn\n');

    expect(await screen.findByText(/Đã nhận diện 1 sinh viên/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('SE170009')).toHaveLength(2);
  });

  it('rolls the whole transaction back when the server rejects the import', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/bulk-import', status: 500, body: { message: 'Trùng mã sinh viên ở dòng 3' } },
      ],
    });
    const user = await openImportTab();
    attachCsv('Mã Sinh Viên,Họ Và Tên,Email FPT\nSE170001,Nguyễn Văn A,a@fpt.edu.vn\n');
    await user.click(await screen.findByRole('button', { name: /Bắt Đầu Nạp 1 Sinh Viên Vào Lớp/ }));

    expect(
      await screen.findByText(/GIAO DỊCH THẤT BẠI: Trùng mã sinh viên ở dòng 3/),
    ).toBeInTheDocument();
    expect(screen.getByText(/tự động hoàn tác toàn bộ dữ liệu/)).toBeInTheDocument();
  });

  it('sends the built-in duplicate fixture when the rollback scenario is triggered', async () => {
    const user = await openImportTab();
    await user.click(
      screen.getByRole('button', { name: /Kích Hoạt Thử Nghiệm Lỗi Dòng 3 & Hoàn Tác/ }),
    );

    await waitFor(() => {
      const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/bulk-import'));
      expect(call).toBeTruthy();
    });
    const body = JSON.parse(
      stub.spy.mock.calls.find((c) => String(c[0]).includes('/bulk-import'))?.[1]?.body,
    );
    expect(body.students).toHaveLength(3);
    // Row 3 repeats TEST-SV001; that duplicate is the whole point of the scenario.
    expect(body.students.filter((s: any) => s.studentCode === 'TEST-SV001')).toHaveLength(2);
  });

  it('runs the plain success scenario with its own three sample students', async () => {
    const user = await openImportTab();
    await user.click(screen.getByRole('button', { name: /Thực Thi Nạp Danh Sách Sinh Viên/ }));

    expect(await screen.findByText(/GIAO DỊCH THÀNH CÔNG/)).toBeInTheDocument();
    const body = JSON.parse(
      stub.spy.mock.calls.find((c) => String(c[0]).includes('/bulk-import'))?.[1]?.body,
    );
    expect(body.students.map((s: any) => s.studentCode)).toEqual([
      'TEST-SV001',
      'TEST-SV002',
      'TEST-SV003',
    ]);
  });

  it('rejects an empty file', async () => {
    await openImportTab();
    attachCsv('   \n\n  ');
    expect(
      await screen.findByText(/File CSV được chọn rỗng hoặc không có dữ liệu/),
    ).toBeInTheDocument();
  });

  it('rejects a file that only carries the header row', async () => {
    await openImportTab();
    attachCsv('Mã Sinh Viên,Họ Và Tên,Email FPT\n');
    expect(
      await screen.findByText(/chỉ có dòng tiêu đề hoặc không chứa bản ghi sinh viên nào/),
    ).toBeInTheDocument();
  });

  it('reports a file whose rows cannot be mapped to the three columns', async () => {
    await openImportTab();
    attachCsv('Mã Sinh Viên,Họ Và Tên,Email FPT\nSE170001\n');
    expect(
      await screen.findByText(/Không trích xuất được sinh viên nào từ CSV/),
    ).toBeInTheDocument();
  });

  it('lets the lecturer discard the chosen file before importing', async () => {
    const user = await openImportTab();
    attachCsv('Mã Sinh Viên,Họ Và Tên,Email FPT\nSE170001,Nguyễn Văn A,a@fpt.edu.vn\n');
    expect(await screen.findByText(/Đã nhận diện 1 sinh viên/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hủy file đã chọn' }));
    expect(screen.queryByText(/Đã nhận diện 1 sinh viên/)).toBeNull();
    expect(screen.getByText(/Chọn File CSV Từ Máy Tính/)).toBeInTheDocument();
  });

  it('downloads the roster template named after the target course', async () => {
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });
    try {
      const user = await openImportTab();
      await user.click(screen.getByRole('button', { name: /Tải File Mẫu Danh Sách Lớp/ }));
      expect(clicked).toEqual(['roster_CRS-SWP391.csv']);
    } finally {
      clickSpy.mockRestore();
    }
  });
});

describe('LecturerDashboard — courses, assignments and localStorage', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  const openCourseDetail = async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));
    return user;
  };

  it('opens a course detail and returns to the class list', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));

    expect(screen.getByText(/Danh Sách Các Bài Tập Đã Giao Của Môn Học/)).toBeInTheDocument();
    expect(
      screen.getByText(/Chưa Có Bài Tập Nào Được Giao Cho Môn Học Này/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sĩ số:/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quay Lại Danh Sách Môn Học/ }));
    expect(screen.getByText(/Các Lớp Học Phần Đang Giảng Dạy/)).toBeInTheDocument();
    expect(screen.queryByText(/Danh Sách Các Bài Tập Đã Giao Của Môn Học/)).toBeNull();
  });

  it('reads the stored assignments back on mount and ignores a corrupt value', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([storedAssignment()]));
    await openCourseDetail();
    expect(screen.getByText('Bài tập kiểm thử đã xuất bản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem Chi Tiết Đề & Test Cases/ })).toBeInTheDocument();

    // A truncated JSON value must not take the screen down; the list simply starts empty.
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { unmount } = render(<LecturerDashboard />);
    expect(await screen.findAllByText(/Các Lớp Học Phần Đang Giảng Dạy/)).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /Xem Các Bài Tập Đã Giao \(0\)/ }).length).toBeGreaterThan(0);
    unmount();
  });

  it('treats an empty stored array as no assignments', async () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    render(<LecturerDashboard />);
    await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao \(0\)/ });
    expect(screen.queryByText('Bài tập kiểm thử đã xuất bản')).toBeNull();
  });

  it('previews an assignment, closes or toggles it, and keeps storage in step', async () => {
    const events = vi.fn();
    window.addEventListener('aita_published_assignments_updated', events);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        storedAssignment({
          isNewlyCreated: true,
          description: 'x'.repeat(240),
          rubrics: [{ criterion: 'Đúng đắn', maxScore: 10, description: 'Chạy đúng mọi testcase' }],
          starterCode: '// khung mã',
        }),
      ]),
    );
    const user = await openCourseDetail();

    expect(screen.getByText(/MỚI XUẤT BẢN VỪA XONG/)).toBeInTheDocument();
    expect(screen.getByText(/1 Test Cases \(10\.0đ\)/)).toBeInTheDocument();
    // A description longer than 200 characters is truncated in the card.
    expect(screen.getByText(/x{200}\.\.\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Xem Chi Tiết Đề & Test Cases/ }));
    expect(screen.getByText(/Barem Chấm Điểm Học Thuật \(Rubrics\)/)).toBeInTheDocument();
    expect(screen.getByText(/Khung Mã Nguồn Khởi Tạo:/)).toBeInTheDocument();
    expect(screen.getByText(/Danh Sách Test Cases \(1 Bộ Test/)).toBeInTheDocument();
    // The card behind the modal renders the assignment twice (title + modal heading).
    expect(screen.getAllByText('Bài tập kiểm thử đã xuất bản')).toHaveLength(2);

    // Toggling inside the modal updates the stored record and the card behind it.
    // Both the modal footer and the card behind it offer "Đóng Nộp Bài"; the first is the modal's.
    await user.click(screen.getAllByRole('button', { name: /Đóng Nộp Bài/ })[0]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].status).toBe('CLOSED'));

    await user.click(screen.getByRole('button', { name: /^Đóng$/ }));
    expect(screen.getByText(/ĐÃ ĐÓNG NỘP/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mở Lại Nộp Bài/ }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].status).toBe('PUBLISHED'),
    );
    expect(screen.getByText(/ĐANG MỞ NỘP BÀI/)).toBeInTheDocument();
    expect(events).toHaveBeenCalled();

    window.removeEventListener('aita_published_assignments_updated', events);
  });

  it('deletes an assignment only after the lecturer confirms', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([storedAssignment()]));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await openCourseDetail();

    await user.click(screen.getByRole('button', { name: /Xóa/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /Xóa/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0));
    expect(screen.queryByText('Bài tập kiểm thử đã xuất bản')).toBeNull();
    confirmSpy.mockRestore();
  });

  it('creates a new course and adds it to the class list', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));
    expect(screen.getByText('Tạo Lớp Học Phần Mới')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lưu Lớp Học/ }));

    await waitFor(() => {
      const call = stub.spy.mock.calls.find(
        (c) => String(c[0]).includes('/api/v1/courses') && (c[1] as any)?.method === 'POST',
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call?.[1] as any).body)).toMatchObject({
        courseId: 'CRS-PRN211',
        courseCode: 'PRN211',
      });
    });
    expect(await screen.findByText('Cross-Platform Application Development with .NET')).toBeInTheDocument();
    expect(screen.queryByText('Tạo Lớp Học Phần Mới')).toBeNull();
  });

  it('refuses to create a course without a code or a name', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));
    await user.clear(screen.getByPlaceholderText('Ví dụ: PRN211, PRO192, SWP391'));

    // `required` blocks a real click, so submit the form directly to reach the guard.
    fireEvent.submit(document.querySelector('form')!);

    expect(alertSpy).toHaveBeenCalledWith('Vui lòng nhập Mã học phần và Tên khóa học!');
    expect(
      stub.spy.mock.calls.some(
        (c) => String(c[0]).includes('/api/v1/courses') && (c[1] as any)?.method === 'POST',
      ),
    ).toBe(false);
    alertSpy.mockRestore();
  });

  it('publishes an assignment, persists every test case and stores it locally', async () => {
    const events = vi.fn();
    window.addEventListener('aita_published_assignments_updated', events);
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));

    expect(await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/)).toBeInTheDocument();
    const asmCall = stub.spy.mock.calls.find(
      (c) => String(c[0]).endsWith('/api/v1/assignments') && (c[1] as any)?.method === 'POST',
    );
    expect(asmCall).toBeTruthy();
    // Regression: the course select used to *display* the first course while the state still held
    // the orphan 'COURSE-SWP391' placeholder, so the assignment was filed nowhere and the course's
    // "Đã giao" counter never moved. The posted id must be the real one the picker shows.
    expect(JSON.parse((asmCall?.[1] as any).body)).toMatchObject({
      courseId: 'CRS-SWP391',
      testcasesCount: 2,
      maxScore: 10,
    });
    expect(
      stub.spy.mock.calls.filter(
        (c) => String(c[0]).includes('/api/v1/test-cases') && (c[1] as any)?.method === 'POST',
      ),
    ).toHaveLength(2);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    // Idempotent id derived from the course code and the title. Note the mangled "CAI-AT": the
    // slug strips combining marks after NFD, but "Đ" decomposes to "Đ" + a mark rather than
    // "D" + a mark, so the base letter is *replaced* by '-' — an existing quirk of this scheme,
    // not something this test should paper over.
    expect(stored[0].id).toBe('ASM-SWP391-CAI-AT-THUAT-TOAN-CAY-TIM-KIEM-NHI-PHAN-');
    expect(stored[0].courseId).toBe('CRS-SWP391');
    expect(events).toHaveBeenCalled();

    // The lecturer lands on the course that just received the assignment, and the counter moved.
    expect(screen.getByText(/Danh Sách Các Bài Tập Đã Giao Của Môn Học/)).toBeInTheDocument();
    expect(
      screen.getByText(/ASM-SWP391-CAI-AT-THUAT-TOAN-CAY-TIM-KIEM-NHI-PHAN-/, { selector: 'strong' }),
    ).toBeInTheDocument();
    // The counter moved — this is the number that stayed at 0 while the bug filed the
    // assignment under a phantom course. The label and the count sit in sibling elements.
    const totals = screen.getByText(/Tổng số bài tập đã giao:/).parentElement!;
    expect(totals).toHaveTextContent('Tổng số bài tập đã giao: 1 bài');
    expect(screen.getByText(/Hiển thị 1 bài tập/)).toBeInTheDocument();
    window.removeEventListener('aita_published_assignments_updated', events);
  });

  it('keeps the assignment when the gateway reports a duplicate code', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/assignments', status: 409, body: { message: 'đã tồn tại' } }],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));

    // 409 means "already stored", so the toast still reports success without a warning.
    expect(await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);
  });

  it('publishes partially and warns when the test cases cannot be stored', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/test-cases', status: 500, body: { message: 'lỗi' } }],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));

    expect(await screen.findByText(/ĐÃ XUẤT BẢN \(một phần\)/)).toBeInTheDocument();
    expect(screen.getByText(/Một số testcase chưa lưu được/)).toBeInTheDocument();
    // The assignment is still kept locally so the lecturer does not lose the work.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1);
  });

  it('publishes partially and warns when the gateway refuses the assignment', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/assignments', status: 500, body: { message: 'sập gateway' } }],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));

    expect(await screen.findByText(/ĐÃ XUẤT BẢN \(một phần\)/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa lưu được lên hệ thống/)).toBeInTheDocument();
  });

  it('refuses to publish an assignment without a title', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.clear(screen.getByPlaceholderText('Nhập tên bài tập hoặc chủ đề...'));
    fireEvent.submit(document.querySelector('form')!);

    expect(
      await screen.findByText(/Vui lòng nhập Tiêu đề bài tập trước khi xuất bản/),
    ).toBeInTheDocument();
    expect(
      stub.spy.mock.calls.some(
        (c) => String(c[0]).endsWith('/api/v1/assignments') && (c[1] as any)?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('carries the course into the composer from the class card shortcut', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /\+ Giao Đề Mới \(AI\)/ }));
    expect(screen.getByText(/Soạn Thảo Đề Bài Tập & Sinh Barem/)).toBeInTheDocument();
    const courseSelect = screen
      .getByRole('option', { name: /SWP391 - Dự án Phần mềm/ })
      .closest('select') as HTMLSelectElement;
    expect(courseSelect).toHaveValue('CRS-SWP391');
  });

  // Regression: `selectedCourse` was initialised to the placeholder 'COURSE-SWP391'. A <select>
  // whose value matches no <option> still *displays* the first option, so the composer looked
  // right while the state pointed at a course id that does not exist — a lecturer who never
  // re-picked the course published the assignment (and every testcase) against a phantom course.
  it('selects a real course id in the composer without any manual pick', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    const courseSelect = (await screen.findByRole('option', { name: /SWP391 - Dự án Phần mềm/ }))
      .closest('select') as HTMLSelectElement;
    // The displayed value and the state must agree; the placeholder must not survive.
    expect(courseSelect).toHaveValue('CRS-SWP391');
    expect(courseSelect).not.toHaveValue('COURSE-SWP391');

    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));
    await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/);
    const asmCall = stub.spy.mock.calls.find(
      (c) => String(c[0]).endsWith('/api/v1/assignments') && (c[1] as any)?.method === 'POST',
    );
    expect(JSON.parse((asmCall?.[1] as any).body).courseId).toBe('CRS-SWP391');
    // …and the testcases follow the assignment onto the same real course.
    for (const call of stub.spy.mock.calls.filter(
      (c) => String(c[0]).includes('/api/v1/test-cases') && (c[1] as any)?.method === 'POST',
    )) {
      expect(JSON.parse((call[1] as any).body).assignmentId).toContain('ASM-SWP391');
    }
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].courseId).toBe('CRS-SWP391');
  });

  it('keeps a course chosen by hand when the course list is refreshed', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/courses',
          body: {
            statusCode: 200,
            data: [
              { courseId: 'CRS-SWP391', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
              { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình .NET', semester: 'SU2026' },
            ],
          },
        },
      ],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    const courseSelect = (await screen.findByRole('option', { name: /PRN211 - Lập trình \.NET/ }))
      .closest('select') as HTMLSelectElement;
    await user.selectOptions(courseSelect, 'CRS-PRN211');
    expect(courseSelect).toHaveValue('CRS-PRN211');

    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));
    await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/);
    // The lecturer's own pick wins; the refresh must not silently snap back to the first course.
    const asmCall = stub.spy.mock.calls.find(
      (c) => String(c[0]).endsWith('/api/v1/assignments') && (c[1] as any)?.method === 'POST',
    );
    const posted = JSON.parse((asmCall?.[1] as any).body);
    expect(posted.courseId).toBe('CRS-PRN211');
    expect(posted.assignmentId).toBe('ASM-PRN211-CAI-AT-THUAT-TOAN-CAY-TIM-KIEM-NHI-PHAN-');
  });

  it('jumps to the gradebook from the class card shortcut', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: 'Bảng Điểm' }));
    expect(screen.getByText(/Sổ Theo Dõi Bài Nộp Lập Trình/)).toBeInTheDocument();
  });
});

describe('LecturerDashboard — gradebook rows', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  const openGradebook = async (options: Parameters<typeof installFetchStub>[0] = {}) => {
    stub.restore();
    stub = installFetchStub(options);
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.submissions }));
    return user;
  };

  it('badges a resubmission with its attempt count and explains the counted attempt', async () => {
    await openGradebook({
      routes: [{ match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts }],
    });

    expect(await screen.findByText('3 lần')).toBeInTheDocument();
    expect(screen.getByText('Điểm cao nhất nằm ở lượt nộp thứ 2')).toBeInTheDocument();
    // The single-attempt row keeps the neutral badge and shows no note at all.
    expect(screen.getByText('1 lần')).toBeInTheDocument();
    expect(screen.getByText('Lê Minh Châu')).toBeInTheDocument();
    expect(screen.getByText('Vừa xong')).toBeInTheDocument();
    // A null score maps to 0, and the raw mark is what the total column shows.
    expect(screen.getByText('0/7.0')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText(/2 dòng điểm · 4 lượt nộp · 2 lượt bị thay thế/)).toBeInTheDocument();
  });

  it('re-queries the gradebook from the refresh button', async () => {
    const user = await openGradebook({
      routes: [{ match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts }],
    });
    const before = stub.spy.mock.calls.filter((c) => String(c[0]).includes('gradebook')).length;
    await user.click(screen.getByRole('button', { name: /Làm mới/ }));
    await waitFor(() => {
      const after = stub.spy.mock.calls.filter((c) => String(c[0]).includes('gradebook')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('opens the submission detail modal from a gradebook row', async () => {
    const user = await openGradebook({
      routes: [{ match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts }],
    });
    await user.click((await screen.findAllByRole('button', { name: 'Xem Chi Tiết' }))[0]);

    expect(screen.getByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeInTheDocument();
    // The id appears once in the grid row and again inside the modal.
    expect(screen.getAllByText('SUB-000001-AAAAAA')).toHaveLength(2);
    // The gradebook feeds `score` through, so 8.5 is a pass.
    expect(screen.getByText(/ĐẠT • 8\.5 \/ 10\.0/)).toBeInTheDocument();
    // The modal is handed the row's derived file name.
    expect(screen.getByText('SUB-000001-AAAAAA.zip')).toBeInTheDocument();

    // Source code lives behind the third tab; the stub echoes whatever value it is given.
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    expect(await screen.findByText(/Không tìm thấy nội dung mã nguồn/)).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'java');

    await user.click(screen.getByRole('button', { name: /Đóng Cửa Sổ/ }));
    expect(screen.queryByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeNull();
  });

  it('downloads the counted attempt with its Content-Disposition filename', async () => {
    const downloaded: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded.push(this.download);
      });
    try {
      const user = await openGradebook({
        routes: [{ match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts }],
      });
      // The shared router answers JSON only, so the .zip branch needs a Response with a blob().
      const routed = globalThis.fetch as any;
      (globalThis as any).fetch = vi.fn(async (input: any, init?: any) => {
        if (String(input).includes('/download')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({
              'Content-Disposition': 'attachment; filename="bai-lam-cua-trung.zip"',
            }),
            blob: async () => new Blob(['PK'], { type: 'application/zip' }),
            json: async () => ({}),
            text: async () => '',
          };
        }
        return routed(input, init);
      });

      await user.click((await screen.findAllByRole('button', { name: 'Tải .zip' }))[0]);

      await waitFor(() =>
        expect(
          (globalThis.fetch as any).mock.calls.some((c: any) =>
            String(c[0]).includes('/api/v1/submissions/SUB-000001-AAAAAA/download'),
          ),
        ).toBe(true),
      );
      // The server-provided name wins over the generated `${id}.zip`.
      expect(downloaded).toEqual(['bai-lam-cua-trung.zip']);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('falls back to a generated archive when the download endpoint refuses', async () => {
    const downloaded: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded.push(this.download);
      });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      const user = await openGradebook({
        routes: [
          { match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts },
          { match: '/download', status: 404, body: { message: 'không có tệp' } },
        ],
      });
      await user.click((await screen.findAllByRole('button', { name: 'Tải .zip' }))[0]);

      await waitFor(() => expect(downloaded).toHaveLength(1));
      // `handleOpenDetailModal` names the row file after the counted submission id.
      expect(downloaded[0]).toBe('SUB-000001-AAAAAA.zip');
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      clickSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });

  it('reports a download that throws instead of failing silently', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      const user = await openGradebook({
        routes: [{ match: '/api/v1/submissions/gradebook', body: gradebookWithAttempts }],
      });
      const failing = vi.fn(async () => {
        throw new Error('mất kết nối');
      });
      (globalThis as any).fetch = failing;

      await user.click((await screen.findAllByRole('button', { name: 'Tải .zip' }))[0]);
      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Lỗi khi tải file zip: mất kết nối'),
      );
    } finally {
      alertSpy.mockRestore();
    }
  });
});

describe('LecturerDashboard — remaining interaction edges', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('cancels the create-course modal from both of its buttons', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);

    await user.click(await screen.findByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));
    expect(screen.getByText('Tạo Lớp Học Phần Mới')).toBeInTheDocument();
    // "Hủy Bỏ" is the labelled footer button; the header one is a bare icon.
    await user.click(screen.getByRole('button', { name: /Hủy Bỏ/ }));
    expect(screen.queryByText('Tạo Lớp Học Phần Mới')).toBeNull();

    await user.click(screen.getByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));
    await clickModalClose(user);
    expect(screen.queryByText('Tạo Lớp Học Phần Mới')).toBeNull();
  });

  it('edits every field of the create-course form before saving', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));

    // `fireEvent.change` still drives React's onChange, so the upper-casing is exercised without
    // paying for a keystroke-by-keystroke simulation on four fields.
    const code = screen.getByPlaceholderText('Ví dụ: PRN211, PRO192, SWP391');
    fireEvent.change(code, { target: { value: 'pro192' } });
    expect(code).toHaveValue('PRO192');

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Lập trình Cross-Platform .NET Core'), {
      target: { value: 'Lập trình Java nâng cao' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Học kỳ Thu 2026/), {
      target: { value: 'Học kỳ Xuân 2027' },
    });
    // The description textarea has no placeholder, so reach it through its current value.
    fireEvent.change(screen.getByDisplayValue(/Lập trình ứng dụng đa nền tảng/), {
      target: { value: 'Mô tả mục tiêu mới' },
    });

    await user.click(screen.getByRole('button', { name: /Lưu Lớp Học/ }));
    await waitFor(() => {
      const call = stub.spy.mock.calls.find(
        (c) => String(c[0]).includes('/api/v1/courses') && (c[1] as any)?.method === 'POST',
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call?.[1] as any).body)).toMatchObject({
        courseId: 'CRS-PRO192',
        courseCode: 'PRO192',
        courseName: 'Lập trình Java nâng cao',
        semester: 'Học kỳ Xuân 2027',
        description: 'Mô tả mục tiêu mới',
      });
    });
    expect(await screen.findByText('Lập trình Java nâng cao')).toBeInTheDocument();
  }, 20000);

  it('reports a create-course request that throws', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /\+ Tạo Khóa Học Mới/ }));

    const failing = vi.fn(async () => {
      throw new Error('gateway sập');
    });
    (globalThis as any).fetch = failing;

    await user.click(screen.getByRole('button', { name: /Lưu Lớp Học/ }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Lỗi tạo khóa học: gateway sập'),
    );
    alertSpy.mockRestore();
  });

  it('survives a gradebook that never answers', async () => {
    stub.restore();
    stub = installFetchStub();
    const failing = vi.fn(async (input: any) => {
      if (String(input).includes('gradebook')) throw new Error('mạng lỗi');
      return (stub.spy as any)(input);
    });
    (globalThis as any).fetch = failing;

    render(<LecturerDashboard />);
    // The catch block logs and clears the spinner; the dashboard stays usable.
    expect(
      await screen.findByRole('button', { name: TAB.submissions }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Các Lớp Học Phần Đang Giảng Dạy/)).toBeInTheDocument();
  });

  it('clears the empty state from the course detail into the composer', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));
    await user.click(screen.getByRole('button', { name: /Soạn Đề Bài Tập Đầu Tiên Ngay/ }));

    expect(screen.getByText(/Soạn Thảo Đề Bài Tập & Sinh Barem/)).toBeInTheDocument();
    const courseSelect = screen
      .getByRole('option', { name: /SWP391 - Dự án Phần mềm/ })
      .closest('select') as HTMLSelectElement;
    expect(courseSelect).toHaveValue('CRS-SWP391');
  });

  it('navigates from the course detail header buttons', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));

    // "+ Giao Thêm Đề Mới (AI)" carries the course into the composer.
    await user.click(screen.getByRole('button', { name: /Giao Thêm Đề Mới \(AI\)/ }));
    expect(screen.getByText(/Soạn Thảo Đề Bài Tập & Sinh Barem/)).toBeInTheDocument();

    // "Xem Sổ Điểm Lớp" jumps straight to the gradebook. Going back to the course tab returns to
    // this same detail screen (the selected course is still open), so the shortcut is right there.
    await user.click(screen.getByRole('button', { name: TAB.courses }));
    await user.click(screen.getByRole('button', { name: /Xem Sổ Điểm Lớp/ }));
    expect(screen.getByText(/Sổ Theo Dõi Bài Nộp Lập Trình/)).toBeInTheDocument();
  });

  it('dismisses the publish banner from its close button', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));
    expect(await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/)).toBeInTheDocument();

    // The banner's dismiss control is the only "×" in the course-detail view.
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(screen.queryByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/)).toBeNull();
  });

  it('navigates to the gradebook from inside the assignment card and its preview', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([storedAssignment()]));
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));

    await user.click(screen.getByRole('button', { name: /Sổ Điểm Bài Nộp/ }));
    expect(screen.getByText(/Sổ Theo Dõi Bài Nộp Lập Trình/)).toBeInTheDocument();

    // …and again from the preview modal footer, which also closes the modal. Both the header
    // shortcut and the modal footer say "Xem Sổ Điểm Lớp"; the modal's is the last one.
    await user.click(screen.getByRole('button', { name: TAB.courses }));
    await user.click(await screen.findByRole('button', { name: /Xem Chi Tiết Đề & Test Cases/ }));
    await user.click(screen.getAllByRole('button', { name: /Xem Sổ Điểm Lớp/ })[0]);
    expect(screen.getByText(/Sổ Theo Dõi Bài Nộp Lập Trình/)).toBeInTheDocument();
    expect(screen.queryByText(/Danh Sách Các Bài Tập Đã Giao Của Môn Học/)).toBeNull();
  });

  it('opens the course picker on the import tab and targets the chosen class', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/courses',
          body: {
            statusCode: 200,
            data: [
              { courseId: 'CRS-SWP391', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
              { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình .NET', semester: 'SU2026' },
            ],
          },
        },
      ],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.excel }));

    const picker = (await screen.findByRole('option', { name: /SWP391 - Dự án Phần mềm/ }))
      .closest('select') as HTMLSelectElement;
    await user.selectOptions(picker, 'CRS-PRN211');
    expect(picker).toHaveValue('CRS-PRN211');

    await user.click(screen.getByRole('button', { name: /Thực Thi Nạp Danh Sách Sinh Viên/ }));
    expect(await screen.findByText(/GIAO DỊCH THÀNH CÔNG/)).toBeInTheDocument();
    const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/bulk-import'));
    expect(String(call?.[0])).toContain('/api/v1/courses/CRS-PRN211/bulk-import');
    expect(screen.getByText(/vào lớp \[CRS-PRN211\]/)).toBeInTheDocument();
  });

  it('closes the API-key modal with its X button', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));

    const modalHeading = screen.getByText(/Cấu Hình Trí Tuệ Nhân Tạo Thật/);
    await clickModalClose(user);
    expect(screen.queryByText(/Cấu Hình Trí Tuệ Nhân Tạo Thật/)).toBeNull();
  });

  it('lets the lecturer choose an explicit AI model', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Cấu Hình Khóa API/ }));

    const modelSelect = screen
      .getByRole('option', { name: /Tự Động Chọn Mô Hình Nhanh Nhất/ })
      .closest('select') as HTMLSelectElement;
    await user.selectOptions(modelSelect, 'gemini-1.5-pro');
    expect(modelSelect).toHaveValue('gemini-1.5-pro');
  });

  it('edits the description, deadline and resource limits of an assignment', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    const desc = screen.getByDisplayValue(/Cài đặt Generic Binary Search Tree/);
    await user.clear(desc);
    await user.type(desc, 'Mô tả mới cho đề bài.');
    expect(desc).toHaveValue('Mô tả mới cho đề bài.');

    // The datetime-local and the two numeric quota inputs are plain controlled fields.
    const quotaFields = screen.getAllByRole('spinbutton');
    const timeLimit = quotaFields.find((el) => (el as HTMLInputElement).step === '500')!;
    await user.clear(timeLimit);
    await user.type(timeLimit, '4000');
    expect(timeLimit).toHaveValue(4000);

    const memory = quotaFields.find((el) => (el as HTMLInputElement).step === '128')!;
    await user.clear(memory);
    await user.type(memory, '256');
    expect(memory).toHaveValue(256);

    const deadline = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(deadline, { target: { value: '2027-03-01T12:00' } });
    expect(deadline).toHaveValue('2027-03-01T12:00');

    // Publishing carries the edited values through.
    await user.click(screen.getByRole('button', { name: /Lưu & Xuất Bản Đề Bài Tập Cho Lớp/ }));
    await screen.findByText(/ĐÃ XUẤT BẢN THÀNH CÔNG/);
    const asmCall = stub.spy.mock.calls.find(
      (c) => String(c[0]).endsWith('/api/v1/assignments') && (c[1] as any)?.method === 'POST',
    );
    expect(JSON.parse((asmCall?.[1] as any).body)).toMatchObject({
      description: 'Mô tả mới cho đề bài.',
      timeLimitMs: 4000,
      memoryLimitMb: 256,
      deadline: new Date('2027-03-01T12:00').toISOString(),
    });
  });

  it('re-adds a language that was removed from the allowed list', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    const java = screen.getByRole('checkbox', { name: 'JAVA' });
    await user.click(java);
    expect(java).not.toBeChecked();
    await user.click(java);
    expect(java).toBeChecked();
  });

  it('edits expected outputs and per-case scores', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    const outputs = screen.getAllByPlaceholderText('Kết quả chuẩn...');
    await user.clear(outputs[1]);
    await user.type(outputs[1], '99');
    expect(screen.getAllByPlaceholderText('Kết quả chuẩn...')[1]).toHaveValue('99');

    const weights = screen
      .getAllByRole('spinbutton')
      .filter((el) => (el as HTMLInputElement).step === '0.5');
    fireEvent.change(weights[0], { target: { value: '4' } });
    expect(weights[0]).toHaveValue(4);
    expect(screen.getByText(/Tổng Điểm TC: 7\.5đ/)).toBeInTheDocument();

    // Flipping the second case back to public re-labels it.
    const modes = screen.getAllByText(/^(Công Khai|Test Ẩn)$/);
    expect(modes[1]).toHaveTextContent('Test Ẩn');
    await user.click(modes[1]);
    expect(screen.getAllByText(/^(Công Khai|Test Ẩn)$/)[1]).toHaveTextContent('Công Khai');
  });

  it('sends the AI prompt instead of the title when the prompt is empty', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: ':generateContent', body: geminiTextResponse(generatedExam) },
        { match: 'generativelanguage', body: MODEL_LIST },
      ],
    });
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    // Clearing the prompt sends the generation down the "use the assignment title" branch.
    await user.clear(screen.getByPlaceholderText(/Ví dụ: 'Tạo bài tập về cây AVL/));
    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    expect(await screen.findByText(/đã sinh đề & barem thành công/)).toBeInTheDocument();
    const geminiCall = stub.spy.mock.calls.find((c) => String(c[0]).includes(':generateContent'));
    expect(String((geminiCall?.[1] as any)?.body)).toContain(
      'Cài đặt Thuật toán Cây Tìm Kiếm Nhị Phân',
    );
  });

  it('falls back to the course code topic when neither prompt nor title is usable', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: ':generateContent', body: geminiTextResponse(generatedExam) },
        { match: 'generativelanguage', body: MODEL_LIST },
      ],
    });
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    await user.clear(screen.getByPlaceholderText(/Ví dụ: 'Tạo bài tập về cây AVL/));
    const title = screen.getByPlaceholderText('Nhập tên bài tập hoặc chủ đề...');
    await user.clear(title);
    await user.type(title, 'Bài tập về Drone y tế');
    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    expect(await screen.findByText(/đã sinh đề & barem thành công/)).toBeInTheDocument();
    // A "drone" title is deliberately rejected in favour of a course-code topic. (The prompt
    // template itself names "Drone y tế" as a banned motif, so the assertion targets the topic
    // line rather than the whole body.)
    const geminiCall = stub.spy.mock.calls.find((c) => String(c[0]).includes(':generateContent'));
    const body = String((geminiCall?.[1] as any)?.body);
    expect(body).toContain('Chủ đề: SWP391 - Cấu trúc dữ liệu & Thuật toán thực tế');
    expect(body).not.toMatch(/- Chủ đề: Bài tập về Drone/);
  });

  it('reports when the Gemini hub call itself throws', async () => {
    localStorage.setItem('aita_gemini_api_key', 'khóa-hỏng');
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: ':generateContent',
          status: 400,
          body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
        },
      ],
    });
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    // The hub request rejects outright, which `generateViaHub` swallows into a null result.
    const routed = globalThis.fetch as any;
    (globalThis as any).fetch = vi.fn(async (input: any, init?: any) => {
      if (String(input).includes('/api/v1/exams/preview')) throw new Error('hub không tới được');
      return routed(input, init);
    });

    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));
    expect(
      await screen.findByText(/trợ lý AI của hệ thống cũng không phản hồi/),
    ).toBeInTheDocument();
  });

  it('ignores a file-picker event that carries no file', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.excel }));

    const input = document.querySelector('#roster-csv-input') as HTMLInputElement;
    // Cancelling the native dialog fires `change` with an empty FileList.
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.queryByText(/Đã nhận diện/)).toBeNull();
    expect(screen.queryByText(/File CSV được chọn rỗng/)).toBeNull();
    // The label still offers the untouched picker.
    expect(screen.getByText(/Chọn File CSV Từ Máy Tính/)).toBeInTheDocument();
  });

  it('refuses to normalise a testcase list worth zero points', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));

    // Zero every weight: the normalisers stay visible because the total is neither 10 nor 7.
    for (const input of screen
      .getAllByRole('spinbutton')
      .filter((el) => (el as HTMLInputElement).step === '0.5')) {
      fireEvent.change(input, { target: { value: '0' } });
    }
    expect(screen.getByText(/Tổng Điểm TC: 0\.0đ/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quy đổi về 10\.0đ/ }));
    // The guard returns early rather than dividing by a zero total.
    expect(screen.getByText(/Tổng Điểm TC: 0\.0đ/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('closes both preview-modalfooters and the solution modal from their own controls', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([storedAssignment({ starterCode: '// khung', referenceSolution: '// giải' })]),
    );
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(await screen.findByRole('button', { name: /Xem Các Bài Tập Đã Giao/ }));

    // The preview modal mirrors the card's toggle label. The card's copy sits in the card body;
    // the modal's is the one rendered *after* the "📖 Mô Tả Yêu Cầu & Ràng Buộc:" heading, so
    // pick by document position rather than by a fragile index.
    await user.click(screen.getByRole('button', { name: /Xem Chi Tiết Đề & Test Cases/ }));
    const descHeading = screen.getByText('📖 Mô Tả Yêu Cầu & Ràng Buộc:');
    const modalToggle = screen
      .getAllByRole('button', { name: /Đóng Nộp Bài/ })
      .find((b) => descHeading.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)!;
    expect(modalToggle).toBeTruthy();
    await user.click(modalToggle);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].status).toBe('CLOSED'));
    // The modal re-renders with the flipped label once its local copy updates.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Mở Lại Nộp Bài/ }).length).toBeGreaterThan(0),
    );

    // Closing the preview from its X removes the modal but keeps the card.
    await clickModalClose(user);
    expect(screen.queryByText(/📖 Mô Tả Yêu Cầu & Ràng Buộc:/)).toBeNull();
    expect(screen.getByText('Bài tập kiểm thử đã xuất bản')).toBeInTheDocument();
  });

  it('closes the AI solution modal from its X button', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: ':generateContent', body: geminiTextResponse(generatedExam) },
        { match: 'generativelanguage', body: MODEL_LIST },
      ],
    });
    localStorage.setItem('aita_gemini_api_key', AI_KEY);
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.ai }));
    await user.click(screen.getByRole('button', { name: /Sinh Đề Bằng AI Theo Yêu Cầu Này/ }));

    await user.click(await screen.findByRole('button', { name: /Xem Lời Giải & Mã Nguồn Mẫu AI/ }));
    expect(screen.getByText('// TODO: cài đặt Dijkstra')).toBeInTheDocument();

    await clickModalClose(user);
    expect(screen.queryByText(/Lời Giải Chuẩn & Khung Mã Nguồn/)).toBeNull();
  });

  it('switches between every attempt policy from the gradebook', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByRole('button', { name: TAB.submissions }));

    for (const [label, policy] of [
      ['Điểm cao nhất', 'BEST'],
      ['Bài nộp đầu', 'FIRST'],
      ['Bài nộp cuối', 'LAST'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: label }));
      await waitFor(() =>
        expect(
          stub.spy.mock.calls.some((c) => String(c[0]).includes(`policy=${policy}`)),
        ).toBe(true),
      );
    }
  });
});
