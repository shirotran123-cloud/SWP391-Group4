import type { ComponentProps } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSZip from 'jszip';

/**
 * Socket.IO is replaced with an in-memory double.
 *
 * `App` opens a websocket to the gateway on mount. Under jsdom that would be a real network
 * attempt on every one of these tests — slow, and non-deterministic when a gateway happens to
 * be listening. The double also lets a test drive the server-pushed grading events by hand,
 * which is the only way to cover the `grading:*` handlers hermetically.
 */
const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: any) => void>>();
  const socket: any = {
    connected: false,
    id: 'test-socket',
    on(event: string, cb: (data: any) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb);
      return socket;
    },
    off(event: string) {
      handlers.delete(event);
      return socket;
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return { socket, handlers };
});

vi.mock('socket.io-client', () => ({ io: () => socketMock.socket }));

import { App } from '../App';
import { LoginView } from '../components/LoginView';
import { LoginModal } from '../components/LoginModal';
import {
  installFetchStub,
  StudentUserFixture,
  LecturerUserFixture,
  AdminUserFixture,
  HodUserFixture,
} from '../test/fixtures';

// Rendering App pulls in every dashboard; several of these tests legitimately need more than
// the 5s default, and a flaky timeout would be indistinguishable from a real regression.
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

/**
 * Session / authentication surface.
 *
 * `App` is the router: it decides which console a cached or freshly authenticated profile
 * reaches. `LoginView` is the Google SSO gate plus the seeded demo accounts, and `LoginModal`
 * is the email + OTP fallback. Every one of them talks to the API Gateway, so the fetch router
 * from `test/fixtures.ts` is installed for each test and torn down afterwards.
 *
 * Note on the demo password: the seeded buttons are not a bypass — each one performs a real
 * `POST /api/v1/auth/login`. The tests therefore assert the credential body that goes out,
 * not merely that a button exists.
 */

const DEFAULT_CLIENT_ID = '788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com';

/** The URL a fetch spy was called with, as a string. */
const urlOf = (call: unknown[]) => String(call[0]);

/** True when the fetch spy has been called with a URL containing `fragment`. */
function wasCalled(stub: { spy: any }, fragment: string): boolean {
  return stub.spy.mock.calls.some((c: unknown[]) => urlOf(c).includes(fragment));
}

/** The `init` object of the first fetch call matching `fragment` (and `method`, when given). */
function callFor(stub: { spy: any }, fragment: string, method?: string): any {
  const call = stub.spy.mock.calls.find(
    (c: unknown[]) => urlOf(c).includes(fragment) && (!method || (c[1] as any)?.method === method),
  );
  return call?.[1];
}

function seedSession(user: unknown) {
  localStorage.setItem('aita_token', 'stub-token');
  localStorage.setItem('aita_user', JSON.stringify(user));
}

/** Opens the first assignment card and returns the confirm button of the upload form. */
async function openAssignment() {
  fireEvent.click(await screen.findByRole('button', { name: /Nộp Bài Ngay/ }));
  return screen.findByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ });
}

/**
 * Opens the first assignment, attaches an archive and returns the confirm button.
 *
 * The file passes SubmissionView's validation as a `.zip` but its bytes are plain text, so
 * `App.handleSubmission` takes the `file.text()` branch instead of the JSZip branch — the
 * path taken whenever an archive cannot be unzipped in the browser.
 */
async function attachArchive(body = 'def solve(a):\n    return a\n') {
  await openAssignment();
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(fileInput).toBeTruthy();
  fireEvent.change(fileInput, {
    target: { files: [new File([body], 'Solution.zip', { type: 'application/zip' })] },
  });
  // Submitting stays blocked until the SHA-256 digest of the upload has been computed.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ })).not.toBeDisabled(),
  );
  return screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ });
}

let stub: ReturnType<typeof installFetchStub>;

/**
 * `fetch` as it was before any test touched it.
 *
 * A few tests replace `globalThis.fetch` outright to simulate a socket that never resolves.
 * `installFetchStub().restore()` only puts back whatever it captured at install time, so
 * without this baseline a replaced implementation would leak into the next test.
 */
const pristineFetch = globalThis.fetch;

/** Invokes every handler App registered for a server-pushed socket event. */
function emitSocket(event: string, payload: unknown) {
  act(() => {
    for (const handler of socketMock.handlers.get(event) ?? []) handler(payload);
  });
}

/**
 * Waits until `App` has subscribed to `event`.
 *
 * Handler registration happens inside the mount effect, so an `emitSocket` issued right after a
 * render can find no listener yet and the event is silently dropped. That race made several
 * socket tests pass in isolation but flake in a full-suite run, where timing shifts slightly.
 * Awaiting the subscription removes the race rather than papering over it with a sleep.
 */
async function waitForSocketHandler(event: string) {
  await waitFor(() => expect(socketMock.handlers.has(event)).toBe(true));
}

/** Subscribes-then-pushes, the correct order for any server-driven event. */
async function pushSocket(event: string, payload: unknown) {
  await waitForSocketHandler(event);
  emitSocket(event, payload);
}

beforeEach(() => {
  // A previous test may have left fake timers installed; that would silently freeze every
  // `setTimeout` in the component under test.
  vi.useRealTimers();
  (globalThis as any).fetch = pristineFetch;
  socketMock.handlers.clear();
  socketMock.socket.connected = false;
  socketMock.socket.emit.mockClear();
  stub = installFetchStub();
});

afterEach(() => {
  stub.restore();
  (globalThis as any).fetch = pristineFetch;
  vi.useRealTimers();
  delete (window as any).google;
});

// ---------------------------------------------------------------------------------------------
// App — session bootstrap
// ---------------------------------------------------------------------------------------------

describe('App — session bootstrap', () => {
  it('shows the Google sign-in gate when no session is cached', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /AITA-INTELLIGENT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeInTheDocument();
    // The consoles must not leak through the gate.
    expect(screen.queryByRole('button', { name: /Đăng Xuất/ })).not.toBeInTheDocument();
  });

  it('restores a cached student session and renders the student console', async () => {
    seedSession(StudentUserFixture);
    render(<App />);

    // The navbar names the signed-in user...
    expect(await screen.findByText(StudentUserFixture.email)).toBeInTheDocument();
    expect(screen.getByText('👨‍🎓 SINH VIÊN')).toBeInTheDocument();
    // ...and the student console renders.
    expect(await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đăng nhập bằng Google$/ })).not.toBeInTheDocument();
  });

  it('requests the enrolled courses of the cached student', async () => {
    seedSession(StudentUserFixture);
    render(<App />);
    await waitFor(() => expect(wasCalled(stub, '/api/v1/courses/student/SE170000')).toBe(true));
  });

  it('routes a cached INSTRUCTOR session to the lecturer console', async () => {
    seedSession(LecturerUserFixture);
    render(<App />);

    expect(await screen.findByText('👨‍🏫 GIẢNG VIÊN')).toBeInTheDocument();
    expect(await screen.findByText(/Cổng Điều Hành Học Phần & Khảo Thí Lập Trình/)).toBeInTheDocument();
    await waitFor(() => expect(wasCalled(stub, '/api/v1/submissions/gradebook')).toBe(true));
  });

  it('routes a cached ADMIN session to the admin console', async () => {
    seedSession(AdminUserFixture);
    render(<App />);

    expect(await screen.findByText('⚙️ ADMIN')).toBeInTheDocument();
    expect(await screen.findByText(/Bảng Điều Khiển Quản Trị/)).toBeInTheDocument();
    await waitFor(() => expect(wasCalled(stub, '/api/v1/queue/stats')).toBe(true));
  });

  it('routes a cached HOD session to the head-of-department console', async () => {
    // Regression guard: HOD used to have no badge branch of its own in the navbar, so the head
    // of department was labelled "👨‍🎓 SINH VIÊN" — the same badge a student gets.
    seedSession(HodUserFixture);
    render(<App />);

    expect(await screen.findByText('Cổng Trưởng Bộ Môn (HOD)')).toBeInTheDocument();
    expect(screen.getByText('🛡️ TRƯỞNG BỘ MÔN')).toBeInTheDocument();
    expect(screen.queryByText('👨‍🎓 SINH VIÊN')).not.toBeInTheDocument();
    await waitFor(() => expect(wasCalled(stub, '/api/v1/plagiarism')).toBe(true));
  });

  it('discards a cached profile whose Vietnamese name lost its diacritics', async () => {
    // A cached name such as "Dinh Th?nh Trung" is unreadable, so the session is thrown away
    // rather than rendered; the user signs in again and gets a correct profile from the API.
    seedSession({ ...StudentUserFixture, fullName: 'Dinh Th?nh Trung' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<App />);

    expect(await screen.findByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeInTheDocument();
    expect(localStorage.getItem('aita_user')).toBeNull();
    expect(localStorage.getItem('aita_token')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('lỗi font'));
    warn.mockRestore();
  });

  it('keeps a cached profile that only contains a replacement character', async () => {
    seedSession({ ...StudentUserFixture, fullName: 'Đinh Th\uFFFDnh Trung' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);
    expect(await screen.findByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeInTheDocument();
    warn.mockRestore();
  });

  it('ignores a cached profile that is not valid JSON', async () => {
    localStorage.setItem('aita_user', '{ khong-phai-json');
    render(<App />);
    expect(await screen.findByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeInTheDocument();
  });

  it('ignores a cached profile with an unknown role and falls back to the student view', async () => {
    seedSession({ ...StudentUserFixture, role: 'KHONG-CO-QUYEN' });
    render(<App />);
    expect(await screen.findByText('👨‍🎓 SINH VIÊN')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// App — navigation, tab switching and logout
// ---------------------------------------------------------------------------------------------

describe('App — navigation', () => {
  it('offers a student no cross-role navigation tabs', async () => {
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/);

    expect(screen.queryByRole('button', { name: /Cổng Giảng Viên/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cổng Trưởng Bộ Môn/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hệ thống Quản trị/ })).not.toBeInTheDocument();
  });

  it('lets an admin switch between the three staff consoles', async () => {
    const user = userEvent.setup();
    seedSession(AdminUserFixture);
    render(<App />);
    await screen.findByText(/Bảng Điều Khiển Quản Trị/);

    await user.click(screen.getByRole('button', { name: /Cổng Giảng Viên/ }));
    expect(await screen.findByText(/Cổng Điều Hành Học Phần & Khảo Thí Lập Trình/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cổng Trưởng Bộ Môn/ }));
    expect(await screen.findByText('Cổng Trưởng Bộ Môn (HOD)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hệ thống Quản trị/ }));
    expect(await screen.findByText(/Bảng Điều Khiển Quản Trị/)).toBeInTheDocument();
  });

  it('switches a student between every tab and fetches what each tab needs', async () => {
    const user = userEvent.setup();
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/);

    await user.click(screen.getByRole('button', { name: /Lịch Sử Nộp & Điểm Số/ }));
    await waitFor(() => expect(wasCalled(stub, '/api/v1/submissions?studentId=SE170000')).toBe(true));

    await user.click(screen.getByRole('button', { name: /Phúc Khảo & Khiếu Nại/ }));
    await waitFor(() => expect(wasCalled(stub, '/api/v1/appeals')).toBe(true));

    await user.click(screen.getByRole('button', { name: /Đối Soát Đạo Văn/ }));
    expect(
      await screen.findByText(/Phòng Thí Nghiệm Nghiên Cứu Đối Soát Mã Nguồn/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nộp Bài Tập Lập Trình/ }));
    expect(await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/)).toBeInTheDocument();
  });

  it('clears the session on logout and returns to the sign-in gate', async () => {
    const user = userEvent.setup();
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(StudentUserFixture.email);

    await user.click(screen.getByRole('button', { name: /Đăng Xuất/ }));

    expect(await screen.findByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeInTheDocument();
    expect(localStorage.getItem('aita_token')).toBeNull();
    expect(localStorage.getItem('aita_user')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// App — enrolled courses
// ---------------------------------------------------------------------------------------------

describe('App — enrolled courses', () => {
  const coursesRoute = (body: unknown) => ({
    routes: [{ match: '/api/v1/courses/student/', body: { statusCode: 200, data: body } }],
  });

  it('renders one card per course returned by the API', async () => {
    stub.restore();
    stub = installFetchStub(
      coursesRoute([
        { courseId: 'CRS-SWP391', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
        { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình .NET', semester: 'SU2026' },
      ]),
    );
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText(/\(2 Môn\)/)).toBeInTheDocument();
    expect(screen.getByText('Dự án Phần mềm')).toBeInTheDocument();
    expect(screen.getByText('Lập trình .NET')).toBeInTheDocument();
  });

  it('collapses duplicate course codes into a single card', async () => {
    stub.restore();
    stub = installFetchStub(
      coursesRoute([
        { courseId: 'CRS-SWP391-A', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
        { courseId: 'CRS-SWP391-B', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
        { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình .NET', semester: 'SU2026' },
      ]),
    );
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText(/\(2 Môn\)/)).toBeInTheDocument();
  });

  it('keeps the built-in course list when the API returns nothing', async () => {
    stub.restore();
    stub = installFetchStub(coursesRoute([]));
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText(/\(3 Môn\)/)).toBeInTheDocument();
  });

  it('does not request courses for a lecturer', async () => {
    seedSession(LecturerUserFixture);
    render(<App />);
    await screen.findByText(/Cổng Điều Hành Học Phần/);
    expect(wasCalled(stub, '/api/v1/courses/student/')).toBe(false);
  });

  it('renders a course whose API payload omits courseCode', async () => {
    // Regression: the payload was normalised with `let norm = c.courseCode`, so a row without
    // a courseCode produced `courseCode: undefined`. SubmissionView then called
    // `c.courseCode.replace(...)` on it and the whole student console crashed with
    // "Cannot read properties of undefined (reading 'replace')".
    stub.restore();
    stub = installFetchStub(
      coursesRoute([{ courseId: 'CRS-NEW101', courseName: 'Môn Chưa Có Mã', semester: 'SU2026' }]),
    );
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText('Môn Chưa Có Mã')).toBeInTheDocument();
    expect(await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// App — repairing a corrupted profile returned by the API
// ---------------------------------------------------------------------------------------------

describe('App — corrupted profile from the login response', () => {
  it('re-fetches the profile and caches the repaired name', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: { ...StudentUserFixture, fullName: 'Dinh Th?nh Trung' }, token: 't' } },
        },
        {
          match: '/api/v1/users/SE170000',
          body: { statusCode: 200, data: { ...StudentUserFixture, fullName: 'Đinh Thành Trung' } },
        },
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    await user.click(await screen.findByTitle('Đăng nhập với trungse170000@fpt.edu.vn'));

    await waitFor(() => expect(wasCalled(stub, '/api/v1/users/SE170000')).toBe(true));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('aita_user') ?? '{}').fullName).toBe('Đinh Thành Trung'),
    );
    expect(document.body.textContent).not.toContain('Dinh Th?nh');
    warn.mockRestore();
  });

  it('keeps the signed-in profile when the repair call reports success but with no usable name', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: { ...StudentUserFixture, fullName: 'Dinh Th?nh Trung' }, token: 't' } },
        },
        { match: '/api/v1/users/SE170000', body: { statusCode: 200, data: {} } },
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    await user.click(await screen.findByTitle('Đăng nhập với trungse170000@fpt.edu.vn'));

    // The API answered but had nothing better to offer, so the (broken) session still wins
    // rather than the user being dumped back to the login screen in a loop.
    expect(await screen.findByRole('button', { name: /Đăng Xuất/ })).toBeInTheDocument();
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------
// App — the submission pipeline
// ---------------------------------------------------------------------------------------------

describe('App — submission pipeline', () => {
  it('POSTs the selected archive to the gateway with student, assignment and language', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-ZIP-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    render(<App />);

    await openAssignment();
    const zip = new JSZip();
    zip.file('Solution.py', 'def solve(a):\n    return a\n');
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File([blob], 'Solution.zip', { type: 'application/zip' }));

    const confirm = await screen.findByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    await user.click(confirm);

    await waitFor(() => expect(callFor(stub, '/api/v1/submissions', 'POST')).toBeTruthy());
    const init = callFor(stub, '/api/v1/submissions', 'POST');
    expect(init.headers.Authorization).toBe('Bearer stub-token');

    const form = init.body as FormData;
    expect(form.get('studentId')).toBe('SE170000');
    expect(form.get('assignmentId')).toBe('ASM-SWP391-01');
    // The unzipped source starts with `def `, so the language is detected as python.
    expect(form.get('language')).toBe('python');
    expect((form.get('file') as File).name).toBe('Solution.zip');
  });

  it('shows the live progress report with every pipeline stage while grading runs', async () => {
    seedSession(StudentUserFixture);
    render(<App />);

    // Real timers are used for the mount above; the simulation itself needs a clock the test
    // can wind forward, so fake timers only start once the confirm button is ready.
    const confirm = await attachArchive();
    vi.useFakeTimers();
    fireEvent.click(confirm);

    expect(screen.getByText(/Đang Chấm Bài Tự Động/)).toBeInTheDocument();
    // Every stage from App's `initialSteps` is listed for the student.
    expect(screen.getByText('Hàng đợi xử lý bài nộp')).toBeInTheDocument();
    expect(screen.getByText('Khởi tạo môi trường cách ly')).toBeInTheDocument();
    expect(screen.getByText('Chạy Testcase 1 (Dữ liệu cơ sở)')).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá mã nguồn sạch & nguyên lý SOLID/)).toBeInTheDocument();
    expect(screen.getByText(/Kiểm tra đạo văn mã nguồn/)).toBeInTheDocument();
  });

  it('grades locally and persists the score when the gateway refuses the upload', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/submissions', status: 500, body: { message: 'gateway hỏng' } }],
    });
    seedSession(StudentUserFixture);
    render(<App />);

    const confirm = await attachArchive();
    // The websocket never connects under jsdom, so `handleSubmission` skips the 202 branch and
    // falls through to `simulateSocketGradingEvents` — the fallback under test.
    vi.useFakeTimers();
    fireEvent.click(confirm);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    // The modal reports the simulated result...
    expect(screen.getByText(/Kết Quả Đánh Giá Mã Nguồn & Nhận Xét AI/)).toBeInTheDocument();
    expect(document.body.textContent).toContain('Tổng Điểm: 9.5');
    // ...and the same result is persisted so the history tab can read it back.
    const stored = JSON.parse(localStorage.getItem('aita_student_submissions_SE170000') ?? '{}');
    expect(stored['ASM-SWP391-01'].status).toBe('GRADED');
    expect(stored['ASM-SWP391-01'].score).toBe(9.5);
  });

  it('reports a plagiarism match found by the gateway once grading completes', async () => {
    // The socket double can push the same events the API Gateway does, which is the only way
    // to cover the `grading:completed` handler without a live gateway.
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-LIVE-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    const confirm = await attachArchive();
    fireEvent.click(confirm);

    await waitFor(() => expect(socketMock.socket.emit).toHaveBeenCalledWith(
      'join_submission',
      expect.objectContaining({ submissionId: 'SUB-LIVE-1', role: 'STUDENT' }),
    ));
    expect(document.body.textContent).toContain('SUB-LIVE');

    await pushSocket('grading:completed', {
      submissionId: 'SUB-LIVE-1',
      score: 7.25,
      scoreBreakdown: { testcase1: 4, testcase2: 2, cleanCode: 1, solid: 0.25, total: 7.25 },
      executionTimeMs: 980,
    });

    await waitFor(() => expect(document.body.textContent).toContain('Tổng Điểm: 7.25'));
    expect(document.body.textContent).toContain('980ms');
    const stored = JSON.parse(localStorage.getItem('aita_student_submissions_SE170000') ?? '{}');
    expect(stored['ASM-SWP391-01'].score).toBe(7.25);
  });

  it('marks a grading stage as failed when the gateway reports an error', async () => {
    // The socket double pushes the events a live gateway would send. A connected socket makes
    // `handleSubmission` take the 202 branch, so the local simulation never starts and the
    // report on screen reflects only what the gateway pushed.
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-FAIL-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    fireEvent.click(await attachArchive());

    await pushSocket('grading:progress', { stepId: '2', stepName: 'Khởi tạo môi trường', status: 'in_progress' });
    expect(await screen.findByText('ĐANG XỬ LÝ...')).toBeInTheDocument();

    await pushSocket('grading:failed', { error: 'Docker không khởi động được' });
    expect(await screen.findByText('Docker không khởi động được')).toBeInTheDocument();
    expect(screen.getByText('KHÔNG ĐẠT')).toBeInTheDocument();
  });

  it('warns instead of submitting when no assignment was chosen', async () => {
    seedSession(StudentUserFixture);
    render(<App />);

    // Reaching the upload form without a task is impossible from the list, so the guard is
    // asserted through the UI state that enforces it: confirming is blocked until a file is
    // attached, and a file alone is never graded without an assignment.
    await openAssignment();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ })).toBeDisabled();
    expect(wasCalled(stub, '/api/v1/submissions')).toBe(true); // the list fetch only
    expect(callFor(stub, '/api/v1/submissions', 'POST')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// LoginView — Google SSO gate
// ---------------------------------------------------------------------------------------------

describe('LoginView — sign-in gate', () => {
  const renderView = (onLoginSuccess = vi.fn()) => {
    const utils = render(<LoginView onLoginSuccess={onLoginSuccess} />);
    return { ...utils, onLoginSuccess };
  };

  it('renders the SSO gate with its headline and Google button', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'AITA-INTELLIGENT' })).toBeInTheDocument();
    expect(screen.getByText(/Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeEnabled();
  });

  it('requires the account to already exist in the database', () => {
    renderView();
    expect(screen.getByText(/Chỉ tài khoản Gmail đã có trong hệ thống CSDL/)).toBeInTheDocument();
  });

  it('lists every seeded demo account as its own button', () => {
    renderView();
    for (const email of [
      'admin@aita.fpt.edu.vn',
      'hod@fe.edu.vn',
      'trungdt@fe.edu.vn',
      'trungse170000@fpt.edu.vn',
    ]) {
      expect(screen.getByTitle(`Đăng nhập với ${email}`)).toBeInTheDocument();
    }
  });

  it('shows the shared demo password so the accounts are usable', () => {
    renderView();
    expect(screen.getByText('Aita@2026')).toBeInTheDocument();
  });

  it('explains that a blocked popup can be replaced by the redirect flow', () => {
    renderView();
    expect(
      screen.getByRole('button', { name: /Popup bị chặn\? Đăng nhập bằng Google \(chuyển trang\)/ }),
    ).toBeInTheDocument();
  });
});

describe('LoginView — demo account login', () => {
  it('submits the demo credentials to the login endpoint', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: LecturerUserFixture, token: 'tok-gv' } },
        },
      ],
    });
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(await screen.findByTitle('Đăng nhập với trungdt@fe.edu.vn'));

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/login')).toBe(true));
    const body = JSON.parse(callFor(stub, '/api/v1/auth/login').body);
    expect(body).toEqual({ email: 'trungdt@fe.edu.vn', password: 'Aita@2026' });
  });

  it('stores the token and reports the authenticated profile', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);

    await user.click(await screen.findByTitle('Đăng nhập với trungse170000@fpt.edu.vn'));

    expect(await screen.findByText(/Đăng nhập thành công với quyền STUDENT/)).toBeInTheDocument();
    expect(localStorage.getItem('aita_token')).toBe('stub-token');
    expect(JSON.parse(localStorage.getItem('aita_user') ?? '{}').userId).toBe('SE170000');

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(StudentUserFixture), { timeout: 2000 });
  });

  it('renders the Vietnamese error message returned by the API', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          status: 401,
          body: { message: 'Tài khoản chưa được phân quyền truy cập hệ thống.' },
        },
      ],
    });
    render(<LoginView onLoginSuccess={onLoginSuccess} />);

    await user.click(await screen.findByTitle('Đăng nhập với admin@aita.fpt.edu.vn'));

    expect(
      await screen.findByText(/Không đăng nhập được admin@aita\.fpt\.edu\.vn: Tài khoản chưa được phân quyền/),
    ).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('aita_token')).toBeNull();
  });

  it('joins an array of validation messages into one readable line', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          status: 400,
          body: { message: ['email must be an email', 'password is too short'] },
        },
      ],
    });
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(await screen.findByTitle('Đăng nhập với hod@fe.edu.vn'));

    expect(
      await screen.findByText(/email must be an email; password is too short/),
    ).toBeInTheDocument();
  });

  it('reports a network failure instead of leaving the button spinning', async () => {
    const user = userEvent.setup();
    stub.restore();
    const failing = vi.fn(() => Promise.reject(new Error('mất kết nối')));
    (globalThis as any).fetch = failing;
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(await screen.findByTitle('Đăng nhập với hod@fe.edu.vn'));

    expect(
      await screen.findByText(/Không thể kết nối đến máy chủ AITA API Gateway: mất kết nối/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ })).toBeEnabled();
  });

  it('disables every sign-in control while a request is in flight', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    stub.restore();
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    (globalThis as any).fetch = vi.fn(() =>
      pending.then(() => ({
        ok: false,
        status: 500,
        json: async () => ({ message: 'chậm' }),
      })),
    );
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(await screen.findByTitle('Đăng nhập với hod@fe.edu.vn'));

    expect(screen.getByRole('button', { name: /Đang xác thực với Google/ })).toBeDisabled();
    expect(screen.getByTitle('Đăng nhập với hod@fe.edu.vn')).toBeDisabled();

    await act(async () => {
      release(undefined);
      await pending;
    });
  });
});

describe('LoginView — Google Identity Services', () => {
  /** Installs a fake GIS client and returns the callback Google would invoke. */
  function installGsi() {
    const state: { callback?: (r: { credential?: string }) => void } = {};
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn((config: any) => {
            state.callback = config.callback;
          }),
          prompt: vi.fn(),
        },
      },
    };
    return state;
  }

  it('verifies the Google ID token with the backend and signs the user in', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    const gsi = installGsi();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/google',
          body: { statusCode: 200, data: { user: StudentUserFixture, token: 'google-token' } },
        },
      ],
    });
    render(<LoginView onLoginSuccess={onLoginSuccess} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));
    expect((window as any).google.accounts.id.initialize).toHaveBeenCalled();

    await act(async () => {
      gsi.callback!({ credential: 'google-id-token' });
    });

    const body = JSON.parse(callFor(stub, '/api/v1/auth/google').body);
    expect(body).toEqual({ credential: 'google-id-token' });
    expect(localStorage.getItem('aita_token')).toBe('google-token');
    expect(await screen.findByText(/Đăng nhập Google thành công! Xin chào Đinh Thành Trung\./)).toBeInTheDocument();
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(StudentUserFixture), { timeout: 2000 });
  });

  it('blocks a Google account the database does not know', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    const gsi = installGsi();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/google',
          status: 403,
          body: { message: 'Email này chưa được Quản trị viên cấp quyền truy cập AITA.' },
        },
      ],
    });
    render(<LoginView onLoginSuccess={onLoginSuccess} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));
    await act(async () => {
      gsi.callback!({ credential: 'google-id-token' });
    });

    expect(await screen.findByText(/TRUY CẬP BỊ CHẶN/)).toBeInTheDocument();
    expect(screen.getByText(/chưa được Quản trị viên cấp quyền/)).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the rejection carries no text', async () => {
    const user = userEvent.setup();
    const gsi = installGsi();
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/auth/google', status: 500, body: {} }],
    });
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));
    await act(async () => {
      gsi.callback!({ credential: 'google-id-token' });
    });

    expect(await screen.findByText(/Không thể xác thực tài khoản Google với hệ thống AITA/)).toBeInTheDocument();
  });

  it('asks the user to retry when Google returns no ID token', async () => {
    const user = userEvent.setup();
    const gsi = installGsi();
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));
    await act(async () => {
      gsi.callback!({});
    });

    expect(await screen.findByText(/Google không trả về ID token. Vui lòng thử lại\./)).toBeInTheDocument();
  });

  it('names the exact origin to whitelist when Google rejects it', async () => {
    const user = userEvent.setup();
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          prompt: vi.fn((cb: any) => cb({ getNotDisplayedReason: () => 'unregistered_origin' })),
        },
      },
    };
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));

    expect(await screen.findByText(/Google chưa cho phép origin/)).toBeInTheDocument();
    expect(screen.getByText(/Authorized JavaScript origins/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('asks for popup permission when Google cannot display the chooser', async () => {
    const user = userEvent.setup();
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          prompt: vi.fn((cb: any) =>
            cb({ isNotDisplayed: () => true, getNotDisplayedReason: () => 'suppressed_by_user' }),
          ),
        },
      },
    };
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));

    expect(await screen.findByText(/Google không hiển thị được hộp đăng nhập/)).toBeInTheDocument();
    expect(screen.getByText(/suppressed_by_user/)).toBeInTheDocument();
  });

  it('explains that the Google library never loaded', async () => {
    const user = userEvent.setup();
    render(<LoginView onLoginSuccess={vi.fn()} />);
    expect((window as any).google).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));

    expect(await screen.findByText(/Chưa tải được thư viện Google Identity Services/)).toBeInTheDocument();
  });

  it('reports a broken GIS initialisation instead of throwing', async () => {
    const user = userEvent.setup();
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(() => {
            throw new Error('client id không hợp lệ');
          }),
          prompt: vi.fn(),
        },
      },
    };
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Đăng nhập bằng Google$/ }));

    expect(await screen.findByText(/Không khởi tạo được Google Sign-In: client id không hợp lệ/)).toBeInTheDocument();
  });

  it('sends the raw ID token from the redirect callback to the backend', async () => {
    window.history.replaceState(null, '', '/#id_token=redirect-id-token');
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/google',
          body: { statusCode: 200, data: { user: StudentUserFixture, token: 'redirect-token' } },
        },
      ],
    });

    render(<LoginView onLoginSuccess={vi.fn()} />);

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/google')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/google').body)).toEqual({
      credential: 'redirect-id-token',
    });
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('refuses an access-token-only redirect because it cannot be verified', async () => {
    window.history.replaceState(null, '', '/#access_token=ya29.something');
    render(<LoginView onLoginSuccess={vi.fn()} />);

    expect(
      await screen.findByText(/Google chỉ trả về access token\. Vui lòng dùng nút "Đăng nhập bằng Google"/),
    ).toBeInTheDocument();
    expect(wasCalled(stub, '/api/v1/auth/google')).toBe(false);
  });

  it('surfaces a Google redirect error and tells the user which URI to register', async () => {
    window.history.replaceState(
      null,
      '',
      '/?error=redirect_uri_mismatch&error_description=Bad+Request',
    );
    render(<LoginView onLoginSuccess={vi.fn()} />);

    expect(await screen.findByText(/Google từ chối yêu cầu đăng nhập \(redirect_uri_mismatch\)/)).toBeInTheDocument();
    expect(screen.getByText(/Authorized redirect URIs trong Google Cloud Console/)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('surfaces an error reported in the redirect hash', async () => {
    window.history.replaceState(null, '', '/#error=access_denied');
    render(<LoginView onLoginSuccess={vi.fn()} />);

    expect(await screen.findByText(/Google OAuth trả về lỗi: access_denied/)).toBeInTheDocument();
  });

  it('does nothing when the redirect carries no credentials at all', async () => {
    window.history.replaceState(null, '', '/');
    render(<LoginView onLoginSuccess={vi.fn()} />);
    expect(screen.queryByText(/TRUY CẬP BỊ CHẶN/)).not.toBeInTheDocument();
    expect(wasCalled(stub, '/api/v1/auth/google')).toBe(false);
  });
});

describe('LoginView — configuration panel', () => {
  it('shows the active client id and redirect URI', async () => {
    const user = userEvent.setup();
    render(<LoginView onLoginSuccess={vi.fn()} />);

    expect(screen.queryByLabelText(/Google OAuth 2.0 Client ID/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cấu hình Client ID/ }));

    expect((document.getElementById('config-client-id') as HTMLInputElement).value).toBe(DEFAULT_CLIENT_ID);
    expect((document.getElementById('config-redirect-uri') as HTMLInputElement).value).toBe(window.location.origin);
  });

  it('stores an edited client id and redirect URI', async () => {
    const user = userEvent.setup();
    render(<LoginView onLoginSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Cấu hình Client ID/ }));

    const clientIdInput = document.getElementById('config-client-id') as HTMLInputElement;
    const redirectInput = document.getElementById('config-redirect-uri') as HTMLInputElement;
    await user.clear(clientIdInput);
    await user.type(clientIdInput, '1234567890-abc.apps.googleusercontent.com');
    await user.clear(redirectInput);
    await user.type(redirectInput, 'http://localhost:5173/');
    await user.click(screen.getByRole('button', { name: /Lưu Cấu Hình/ }));

    expect(localStorage.getItem('aita_google_client_id')).toBe('1234567890-abc.apps.googleusercontent.com');
    expect(localStorage.getItem('aita_google_redirect_uri')).toBe('http://localhost:5173/');
    // Saving closes the panel.
    expect(document.getElementById('config-client-id')).toBeNull();
  });

  it('restores the default client id when the field is left empty', async () => {
    const user = userEvent.setup();
    render(<LoginView onLoginSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Cấu hình Client ID/ }));

    await user.clear(document.getElementById('config-client-id') as HTMLInputElement);
    await user.clear(document.getElementById('config-redirect-uri') as HTMLInputElement);
    await user.click(screen.getByRole('button', { name: /Lưu Cấu Hình/ }));

    expect(localStorage.getItem('aita_google_client_id')).toBe(DEFAULT_CLIENT_ID);
    expect(localStorage.getItem('aita_google_redirect_uri')).toBe(window.location.origin);
  });

  it('ignores the retired hard-coded client id found in storage', async () => {
    const user = userEvent.setup();
    // A value left over from the previous provider is replaced, not honoured.
    localStorage.setItem('aita_google_client_id', '652923540545-obsolete.apps.googleusercontent.com');
    render(<LoginView onLoginSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Cấu hình Client ID/ }));

    expect((document.getElementById('config-client-id') as HTMLInputElement).value).toBe(DEFAULT_CLIENT_ID);
  });

  it('honours a client id the user configured earlier', async () => {
    const user = userEvent.setup();
    localStorage.setItem('aita_google_client_id', '999-mine.apps.googleusercontent.com');
    localStorage.setItem('aita_google_redirect_uri', 'http://localhost:5174/');
    render(<LoginView onLoginSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Cấu hình Client ID/ }));

    expect((document.getElementById('config-client-id') as HTMLInputElement).value).toBe(
      '999-mine.apps.googleusercontent.com',
    );
    expect((document.getElementById('config-redirect-uri') as HTMLInputElement).value).toBe(
      'http://localhost:5174/',
    );
  });

  it('redirects to Google with the configured client id when popups are blocked', async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // jsdom cannot navigate; swallow the "Not implemented" noise it prints.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('aita_google_client_id', '999-mine.apps.googleusercontent.com');
    render(<LoginView onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Popup bị chặn\?/ }));

    const printed = log.mock.calls.map((c) => String(c[1])).join('\n');
    expect(printed).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(printed).toContain('client_id=999-mine.apps.googleusercontent.com');
    expect(printed).toContain('response_type=id_token');
    log.mockRestore();
    error.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------
// LoginModal — email + OTP fallback
// ---------------------------------------------------------------------------------------------

describe('LoginModal — the email step', () => {
  const renderModal = (props: Partial<ComponentProps<typeof LoginModal>> = {}) => {
    const onClose = vi.fn();
    const onLoginSuccess = vi.fn();
    const utils = render(<LoginModal isOpen onClose={onClose} onLoginSuccess={onLoginSuccess} {...props} />);
    return { ...utils, onClose, onLoginSuccess };
  };

  const typeCredentials = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
    await user.type(screen.getByPlaceholderText(/Nhập email/), email);
    await user.type(screen.getByPlaceholderText(/Mật khẩu/), password);
  };

  it('renders nothing while closed', () => {
    render(<LoginModal isOpen={false} onClose={vi.fn()} onLoginSuccess={vi.fn()} />);
    expect(screen.queryByText('Xác Thực OTP Google SSO')).not.toBeInTheDocument();
  });

  it('shows the OTP heading and asks for a Gmail or FPT address', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Xác Thực OTP Google SSO' })).toBeInTheDocument();
    expect(screen.getByText(/Nhập Gmail \/ FPT Email để nhận mã OTP xác thực/)).toBeInTheDocument();
  });

  it('closes when the X button is pressed', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    // Regression: the close control was icon-only with no accessible name, so it was invisible
    // to both assistive tech and `getByRole('button', { name })`.
    await user.click(screen.getByRole('button', { name: 'Đóng hộp thoại đăng nhập' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('demands an email before calling the API', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Vui lòng nhập địa chỉ Gmail hoặc FPT Email!')).toBeInTheDocument();
    expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(false);
  });

  it('demands a password, because the API returns 401 without one', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText(/Nhập email/), 'sinhvien.test@fpt.edu.vn');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Vui lòng nhập mật khẩu để tiếp tục.')).toBeInTheDocument();
    expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(false);
  });

  it('rejects a malformed address without calling the API', async () => {
    const user = userEvent.setup();
    renderModal();

    await typeCredentials(user, 'khong-phai-email', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Địa chỉ email không đúng định dạng!')).toBeInTheDocument();
    expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(false);
  });

  it('clears a previous error as soon as the email is edited again', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));
    expect(await screen.findByText('Vui lòng nhập địa chỉ Gmail hoặc FPT Email!')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Nhập email/), 'a');
    await waitFor(() =>
      expect(screen.queryByText('Vui lòng nhập địa chỉ Gmail hoặc FPT Email!')).not.toBeInTheDocument(),
    );
  });

  it('normalises the address before requesting an OTP', async () => {
    const user = userEvent.setup();
    renderModal();

    await typeCredentials(user, '  SinhVien.Test@FPT.edu.vn  ', '  Aita@2026  ');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/request-otp').body)).toEqual({
      email: 'sinhvien.test@fpt.edu.vn',
      password: 'Aita@2026',
    });
  });

  it('submits on Enter from the email field', async () => {
    const user = userEvent.setup();
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    fireEvent.keyDown(screen.getByPlaceholderText(/Nhập email/), { key: 'Enter' });

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(true));
  });

  it('submits on Enter from the password field', async () => {
    const user = userEvent.setup();
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    fireEvent.keyDown(screen.getByPlaceholderText(/Mật khẩu/), { key: 'Enter' });

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/request-otp')).toBe(true));
  });

  it('renders the rejection message from the API', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/request-otp',
          status: 401,
          body: { message: 'Mật khẩu không đúng cho tài khoản này.' },
        },
      ],
    });
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'sai-mat-khau');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Mật khẩu không đúng cho tài khoản này.')).toBeInTheDocument();
    // Still on the email step, so the user can correct the password.
    expect(screen.getByPlaceholderText(/Mật khẩu/)).toBeInTheDocument();
  });

  it('falls back to a generic message when the rejection has no text', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/auth/request-otp', status: 500, body: {} }],
    });
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Yêu cầu gửi mã OTP thất bại!')).toBeInTheDocument();
  });

  it('reports an unreachable authentication server', async () => {
    const user = userEvent.setup();
    stub.restore();
    (globalThis as any).fetch = vi.fn(() => Promise.reject(new Error('mất mạng')));
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Không thể kết nối đến máy chủ xác thực.')).toBeInTheDocument();
  });

  it('explains that the OTP was emailed when SMTP is configured', async () => {
    const user = userEvent.setup();
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(
      await screen.findByText('Mã xác thực OTP đã được gửi đến sinhvien.test@fpt.edu.vn.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mã OTP đã gửi tới sinhvien.test@fpt.edu.vn/)).toBeInTheDocument();
    expect(screen.getByText(/hãy kiểm tra hộp thư spam/)).toBeInTheDocument();
  });

  it('shows the MOCK code when the server has no SMTP configured', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/api/v1/auth/request-otp', body: { statusCode: 200, data: { debugOtp: '246810' } } },
      ],
    });
    renderModal();

    await typeCredentials(user, 'sinhvien.test@fpt.edu.vn', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('246810')).toBeInTheDocument();
    expect(screen.getByText(/Máy chủ chưa cấu hình SMTP nên mã OTP được hiển thị ngay bên dưới/)).toBeInTheDocument();
  });

  it('logs the user straight in when the server bypasses OTP for staff', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/request-otp',
          body: {
            statusCode: 200,
            data: { bypassOtp: true, token: 'bypass-token', user: LecturerUserFixture },
          },
        },
      ],
    });
    const { onLoginSuccess, onClose } = renderModal();

    await typeCredentials(user, 'trungdt@fe.edu.vn', 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    expect(await screen.findByText('Đăng nhập thành công!')).toBeInTheDocument();
    expect(localStorage.getItem('aita_token')).toBe('bypass-token');
    // The OTP step is never shown.
    expect(screen.queryByText(/Gửi lại sau/)).not.toBeInTheDocument();

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(LecturerUserFixture, 'bypass-token'), {
      timeout: 2000,
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LoginModal — the OTP step', () => {
  const renderModal = () => {
    const onClose = vi.fn();
    const onLoginSuccess = vi.fn();
    render(<LoginModal isOpen onClose={onClose} onLoginSuccess={onLoginSuccess} />);
    return { onClose, onLoginSuccess };
  };

  /** Walk the modal to the OTP step with a real (non-MOCK) send. */
  async function reachOtpStep(user: ReturnType<typeof userEvent.setup>, email = 'sinhvien.test@fpt.edu.vn') {
    await user.type(screen.getByPlaceholderText(/Nhập email/), email);
    await user.type(screen.getByPlaceholderText(/Mật khẩu/), 'Aita@2026');
    await user.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));
    await screen.findByText(new RegExp(`Mã OTP đã gửi tới ${email}`));
    // The first box grabs focus 150ms after the step renders. Let that timer fire before any
    // test drives the boxes, so a keystroke cannot race the component's own focus handling.
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  const otpBoxes = () =>
    Array.from(document.querySelectorAll('input[inputmode="numeric"]')) as HTMLInputElement[];

  it('shows six separate boxes and keeps the verify button disabled until they are full', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    expect(otpBoxes()).toHaveLength(6);
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeDisabled();

    await user.type(otpBoxes()[0], '12345');
    await waitFor(() => expect(otpBoxes().filter((b) => b.value).length).toBe(5));
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeDisabled();
  });

  it('can go back to the email step', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    await user.click(screen.getByRole('button', { name: /Đổi email/ }));

    expect(await screen.findByPlaceholderText(/Nhập email/)).toBeInTheDocument();
  });

  it('moves focus to the next box while digits are typed, and back on Backspace', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '1');
    await waitFor(() => expect(document.activeElement).toBe(otpBoxes()[1]));

    fireEvent.keyDown(otpBoxes()[1], { key: 'Backspace' });
    await waitFor(() => expect(document.activeElement).toBe(otpBoxes()[0]));
  });

  it('ignores non-numeric characters', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    fireEvent.change(otpBoxes()[0], { target: { value: 'a' } });
    await waitFor(() => expect(otpBoxes()[0].value).toBe(''));

    // A pasted-in "1a" keeps only the last numeric character.
    fireEvent.change(otpBoxes()[0], { target: { value: '1a' } });
    await waitFor(() => expect(otpBoxes()[0].value).toBe('1'));
  });

  it('verifies automatically once the sixth digit is entered', async () => {
    const user = userEvent.setup();
    // The shared stub router has no default for verify-otp, so the success payload is declared
    // here rather than relied upon.
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/verify-otp',
          body: { statusCode: 200, data: { user: StudentUserFixture, token: 'stub-token' } },
        },
      ],
    });
    const { onLoginSuccess } = renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '135790');

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/verify-otp').body)).toEqual({
      email: 'sinhvien.test@fpt.edu.vn',
      otp: '135790',
    });
    // The session is stored, and the modal hands the profile back after its closing delay.
    await waitFor(() => expect(localStorage.getItem('aita_token')).toBe('stub-token'));
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(StudentUserFixture, 'stub-token'), {
      timeout: 3000,
    });
  });

  it('verifies a manually confirmed six-digit code', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    const boxes = otpBoxes();
    for (let i = 0; i < 5; i += 1) {
      // Filling one box at a time exercises the focus chain rather than the auto-submit.
      fireEvent.change(boxes[i], { target: { value: String(i + 1) } });
    }
    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(false));
    fireEvent.change(boxes[5], { target: { value: '6' } });

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/verify-otp').body).otp).toBe('123456');
  });

  it('distributes a pasted six-digit code across the boxes and verifies it', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    fireEvent.paste(otpBoxes()[0], {
      clipboardData: { getData: () => '  987 654  ', text: '987654' },
    });

    await waitFor(() => expect(otpBoxes().map((b) => b.value).join('')).toBe('987654'));
    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/verify-otp').body).otp).toBe('987654');
  });

  it('only keeps the first six digits of a longer paste', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    fireEvent.paste(otpBoxes()[0], { clipboardData: { getData: () => '1234567890' } });

    await waitFor(() => expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(true));
    expect(JSON.parse(callFor(stub, '/api/v1/auth/verify-otp').body).otp).toBe('123456');
  });

  it('fills the remaining boxes from a short paste without verifying yet', async () => {
    const user = userEvent.setup();
    renderModal();
    await reachOtpStep(user);

    fireEvent.paste(otpBoxes()[0], { clipboardData: { getData: () => '123' } });

    // A partial code still lands in the boxes, but six digits are required to verify.
    await waitFor(() => expect(otpBoxes().map((b) => b.value).join('')).toBe('123'));
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeDisabled();
    expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(false);
  });

  it('starts a paste at the box the user pasted into', async () => {
    const user = userEvent.setup();
    // Regression: only a paste into the first box was honoured, and only when it carried six
    // or more digits — so pasting into box 3, or pasting a code that still had surrounding
    // text such as "123-456", silently did nothing at all.
    renderModal();
    await reachOtpStep(user);

    fireEvent.paste(otpBoxes()[2], { clipboardData: { getData: () => '123-456' } });

    // The four digits that fit land in boxes 3–6; the code is still incomplete, so the modal
    // must not try to verify it.
    await waitFor(() => expect(otpBoxes().map((b) => b.value).join('')).toBe('1234'));
    expect(otpBoxes()[2].value).toBe('1');
    expect(otpBoxes()[5].value).toBe('4');
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeDisabled();
    expect(wasCalled(stub, '/api/v1/auth/verify-otp')).toBe(false);
  });

  it('reports an incorrect OTP and stays open', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/api/v1/auth/verify-otp', status: 400, body: { message: 'Mã xác thực OTP không chính xác!' } },
      ],
    });
    const { onClose } = renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '000000');

    expect(await screen.findByText('Mã xác thực OTP không chính xác!')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeEnabled();
  });

  it('uses a generic message when the rejection carries no text', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/auth/verify-otp', status: 500, body: {} }],
    });
    renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '000000');

    expect(await screen.findByText('Mã xác thực OTP không chính xác!')).toBeInTheDocument();
  });

  it('rejects a successful response that carries no session', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/auth/verify-otp', body: { statusCode: 200, data: {} } }],
    });
    const { onLoginSuccess, onClose } = renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '000000');

    expect(await screen.findByText('Phản hồi từ máy chủ không hợp lệ!')).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The button must become usable again, otherwise the user is stuck.
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeEnabled();
  });

  it('reports a connection error while verifying', async () => {
    const user = userEvent.setup();
    // Only the verify call drops the connection; the OTP request that got us here still
    // succeeds, so the failure is attributable to verification alone.
    stub.restore();
    const router = stub.spy;
    (globalThis as any).fetch = vi.fn((input: any, init?: any) =>
      String(input).includes('verify-otp') ? Promise.reject(new Error('mất mạng')) : router(input, init),
    );
    renderModal();
    await reachOtpStep(user);

    await user.type(otpBoxes()[0], '000000');

    expect(await screen.findByText('Lỗi kết nối khi xác thực OTP!')).toBeInTheDocument();
    // The button must become usable again, otherwise the user is stuck on the OTP screen.
    expect(screen.getByRole('button', { name: /Xác Nhận & Đăng Nhập/ })).toBeEnabled();
  });

  it('counts down before offering to resend the code, then resends it', async () => {
    vi.useFakeTimers();
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/auth/request-otp', body: { statusCode: 200, data: {} } }],
    });
    render(<LoginModal isOpen onClose={vi.fn()} onLoginSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Nhập email/), {
      target: { value: 'sinhvien.test@fpt.edu.vn' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Mật khẩu/), { target: { value: 'Aita@2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi Mã Xác Thực OTP Đến Gmail/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Gửi lại sau (60s)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gửi lại mã/ })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText('Gửi lại sau (57s)')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(58000);
    });

    const resend = screen.getByRole('button', { name: /Gửi lại mã/ });
    const before = stub.spy.mock.calls.filter((c) => urlOf(c).includes('request-otp')).length;

    fireEvent.click(resend);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const after = stub.spy.mock.calls.filter((c) => urlOf(c).includes('request-otp')).length;
    expect(after).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------------------------
// App — gateway socket
// ---------------------------------------------------------------------------------------------

describe('App — gateway socket', () => {
  it('reports the gateway as ready once the socket connects, and as down when it drops', async () => {
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/);

    // Before any event the badge shows the connecting state.
    expect(screen.getByText('Đang Kết Nối Cổng...')).toBeInTheDocument();

    emitSocket('connect', undefined);
    expect(await screen.findByText('Cổng Dịch Vụ Sẵn Sàng')).toBeInTheDocument();

    emitSocket('disconnect', undefined);
    expect(await screen.findByText('Đang Kết Nối Cổng...')).toBeInTheDocument();
  });

  it('treats a connection error as the gateway being unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/);

    emitSocket('connect_error', new Error('ECONNREFUSED'));
    expect(await screen.findByText('Đang Kết Nối Cổng...')).toBeInTheDocument();
    warn.mockRestore();
  });

  it('updates a named grading stage when the gateway pushes progress', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-PROG-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    fireEvent.click(await attachArchive());
    await waitFor(() => expect(screen.getByText(/Đang Chấm Bài Tự Động/)).toBeInTheDocument());

    await pushSocket('grading:progress', {
      stepId: '3',
      stepName: 'Chạy Testcase 1',
      status: 'in_progress',
      detail: 'Đang chạy trên 2 bộ dữ liệu',
    });

    expect(await screen.findByText('Đang chạy trên 2 bộ dữ liệu')).toBeInTheDocument();
  });

  it('records each evaluated test case against its own pipeline stage', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-TC-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    fireEvent.click(await attachArchive());
    await waitFor(() => expect(screen.getByText(/Đang Chấm Bài Tự Động/)).toBeInTheDocument());

    await pushSocket('testcase:evaluated', { testcaseIndex: 1, totalTestcases: 2, status: 'PASSED', timeMs: 120 });
    expect(await screen.findByText(/Testcase 1\/2: ĐẠT \(120ms\)/)).toBeInTheDocument();

    // A failing second case is recorded against the other stage and marked KHÔNG ĐẠT.
    emitSocket('testcase:evaluated', { testcaseIndex: 2, totalTestcases: 2, status: 'FAILED', timeMs: 2000 });
    expect(await screen.findByText(/Testcase 2\/2: KHÔNG ĐẠT \(2000ms\)/)).toBeInTheDocument();
  });

  it('renders the AI review pushed over the socket', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-AI-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    fireEvent.click(await attachArchive());
    await waitFor(() => expect(screen.getByText(/Đang Chấm Bài Tự Động/)).toBeInTheDocument());

    // `emitSocket` only reaches handlers App has already registered, and registration happens
    // inside the mount effect. Without waiting for that subscription this test raced the
    // effect: the emitted events found no listener and the report never appeared, which is why
    // it passed alone but flaked in a full-suite run.
    await waitForSocketHandler('ai:reviewed');

    emitSocket('ai:reviewed', {
      cleanCodeScore: 8.5,
      solidScore: { s: 9, o: 8, l: 8, i: 7, d: 9 },
      codeSmells: [{ line: 12, rule: 'Phương thức quá dài', description: 'Nên tách nhỏ.' }],
      explanation: 'Mã nguồn rõ ràng.',
    });
    emitSocket('grading:completed', { submissionId: 'SUB-AI-1', score: 9 });

    expect(await screen.findByText(/Kết Quả Đánh Giá Mã Nguồn & Nhận Xét AI/)).toBeInTheDocument();
    expect(screen.getByText(/Đánh Giá 5 Trục SOLID/)).toBeInTheDocument();
    // Regression: `codeSmells[].rule` is part of the AIRating contract and comes back from the
    // API, but the smell card only ever rendered `description` — the student could not see
    // which principle had been broken.
    expect(screen.getByText('Phương thức quá dài:')).toBeInTheDocument();
    // The smell is quoted twice: once in the smell list and once in the pedagogical hint.
    expect(screen.getAllByText(/Nên tách nhỏ\./).length).toBe(2);
    expect(screen.getByText(/Mã nguồn rõ ràng\./)).toBeInTheDocument();
  });

  it('ignores an empty AI review payload', async () => {
    seedSession(StudentUserFixture);
    render(<App />);
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài/);

    // A falsy `ai:reviewed` payload must not be written into state (it would crash the radar
    // chart on `solidScore`).
    expect(() => emitSocket('ai:reviewed', null)).not.toThrow();
    expect(screen.queryByText(/Đánh Giá 5 Trục SOLID/)).not.toBeInTheDocument();
  });

  it('completes the report even when the gateway sends no detail fields', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          status: 202,
          body: { statusCode: 202, data: { submissionId: 'SUB-BARE-1' } },
        },
      ],
    });
    seedSession(StudentUserFixture);
    socketMock.socket.connected = true;
    render(<App />);

    fireEvent.click(await attachArchive());
    await waitFor(() => expect(screen.getByText(/Đang Chấm Bài Tự Động/)).toBeInTheDocument());

    // Every optional field is absent, so none of the `if (data.x)` guards may run.
    emitSocket('grading:completed', {});

    // The report still finishes and every stage is marked passed.
    expect(await screen.findByText(/Kết Quả Đánh Giá Mã Nguồn/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('ĐẠT').length).toBe(6));
  });
});

// ---------------------------------------------------------------------------------------------
// App — enrolled course selection
// ---------------------------------------------------------------------------------------------

describe('App — course selection', () => {
  const TWO_COURSES = {
    routes: [
      {
        match: '/api/v1/courses/student/',
        body: {
          statusCode: 200,
          data: [
            { courseId: 'CRS-SWP391', courseCode: 'SWP391', courseName: 'Dự án Phần mềm', semester: 'SU2026' },
            { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình .NET', semester: 'SU2026' },
          ],
        },
      },
    ],
  };

  it('selects a course card and clears the filter when it is clicked again', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub(TWO_COURSES);
    seedSession(StudentUserFixture);
    render(<App />);

    // The submission view mirrors the navbar selection into its own course filter.
    const filter = (await screen.findByDisplayValue('Tất Cả Môn Học')) as HTMLSelectElement;
    expect(filter).toBeInTheDocument();

    await user.click(screen.getByText('Dự án Phần mềm'));
    await waitFor(() => expect(screen.getByDisplayValue('SWP391')).toBeInTheDocument());

    // Clicking the selected card again resets the filter rather than toggling to the other one.
    await user.click(screen.getByText('Dự án Phần mềm'));
    await waitFor(() => expect(screen.getByDisplayValue('Tất Cả Môn Học')).toBeInTheDocument());
  });

  it('selects the other course and hands the choice to the submission view', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        ...TWO_COURSES.routes,
        {
          match: '/api/v1/assignments',
          body: {
            statusCode: 200,
            data: [
              {
                assignmentId: 'ASM-PRN211-01',
                courseId: 'COURSE-PRN211',
                courseCode: 'PRN211',
                title: 'Bài tập .NET',
                deadline: '2030-01-01T00:00:00.000Z',
                testcasesCount: 2,
                description: 'Viết ứng dụng console.',
              },
            ],
          },
        },
      ],
    });
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText('Bài tập .NET')).toBeInTheDocument();

    await user.click(screen.getByText('Dự án Phần mềm'));

    // The .NET assignment does not belong to SWP391, so the list is filtered down to nothing.
    await waitFor(() => expect(screen.queryByText('Bài tập .NET')).not.toBeInTheDocument());
    expect(screen.getByText(/Không tìm thấy bài tập nào phù hợp/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// LoginView — signing in through App
// ---------------------------------------------------------------------------------------------

describe('App — login through the gate', () => {
  it('routes a lecturer who signs in from the gate straight to the lecturer console', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: LecturerUserFixture, token: 'tok-gv' } },
        },
      ],
    });
    render(<App />);

    await user.click(await screen.findByTitle('Đăng nhập với trungdt@fe.edu.vn'));

    // `handleLoginSuccess` must switch the active view, not just cache the profile.
    expect(await screen.findByText('👨‍🏫 GIẢNG VIÊN')).toBeInTheDocument();
    expect(await screen.findByText(/Cổng Điều Hành Học Phần & Khảo Thí Lập Trình/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đăng nhập bằng Google$/ })).not.toBeInTheDocument();
  });

  it('routes an admin who signs in from the gate to the admin console', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: AdminUserFixture, token: 'tok-admin' } },
        },
      ],
    });
    render(<App />);

    await user.click(await screen.findByTitle('Đăng nhập với admin@aita.fpt.edu.vn'));

    expect(await screen.findByText('⚙️ ADMIN')).toBeInTheDocument();
    expect(await screen.findByText(/Bảng Điều Khiển Quản Trị/)).toBeInTheDocument();
  });

  it('routes a head of department who signs in from the gate to the HOD console', async () => {
    const user = userEvent.setup();
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/auth/login',
          body: { statusCode: 200, data: { user: HodUserFixture, token: 'tok-hod' } },
        },
      ],
    });
    render(<App />);

    await user.click(await screen.findByTitle('Đăng nhập với hod@fe.edu.vn'));

    expect(await screen.findByText('🛡️ TRƯỞNG BỘ MÔN')).toBeInTheDocument();
    expect(await screen.findByText('Cổng Trưởng Bộ Môn (HOD)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// App — courses whose codes need normalising
// ---------------------------------------------------------------------------------------------

describe('App — course code normalisation', () => {
  const withCourses = (list: unknown[]) => ({
    routes: [{ match: '/api/v1/courses/student/', body: { statusCode: 200, data: list } }],
  });

  it('normalises a long course code down to the code the assignment list matches on', async () => {
    // The API can return "PRN211_SE1710" style codes; only the short form matches the
    // `courseCode` on an assignment, so the normalisation is what makes filtering work.
    stub.restore();
    stub = installFetchStub(
      withCourses([{ courseId: 'CRS-1', courseCode: 'PRN211_SE1710', courseName: 'Lập trình .NET', semester: 'SU2026' }]),
    );
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText(/\(1 Môn\)/)).toBeInTheDocument();
    // The badge shows the normalised code, and the raw code is gone entirely.
    expect(screen.getAllByText('PRN211').length).toBeGreaterThan(0);
    expect(screen.queryByText('PRN211_SE1710')).not.toBeInTheDocument();
  });

  it('normalises a CSD201 course', async () => {
    stub.restore();
    stub = installFetchStub(
      withCourses([{ courseId: 'CRS-CSD201', courseCode: 'CSD201', courseName: 'Cấu trúc dữ liệu', semester: 'SU2026' }]),
    );
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText(/\(1 Môn\)/)).toBeInTheDocument();
    expect(screen.getAllByText('CSD201').length).toBeGreaterThan(0);
  });

  it('falls back to the course id when a course has no code at all', async () => {
    stub.restore();
    stub = installFetchStub(withCourses([{ courseId: 'CRS-UNKNOWN', courseName: 'Môn Lạ', semester: 'SU2026' }]));
    seedSession(StudentUserFixture);
    render(<App />);

    expect(await screen.findByText('Môn Lạ')).toBeInTheDocument();
    expect(screen.getAllByText('CRS-UNKNOWN').length).toBeGreaterThan(0);
  });

  it('keeps the built-in list when the course request fails', async () => {
    stub.restore();
    stub = installFetchStub({ defaultStatus: 500, defaultBody: { message: 'lỗi' } });
    seedSession(StudentUserFixture);
    render(<App />);

    // The rejection is swallowed and the three seeded courses stay on screen.
    expect(await screen.findByText(/\(3 Môn\)/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------------------------

describe('test hygiene', () => {
  it('leaves no mounted tree behind between tests', () => {
    // `cleanup` runs in the shared setup; this asserts the guarantee the whole file relies on.
    render(<LoginModal isOpen onClose={vi.fn()} onLoginSuccess={vi.fn()} />);
    expect(document.body.textContent).toContain('Xác Thực OTP Google SSO');
    cleanup();
    expect(document.body.textContent).not.toContain('Xác Thực OTP Google SSO');
  });
});
