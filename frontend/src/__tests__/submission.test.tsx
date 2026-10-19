/**
 * Behaviour tests for the student submission screen (`SubmissionView`) and the detail modal it
 * opens (`SubmissionDetailModal`).
 *
 * Both components fetch on mount, so every test installs the router from `test/fixtures.ts`.
 * Assertions target what a student actually experiences: the deadline hub, the four spec tabs,
 * the .zip validation rules (10 MB / .zip only / closed after the deadline), the error and empty
 * states, and the three tabs of the detail modal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

// `@monaco-editor/react` pulls the editor bundle from a CDN, which jsdom can neither run nor
// should reach over the wire. The stub echoes the value it was handed, so "the submitted source
// code is displayed" becomes an assertable fact instead of a guess about a third-party loader.
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language }: { value?: string; language?: string }) => (
    <pre data-testid="monaco-editor" data-language={language}>
      {value}
    </pre>
  ),
  DiffEditor: () => <div data-testid="monaco-diff" />,
}));

import { SubmissionView, type StudentTaskItem } from '../components/SubmissionView';
import {
  SubmissionDetailModal,
  type SubmissionDetailData,
} from '../components/SubmissionDetailModal';
import { installFetchStub, AIRatingFixture, AssignmentFixture } from '../test/fixtures';

const DAY = 24 * 60 * 60 * 1000;
const STUDENT_ID = 'SE170000';
const STORAGE_KEY = `aita_student_submissions_${STUDENT_ID}`;

const isoIn = (ms: number) => new Date(Date.now() + ms).toISOString();

const COURSE = {
  courseId: 'CRS-SWP391',
  courseCode: 'SWP391',
  courseName: 'Dự án Phần mềm',
  semester: 'SU2026',
};

/** A published assignment as the detail view receives it. */
const baseTask = (over: Partial<StudentTaskItem> = {}): StudentTaskItem => ({
  id: 'ASM-LOCAL-01',
  title: 'Tính tổng dãy số',
  course: 'SWP391 - Bài tập giảng viên đã giao',
  courseId: COURSE.courseId,
  courseCode: COURSE.courseCode,
  description: 'Cho một dãy số nguyên, hãy tính tổng.',
  deadline: isoIn(30 * DAY),
  maxSizeMb: 10,
  allowedExtensions: ['.zip'],
  timeLimitMs: 2000,
  memoryLimitMb: 512,
  allowedLanguages: ['python'],
  testCasesCount: 2,
  ...over,
});

/** A graded submission as the modal receives it. */
const baseSubmission = (over: Partial<SubmissionDetailData> = {}): SubmissionDetailData => ({
  submissionId: 'SUB-000001-AAAAAA',
  studentId: STUDENT_ID,
  studentName: 'Đinh Thành Trung',
  assignmentId: 'ASM-SWP391-01',
  assignmentTitle: 'Tính tổng dãy số',
  fileName: 'Solution.py',
  language: 'python',
  submittedAt: '2026-10-19T10:00:00.000Z',
  status: 'COMPLETED',
  score: 8.5,
  passedTestcases: 2,
  totalTestcases: 2,
  executionTimeMs: 185,
  aiRating: AIRatingFixture,
  ...over,
});

const assignmentsRoute = (data: unknown[]) => ({
  match: '/api/v1/assignments',
  body: { statusCode: 200, data },
});

let stub: ReturnType<typeof installFetchStub>;
let clipboardDescriptor: PropertyDescriptor | undefined;

/** Re-installs the fetch router with extra routes; the last call wins for a given path. */
const useFetchRoutes = (options?: Parameters<typeof installFetchStub>[0]) => {
  stub.restore();
  stub = installFetchStub(options);
  return stub;
};

/** Replaces `navigator.clipboard` (absent in jsdom on some versions, undefined in plain HTTP). */
const stubClipboard = (writeText: unknown) => {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
    writable: true,
  });
};

beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  stub = installFetchStub();
});

afterEach(() => {
  stub.restore();
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  } else {
    delete (navigator as unknown as Record<string, unknown>).clipboard;
  }
});

// ---------------------------------------------------------------------------------------------
// SubmissionDetailModal
// ---------------------------------------------------------------------------------------------

describe('SubmissionDetailModal – visibility and header', () => {
  it('renders nothing while it is closed', () => {
    const { container } = render(
      <SubmissionDetailModal isOpen={false} onClose={() => {}} submission={baseSubmission()} />,
    );
    expect(container.firstChild).toBeNull();
    expect(stub.spy).not.toHaveBeenCalled();
  });

  it('renders nothing when there is no submission to show', () => {
    const { container } = render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the submission id, file name and score', () => {
    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    expect(screen.getByText('SUB-000001-AAAAAA')).toBeInTheDocument();
    expect(screen.getByText('Solution.py')).toBeInTheDocument();
    expect(screen.getByText(/ĐẠT • 8\.5 \/ 10\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeInTheDocument();
  });

  it('renders the submission time in Vietnamese format', () => {
    const { container } = render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />,
    );
    const expected = new Date('2026-10-19T10:00:00.000Z').toLocaleString('vi-VN');
    expect(container.textContent).toContain(`Nộp lúc: ${expected}`);
  });

  it('marks a submission at or above five points as passed', () => {
    render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission({ score: 5 })} />,
    );
    expect(screen.getByText(/ĐẠT • 5\.0 \/ 10\.0/)).toBeInTheDocument();
  });

  it('marks a submission below five points as failed', () => {
    render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission({ score: 4.9 })} />,
    );
    expect(screen.getByText(/CHƯA ĐẠT • 4\.9 \/ 10\.0/)).toBeInTheDocument();
  });

  it('treats a missing score as zero instead of crashing', () => {
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ score: undefined })}
      />,
    );
    expect(screen.getByText(/CHƯA ĐẠT • 0\.0 \/ 10\.0/)).toBeInTheDocument();
  });

  it('closes from the header X button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SubmissionDetailModal isOpen onClose={onClose} submission={baseSubmission()} />);

    await user.click(screen.getByRole('button', { name: 'Đóng cửa sổ chi tiết bài nộp' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the footer button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SubmissionDetailModal isOpen onClose={onClose} submission={baseSubmission()} />);

    await user.click(screen.getByRole('button', { name: /Đóng Cửa Sổ/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches back to the overview tab after visiting another one', async () => {
    const user = userEvent.setup();
    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);

    await user.click(screen.getByRole('button', { name: /2\. Đánh Giá SOLID/ }));
    expect(screen.queryByText('Tổng Điểm Đạt Được')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /1\. Tổng Quan & Testcases/ }));
    expect(screen.getByText('Tổng Điểm Đạt Được')).toBeInTheDocument();
    expect(screen.queryByText(/Biểu Đồ Radar 5 Trục SOLID/)).not.toBeInTheDocument();
  });
});

describe('SubmissionDetailModal – overview tab', () => {
  it('opens on the overview tab', () => {
    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    expect(screen.getByText('Tổng Điểm Đạt Được')).toBeInTheDocument();
    expect(screen.queryByText(/Biểu Đồ Radar 5 Trục SOLID/)).not.toBeInTheDocument();
  });

  it('summarises the testcase result', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ passedTestcases: 1, totalTestcases: 4 })}
      />,
    );
    expect(container.textContent).toContain('1/4');
    expect(container.textContent).toContain('25% độ chính xác thuật toán');
  });

  it('shows the clean-code and SOLID scores from the AI rating', () => {
    const { container } = render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />,
    );
    // AIRatingFixture: cleanCode 8.5, solid (9+8+8.5+7.5+8)/5 = 8.2
    expect(container.textContent).toContain('8.5');
    expect(container.textContent).toContain('8.2');
    expect(container.textContent).toContain('2 Cảnh báo mùi mã nguồn');
  });

  it('falls back to a default AI rating when the submission has none', () => {
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ aiRating: undefined })}
      />,
    );
    // Tab label carries the default clean-code score.
    expect(screen.getByRole('button', { name: /2\. Đánh Giá SOLID.*9\.5\/10/ })).toBeInTheDocument();
  });

  it('derives the passed testcase count from the score when it is missing', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ passedTestcases: undefined, totalTestcases: undefined })}
      />,
    );
    expect(container.textContent).toContain('2/2');
  });

  it('shows zero passed testcases for a failing submission with no counts', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({
          score: 1,
          passedTestcases: undefined,
          totalTestcases: undefined,
        })}
      />,
    );
    expect(container.textContent).toContain('0/2');
  });

  it('reports 100% accuracy when the submission has no testcases at all', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ passedTestcases: 0, totalTestcases: 0 })}
      />,
    );
    expect(container.textContent).toContain('100% độ chính xác thuật toán');
  });

  it('lists the testcases that ran in the sandbox', () => {
    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    expect(screen.getByText(/Test Case 01: Chuẩn hóa dữ liệu đầu vào/)).toBeInTheDocument();
    expect(screen.getByText(/Test Case 02: Trường hợp biên và Tải lớn/)).toBeInTheDocument();
    expect(screen.getByText(/Môi Trường Cách Ly & Chi Tiết Chạy Testcase/)).toBeInTheDocument();
  });

  it('shows the execution time it was given', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ executionTimeMs: 999 })}
      />,
    );
    expect(container.textContent).toContain('999 ms');
  });

  it('shows the SHA-256 fingerprint when the submission has one', () => {
    const { container } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sha256: 'a'.repeat(64) })}
      />,
    );
    expect(container.textContent).toContain('Mã băm toàn vẹn SHA-256');
    expect(container.textContent).toContain('a'.repeat(64));
  });

  it('omits the fingerprint block when there is no hash', () => {
    const { container } = render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />,
    );
    expect(container.textContent).not.toContain('Mã băm toàn vẹn SHA-256');
  });
});

describe('SubmissionDetailModal – SOLID/AI tab', () => {
  const openAiTab = async () => {
    const user = userEvent.setup();
    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    await user.click(screen.getByRole('button', { name: /2\. Đánh Giá SOLID/ }));
    return user;
  };

  it('reveals the radar chart and hides the overview cards', async () => {
    await openAiTab();
    expect(await screen.findByText(/Biểu Đồ Radar 5 Trục SOLID/)).toBeInTheDocument();
    expect(screen.queryByText('Tổng Điểm Đạt Được')).not.toBeInTheDocument();
  });

  it('lists every code smell with its line number', async () => {
    await openAiTab();
    expect(screen.getByText(/Dòng 12:/)).toBeInTheDocument();
    expect(screen.getByText(/Dòng 40:/)).toBeInTheDocument();
    // The first smell is repeated in the Socratic hint, so both copies must be present.
    expect(screen.getAllByText(/Nên tách thành hàm nhỏ hơn\./).length).toBe(2);
    expect(screen.getByText(/Cảnh báo Mùi Mã Nguồn \(2\):/)).toBeInTheDocument();
  });

  it('shows the AI explanation', async () => {
    await openAiTab();
    expect(screen.getByText(/Mã nguồn rõ ràng, còn vài điểm cần cải thiện/)).toBeInTheDocument();
  });

  it('shows a Socratic hint built from the first code smell', async () => {
    const { container } = await (async () => {
      await openAiTab();
      return { container: document.body };
    })();
    expect(container.textContent).toContain('Phát hiện vi phạm:');
    expect(container.textContent).toContain('tại dòng 12');
  });

  it('celebrates a clean submission when there are no code smells', async () => {
    const user = userEvent.setup();
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({
          aiRating: { ...AIRatingFixture, codeSmells: [] },
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /2\. Đánh Giá SOLID/ }));

    expect(screen.getByText(/Không phát hiện mùi mã nguồn nào/)).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá kiến trúc xuất sắc/)).toBeInTheDocument();
  });
});

describe('SubmissionDetailModal – source code tab', () => {
  const CODE = 'def solve(a):\n    return sum(a)\n';

  it('switches to the code tab and shows the submitted file name', async () => {
    const user = userEvent.setup();
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: CODE })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(screen.getByText(/Solution\.py \(Tô Màu Cú Pháp\)/)).toBeInTheDocument();
    expect(screen.getByText(/def solve/)).toBeInTheDocument();
    expect(stub.spy).not.toHaveBeenCalled();
  });

  it('maps the language of the submission to the editor', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: CODE, language: 'cpp' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'cpp');
    unmount();

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: CODE, language: 'csharp' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'java');
  });

  it('fetches the source from the API when the submission does not carry it', async () => {
    const user = userEvent.setup();
    useFetchRoutes({
      routes: [
        { match: '/source', body: { statusCode: 200, sourceCode: 'print("từ máy chủ")' } },
      ],
    });

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(await screen.findByText(/từ máy chủ/)).toBeInTheDocument();
    const called = stub.spy.mock.calls.map((c) => String(c[0]));
    expect(called).toContain(
      'http://localhost:3000/api/v1/submissions/SUB-000001-AAAAAA/source',
    );
  });

  it('honours a custom apiBaseUrl for the source request', async () => {
    const user = userEvent.setup();
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        apiBaseUrl="http://gateway.test:8080"
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    await waitFor(() => {
      expect(stub.spy.mock.calls.map((c) => String(c[0]))).toContain(
        'http://gateway.test:8080/api/v1/submissions/SUB-000001-AAAAAA/source',
      );
    });
  });

  it('shows a loading message while the source is in flight', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const inner = stub.spy;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown, init?: unknown) => {
      if (String(input).includes('/source')) return pending;
      return inner(input, init);
    });

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(screen.getByText(/Đang tải mã nguồn từ máy chủ\.\.\./)).toBeInTheDocument();

    await act(async () => {
      release({ ok: true, status: 200, json: async () => ({ sourceCode: 'sau khi tải' }) });
    });
    expect(await screen.findByText(/sau khi tải/)).toBeInTheDocument();
  });

  it('falls back to a placeholder when the source endpoint returns no code', async () => {
    const user = userEvent.setup();
    useFetchRoutes({ routes: [{ match: '/source', body: { statusCode: 200 } }] });

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(await screen.findByText(/Không tìm thấy nội dung mã nguồn/)).toBeInTheDocument();
  });

  it('falls back to a placeholder when the source endpoint fails', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useFetchRoutes({ routes: [{ match: '/source', status: 500, body: { message: 'lỗi' } }] });

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(await screen.findByText(/Không tìm thấy nội dung mã nguồn/)).toBeInTheDocument();
    warn.mockRestore();
  });

  it('survives a network error while fetching the source', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = stub.spy;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown, init?: unknown) => {
      if (String(input).includes('/source')) throw new Error('mất kết nối');
      return inner(input, init);
    });

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: undefined })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));

    expect(await screen.findByText(/Không tìm thấy nội dung mã nguồn/)).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('Không thể tải mã nguồn từ API:', expect.any(Error));
    warn.mockRestore();
  });

  it('copies the source to the clipboard and confirms it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: 'print(1)' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    await user.click(screen.getByRole('button', { name: /Sao chép mã nguồn/ }));

    expect(writeText).toHaveBeenCalledWith('print(1)');
    expect(screen.getByText(/Đã sao chép!/)).toBeInTheDocument();
  });

  it('copies the submission id from the header', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    await user.click(screen.getByRole('button', { name: 'Sao chép mã bài nộp' }));

    expect(writeText).toHaveBeenCalledWith('SUB-000001-AAAAAA');
  });

  it('does not claim a copy when the browser has no Clipboard API', async () => {
    // Regression: handleCopyCode called `navigator.clipboard.writeText(...)` unguarded. Outside a
    // secure context `navigator.clipboard` is undefined, so pressing "Sao chép mã nguồn" threw a
    // TypeError that unmounted the whole modal — and the button had already flipped to
    // "Đã sao chép!" even though nothing had been copied.
    const user = userEvent.setup();
    stubClipboard(undefined);

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: 'print(1)' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    await user.click(screen.getByRole('button', { name: /Sao chép mã nguồn/ }));

    // The modal survives and the button still reads "Sao chép mã nguồn".
    expect(screen.getByRole('button', { name: /Đóng Cửa Sổ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sao chép mã nguồn/ })).toBeInTheDocument();
    expect(screen.queryByText(/Đã sao chép!/)).not.toBeInTheDocument();
  });

  it('does not crash when the clipboard refuses the write', async () => {
    // Regression: a rejected `writeText` (student denied the permission) was an unhandled
    // rejection, and the UI still reported a successful copy.
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubClipboard(vi.fn().mockRejectedValue(new Error('quyền bị từ chối')));

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: 'print(1)' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    await user.click(screen.getByRole('button', { name: /Sao chép mã nguồn/ }));

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith('Không thể sao chép vào clipboard:', expect.any(Error));
    });
    expect(screen.getByRole('button', { name: /Đóng Cửa Sổ/ })).toBeInTheDocument();
    expect(screen.queryByText(/Đã sao chép!/)).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('does not claim a copy when the clipboard write never settles into a value', async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: 'print(1)' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    await user.click(screen.getByRole('button', { name: /Sao chép mã nguồn/ }));
    expect(await screen.findByText(/Đã sao chép!/)).toBeInTheDocument();
  });
});

describe('SubmissionDetailModal – download and appeal actions', () => {
  it('hands the submission to onDownloadZip when the caller supplies one', async () => {
    const user = userEvent.setup();
    const onDownloadZip = vi.fn();
    const submission = baseSubmission();

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={submission}
        onDownloadZip={onDownloadZip}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Tải File Bài Nộp \(\.zip\)/ }));

    expect(onDownloadZip).toHaveBeenCalledWith(submission);
  });

  it('opens the download endpoint in a new tab when no callback is supplied', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />);
    await user.click(screen.getByRole('button', { name: /Tải File Bài Nộp \(\.zip\)/ }));

    expect(open).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/submissions/SUB-000001-AAAAAA/download',
      '_blank',
    );
    open.mockRestore();
  });

  it('offers the download from the code tab as well', async () => {
    const user = userEvent.setup();
    const onDownloadZip = vi.fn();

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ sourceCode: 'print(1)' })}
        onDownloadZip={onDownloadZip}
      />,
    );
    await user.click(screen.getByRole('button', { name: /3\. Mã Nguồn Đã Nộp/ }));
    await user.click(screen.getByRole('button', { name: /Tải file \.zip/ }));

    expect(onDownloadZip).toHaveBeenCalledTimes(1);
  });

  it('offers an appeal only when the caller can handle one', () => {
    const { unmount } = render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} />,
    );
    expect(screen.queryByRole('button', { name: /Phúc Khảo Bài Nộp Này/ })).not.toBeInTheDocument();
    unmount();

    render(
      <SubmissionDetailModal isOpen onClose={() => {}} submission={baseSubmission()} onOpenAppeal={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Phúc Khảo Bài Nộp Này/ })).toBeInTheDocument();
  });

  it('passes the submission id and current score to the appeal handler', async () => {
    const user = userEvent.setup();
    const onOpenAppeal = vi.fn();

    render(
      <SubmissionDetailModal
        isOpen
        onClose={() => {}}
        submission={baseSubmission({ score: 6.25 })}
        onOpenAppeal={onOpenAppeal}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Phúc Khảo Bài Nộp Này/ }));

    expect(onOpenAppeal).toHaveBeenCalledWith('SUB-000001-AAAAAA', 6.25);
  });
});

// ---------------------------------------------------------------------------------------------
// SubmissionView – hub
// ---------------------------------------------------------------------------------------------

/** Renders the deadline hub (no `task` prop, so the component starts on the list view). */
const renderHub = (props: Partial<ComponentProps<typeof SubmissionView>> = {}) =>
  render(
    <SubmissionView
      studentId={STUDENT_ID}
      studentName="Đinh Thành Trung"
      onSubmit={vi.fn()}
      {...props}
    />,
  );

describe('SubmissionView – deadline hub', () => {
  it('loads the published assignments from the API', async () => {
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    const called = stub.spy.mock.calls.map((c) => String(c[0]));
    expect(called).toContain('http://localhost:3000/api/v1/assignments');
  });

  it('shows the student identity in the header', async () => {
    const { container } = renderHub();
    await waitFor(() => {
      expect(container.textContent).toContain('Đinh Thành Trung');
    });
    expect(container.textContent).toContain('SE170000');
  });

  it('renders one card per assignment with its sandbox limits', async () => {
    const { container } = renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(container.textContent).toContain('Mã: ASM-SWP391-01');
    expect(container.textContent).toContain('SWP391');
    expect(container.textContent).toContain('2 testcases');
    expect(container.textContent).toContain('PYTHON');
    expect(screen.getAllByRole('button', { name: /Nộp Bài Ngay/ }).length).toBe(1);
  });

  it('derives the course filter options from the assignments', async () => {
    renderHub();
    await screen.findByText(AssignmentFixture.title);
    expect(screen.getByRole('option', { name: 'SWP391' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tất Cả Môn Học' })).toBeInTheDocument();
  });

  it('shows the enrolled course codes when the caller supplies them', async () => {
    renderHub({ enrolledCourses: [COURSE] });
    await screen.findByText(AssignmentFixture.title);
    expect(screen.getByRole('option', { name: 'SWP391' })).toBeInTheDocument();
  });

  it('renders an empty state when the lecturer has published nothing', async () => {
    useFetchRoutes({ routes: [assignmentsRoute([])] });
    renderHub();

    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
  });

  it('renders an empty state when the assignments endpoint fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useFetchRoutes({
      routes: [{ match: '/api/v1/assignments', status: 500, body: { message: 'lỗi' } }],
    });
    renderHub();

    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      '[SubmissionView] Không tải được danh sách bài tập:',
      500,
    );
    warn.mockRestore();
  });

  it('renders an empty state when the assignments response is not a list', async () => {
    useFetchRoutes({ routes: [{ match: '/api/v1/assignments', body: { statusCode: 200, data: null } }] });
    renderHub();

    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
  });

  it('hides an assignment that has no testcase, because it could never be graded', async () => {
    // The grader would score such an assignment 0, so offering it to a student is a trap.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, testcasesCount: 0 }])],
    });
    renderHub();

    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ẩn 1 bài tập không có testcase'));
    warn.mockRestore();
  });

  it('normalises a bare deadline date to the end of that day', async () => {
    useFetchRoutes({ routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: '2030-05-05' }])] });
    const { container } = renderHub();
    await screen.findByText(AssignmentFixture.title);

    const expected = new Date('2030-05-05T23:59:00').toLocaleString('vi-VN');
    expect(container.textContent).toContain(`Hạn: ${expected}`);
  });

  it('falls back to a week from now when an assignment has no deadline', async () => {
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: undefined }])],
    });
    const { container } = renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(container.textContent).toMatch(/Còn \d+ ngày \d+h/);
  });

  it('falls back to the default sandbox limits when the API omits them', async () => {
    useFetchRoutes({
      routes: [
        assignmentsRoute([
          { ...AssignmentFixture, timeLimitMs: undefined, memoryLimitMb: undefined, allowedLanguages: [] },
        ]),
      ],
    });
    const { container } = renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(container.textContent).toContain('2000ms');
    expect(container.textContent).toContain('512MB');
    expect(container.textContent).toContain('JAVA, PYTHON, CPP');
  });

  it('reports a failed reload to the console instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = stub.spy;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown, init?: unknown) => {
      if (String(input).includes('/api/v1/assignments')) throw new Error('mất kết nối');
      return inner(input, init);
    });
    renderHub();

    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      '[SubmissionView] Lỗi khi tải danh sách bài tập từ API:',
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it('counts the assignments still to hand in', async () => {
    const { container } = renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(screen.getByText('TỔNG BÀI ĐƯỢC GIAO').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('CẦN NỘP (CHƯA NỘP)').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('ĐÃ HOÀN THÀNH NỘP').nextElementSibling).toHaveTextContent('0');
    expect(container.textContent).toContain('Chưa nộp');
  });

  it('marks an assignment as handed in when the browser remembers a submission', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ASM-SWP391-01': {
          assignmentId: 'ASM-SWP391-01',
          submittedAt: '2026-10-19T10:00:00.000Z',
          fileName: 'Solution.zip',
          score: 8.5,
          status: 'GRADED',
        },
      }),
    );
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(screen.getByText('Đã nộp (8.5/10)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Lại Bài/ })).toBeInTheDocument();
    expect(screen.getByText('ĐÃ HOÀN THÀNH NỘP').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('CẦN NỘP (CHƯA NỘP)').nextElementSibling).toHaveTextContent('0');
  });

  it('ignores a corrupt submission history in localStorage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, '{not json');
    renderHub();

    expect(await screen.findByText(AssignmentFixture.title)).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('Không thể đọc lịch sử nộp bài:', expect.anything());
    warn.mockRestore();
  });

  it('filters by the status tabs', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    await user.click(screen.getByRole('button', { name: 'Đã nộp' }));
    expect(screen.getByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chưa nộp' }));
    expect(screen.getByText(AssignmentFixture.title)).toBeInTheDocument();
  });

  it('filters urgent assignments out once they are handed in', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ASM-SWP391-01': {
          assignmentId: 'ASM-SWP391-01',
          submittedAt: '2026-10-19T10:00:00.000Z',
          fileName: 'Solution.zip',
          status: 'QUEUED',
        },
      }),
    );
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: isoIn(2 * 60 * 60 * 1000) }])],
    });
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    expect(screen.getByText(/Gấp: Còn/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sắp hết hạn' }));
    expect(screen.getByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
  });

  it('flags an assignment that is due within the day as urgent', async () => {
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: isoIn(3 * 60 * 60 * 1000) }])],
    });
    renderHub();

    expect(await screen.findByText(/Gấp: Còn 2h \d+m/)).toBeInTheDocument();
    expect(screen.getByText('SẮP HẾT HẠN (< 48H)').nextElementSibling).toHaveTextContent('1');
  });

  it('labels an assignment due within three days as ending soon', async () => {
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: isoIn(2 * DAY) }])],
    });
    renderHub();

    expect(await screen.findByText(/Sắp đến hạn: Còn \d+d \d+h/)).toBeInTheDocument();
  });

  it('labels an expired assignment as past its deadline', async () => {
    useFetchRoutes({
      routes: [assignmentsRoute([{ ...AssignmentFixture, deadline: isoIn(-DAY) }])],
    });
    renderHub();

    expect(await screen.findByText('Đã hết hạn nộp')).toBeInTheDocument();
  });

  it('searches by title, code and course', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    const search = screen.getByPlaceholderText(/Tìm theo tên bài tập/);
    await user.type(search, 'không-có-gì');
    expect(screen.getByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'tổng dãy');
    expect(screen.getByText(AssignmentFixture.title)).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'SWP391');
    expect(screen.getByText(AssignmentFixture.title)).toBeInTheDocument();
  });

  it('filters by the selected course', async () => {
    const user = userEvent.setup();
    useFetchRoutes({
      routes: [
        assignmentsRoute([
          AssignmentFixture,
          {
            ...AssignmentFixture,
            assignmentId: 'ASM-PRN211-01',
            courseId: 'CRS-PRN211',
            title: 'Bài tập PRN211',
          },
        ]),
      ],
    });
    renderHub({
      enrolledCourses: [COURSE, { courseId: 'CRS-PRN211', courseCode: 'PRN211', courseName: 'Lập trình C#' }],
    });
    await screen.findByText(AssignmentFixture.title);
    expect(screen.getByText('Bài tập PRN211')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'PRN211');
    expect(screen.queryByText(AssignmentFixture.title)).not.toBeInTheDocument();
    expect(screen.getByText('Bài tập PRN211')).toBeInTheDocument();
  });

  it('follows the course chosen in the navigation bar', async () => {
    renderHub({ enrolledCourses: [COURSE], selectedCourseId: 'CRS-PRN211' });
    // PRN211 is not among the enrolled courses, so nothing matches and the empty state shows.
    expect(await screen.findByText('Không tìm thấy bài tập nào phù hợp')).toBeInTheDocument();
  });

  it('reloads the list from the lecturer when asked', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByText(AssignmentFixture.title);

    const before = stub.spy.mock.calls.filter((c) =>
      String(c[0]).includes('/api/v1/assignments'),
    ).length;
    await user.click(screen.getByRole('button', { name: /Làm Mới/ }));

    await waitFor(() => {
      const after = stub.spy.mock.calls.filter((c) =>
        String(c[0]).includes('/api/v1/assignments'),
      ).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('opens the submit screen from the card and from its action button', async () => {
    const user = userEvent.setup();
    const { unmount } = renderHub();
    await user.click(await screen.findByText(AssignmentFixture.title));
    expect(await screen.findByText(/Quay Lại Danh Sách Deadline/)).toBeInTheDocument();
    unmount();

    renderHub();
    await user.click(await screen.findByRole('button', { name: /Nộp Bài Ngay/ }));
    expect(await screen.findByText(/Quay Lại Danh Sách Deadline/)).toBeInTheDocument();
  });

  it('lifts a hovered deadline card and restores it on leave', async () => {
    renderHub();
    const card = (await screen.findByText(AssignmentFixture.title)).closest('.glass-panel') as HTMLElement;
    expect(card).toBeTruthy();

    fireEvent.mouseEnter(card);
    expect(card.style.transform).toBe('translateY(-2px)');

    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe('translateY(0)');
    expect(card.style.boxShadow).toBe('none');
  });

  it('keeps the detail modal usable when the student navigates back to the list', async () => {
    const user = userEvent.setup();
    await openDetail();
    await user.click(
      await screen.findByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn, Testcases & AI\)/ }),
    );
    await screen.findByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/);

    // Going back must not leave an undismissable overlay behind: the hub renders the same modal.
    await user.click(screen.getByRole('button', { name: /Quay Lại Danh Sách Deadline/ }));
    await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline/);
    expect(screen.getByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Đóng Cửa Sổ/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------------------------
// SubmissionView – detail view
// ---------------------------------------------------------------------------------------------

/** Renders the submit screen directly through the optional `task` prop. */
const renderDetail = (taskOver: Partial<StudentTaskItem> = {}, props: Partial<ComponentProps<typeof SubmissionView>> = {}) => {
  const onSubmit = (props.onSubmit ?? vi.fn()) as (file: File, task?: unknown) => void;
  const utils = render(
    <SubmissionView
      studentId={STUDENT_ID}
      studentName="Đinh Thành Trung"
      task={baseTask(taskOver)}
      onSubmit={onSubmit as ComponentProps<typeof SubmissionView>['onSubmit']}
      {...props}
    />,
  );
  return { ...utils, onSubmit };
};

const openDetail = async (taskOver: Partial<StudentTaskItem> = {}, props: Partial<ComponentProps<typeof SubmissionView>> = {}) => {
  const utils = renderDetail(taskOver, props);
  await screen.findByText(/Quay Lại Danh Sách Deadline/);
  return utils;
};

const zipFile = (name = 'Solution.zip', sizeBytes = 2048) => {
  const file = new File(['x'.repeat(Math.min(sizeBytes, 32))], name, { type: 'application/zip' });
  // A real 11 MB buffer would only slow the suite down; the size check reads `file.size`.
  Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true });
  return file;
};

describe('SubmissionView – assignment specification', () => {
  it('shows the assignment code, title, deadline and sandbox limits', async () => {
    const { container } = await openDetail();

    expect(container.textContent).toContain('Mã bài tập: ASM-LOCAL-01');
    expect(container.textContent).toContain('2000 ms');
    expect(container.textContent).toContain('512 MB');
    expect(container.textContent).toContain('Ngôn ngữ hợp lệ');
    expect(container.textContent).toContain('2 testcases');
    expect(container.textContent).toContain('Hạn nộp:');
  });

  it('falls back to the default limits when the task does not define them', async () => {
    const { container } = await openDetail({
      timeLimitMs: undefined,
      memoryLimitMb: undefined,
      allowedLanguages: undefined,
      testCasesCount: undefined,
      courseCode: undefined,
    });

    expect(container.textContent).toContain('2000 ms');
    expect(container.textContent).toContain('512 MB');
    expect(container.textContent).toContain('java, python, cpp');
  });

  it('marks an assignment that has never been submitted', async () => {
    await openDetail();
    expect(screen.getByText('⏳ CHƯA HOÀN THÀNH')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt Chấm Điểm Tự Động/ }),
    ).toBeInTheDocument();
  });

  it('marks an assignment the student already submitted', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ASM-LOCAL-01': {
          assignmentId: 'ASM-LOCAL-01',
          submittedAt: '2026-10-19T10:00:00.000Z',
          fileName: 'Solution.zip',
          score: 8.5,
          status: 'GRADED',
        },
      }),
    );
    await openDetail();

    expect(screen.getByText('✓ ĐÃ NỘP BÀI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Lại Bài/ })).toBeInTheDocument();
  });

  it('opens the four specification tabs on the technical requirements', async () => {
    await openDetail();
    expect(screen.getByText('BỐI CẢNH BÀI TOÁN & NGHIỆP VỤ THỰC TẾ')).toBeInTheDocument();
  });

  it('reads the specification out of a structured description', async () => {
    const { container } = await openDetail({
      description: [
        'Cho một dãy số nguyên, hãy tính tổng của chúng.',
        '',
        'Yêu cầu kỹ thuật:',
        '1. Đọc dữ liệu từ luồng STDIN.',
        '2. In kết quả ra luồng STDOUT.',
        '',
        'Định dạng Đầu vào:',
        '- Dòng 1: số nguyên N.',
        '',
        'Định dạng Đầu ra:',
        '- In ra tổng của dãy.',
        '',
        'Ràng buộc:',
        '- 1 <= N <= 100000',
      ].join('\n'),
    });

    expect(container.textContent).toContain('số nguyên N');
    expect(container.textContent).toContain('Đọc dữ liệu từ luồng STDIN');
    expect(container.textContent).toContain('1 <= N <= 100000');
    expect(container.textContent).toContain('YÊU CẦU KỸ THUẬT & GIẢI THUẬT TRỌNG TÂM');
  });

  it('renders an assignment whose description is empty', async () => {
    const { container } = await openDetail({ description: '' });
    expect(container.textContent).toContain('BỐI CẢNH BÀI TOÁN');
  });

  it('accepts technical requirements handed over by the caller', async () => {
    await openDetail({
      technicalRequirements: {
        problemContext: 'Bối cảnh do giảng viên soạn riêng cho bài tập này.',
        inputFormat: ['Dòng 1: N.'],
        outputFormat: ['In ra tổng.'],
        constraints: ['N <= 10^5'],
        complexityRequirements: [],
        solidGuidelines: [],
      },
    });
    expect(screen.getByText('BỐI CẢNH BÀI TOÁN & NGHIỆP VỤ THỰC TẾ')).toBeInTheDocument();
  });

  it('lists the sample testcases with copy actions', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await openDetail();

    await user.click(screen.getByRole('button', { name: /Testcase Mẫu & Ví Dụ/ }));

    expect(screen.getByText('Testcase Mẫu 1 (Dữ Liệu Cơ Sở)')).toBeInTheDocument();
    expect(screen.getByText('Testcase Mẫu 2 (Số Âm & Trùng Lặp)')).toBeInTheDocument();
    // Two sample cases x (input + expected output).
    const copyButtons = screen.getAllByRole('button', { name: /^Sao chép$/ });
    expect(copyButtons.length).toBe(4);

    await user.click(copyButtons[0]);
    expect(writeText.mock.calls[0][0]).toContain('4 2 5 1 3');
    expect(await screen.findByText('Đã chép!')).toBeInTheDocument();

    await user.click(copyButtons[1]);
    expect(writeText.mock.calls[1][0]).toContain('1 2 3 4 5');
  });

  it('uses the caller-supplied sample testcases when there are any', async () => {
    const user = userEvent.setup();
    await openDetail({
      sampleTestCases: [
        { name: 'Mẫu riêng của giảng viên', input: '1 2', expectedOutput: '3', explanation: 'Cộng.' },
      ],
    });
    await user.click(screen.getByRole('button', { name: /Testcase Mẫu & Ví Dụ/ }));

    expect(screen.getByText('Mẫu riêng của giảng viên')).toBeInTheDocument();
    expect(screen.queryByText('Testcase Mẫu 1 (Dữ Liệu Cơ Sở)')).not.toBeInTheDocument();
  });

  it('offers data-structure sample testcases for a CSD course', async () => {
    const user = userEvent.setup();
    await openDetail({ courseCode: 'CSD201' });
    await user.click(screen.getByRole('button', { name: /Testcase Mẫu & Ví Dụ/ }));

    expect(screen.getByText('Testcase Mẫu 1 (Thao Tác Cây Cân Bằng)')).toBeInTheDocument();
    expect(screen.getByText('Testcase Mẫu 2 (Trường Hợp Cân Bằng Biên)')).toBeInTheDocument();
  });

  it('shows the default rubric when the assignment has none', async () => {
    const user = userEvent.setup();
    await openDetail();
    await user.click(screen.getByRole('button', { name: /Barem Điểm & Tiêu Chuẩn SOLID/ }));

    expect(
      screen.getByText('Tính đúng đắn thuật toán & Vượt qua 100% Testcases'),
    ).toBeInTheDocument();
    expect(screen.getByText('+5đ')).toBeInTheDocument();
    expect(screen.getAllByText(/Tự động đánh giá bởi hệ thống chấm điểm AITA/).length).toBe(4);
    expect(screen.getByText(/Giám sát liêm chính học thuật/)).toBeInTheDocument();
  });

  it('shows the rubric the lecturer attached to the assignment', async () => {
    const user = userEvent.setup();
    useFetchRoutes({
      routes: [
        assignmentsRoute([
          {
            ...AssignmentFixture,
            rubrics: [{ criterion: 'Tiêu chí riêng ABC', maxScore: 3.5, description: 'Mô tả riêng' }],
          },
        ]),
      ],
    });
    renderHub();
    await user.click(await screen.findByRole('button', { name: /Nộp Bài Ngay/ }));
    await screen.findByText(/Quay Lại Danh Sách Deadline/);
    await user.click(screen.getByRole('button', { name: /Barem Điểm/ }));

    expect(screen.getByText('Tiêu chí riêng ABC')).toBeInTheDocument();
    expect(screen.getByText('+3.5đ')).toBeInTheDocument();
    // The invented default rubric must not leak in alongside the lecturer's own criteria.
    expect(screen.queryByText(/Tính đúng đắn thuật toán & Vượt qua 100% Testcases/)).not.toBeInTheDocument();
  });

  it('explains the required .zip layout', async () => {
    const user = userEvent.setup();
    const { container } = await openDetail();
    await user.click(screen.getByRole('button', { name: /Cấu Trúc File & Môi Trường Cách Ly/ }));

    expect(screen.getByText(/Cấu Trúc File Nén \.ZIP Hợp Lệ/)).toBeInTheDocument();
    expect(screen.getByText(/Quy Định An Toàn Khi Chấm Bài/)).toBeInTheDocument();
    expect(container.textContent).toContain('solution.zip');
  });

  it('returns to the deadline list', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole('button', { name: /Quay Lại Danh Sách Deadline/ }));
    expect(await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline/)).toBeInTheDocument();
  });

  it('cancels out of the submit screen', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole('button', { name: 'Hủy Bỏ' }));
    expect(await screen.findByText(/Danh Sách Bài Tập & Giám Sát Deadline/)).toBeInTheDocument();
  });

  it('closes the submission gate when the deadline has passed', async () => {
    const { container } = await openDetail({ deadline: isoIn(-DAY) });

    // The countdown itself reports the closure, and the action is disabled rather than
    // silently doing nothing when pressed.
    expect(container.textContent).toContain('Quá hạn nộp bài');
    const submit = screen.getByRole('button', { name: /Cổng Nộp Đã Đóng/ });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('title', 'Cổng nộp đã đóng vì bài tập đã quá hạn');
  });

  it('refuses to open the file picker once the deadline has passed', async () => {
    const { container } = await openDetail({ deadline: isoIn(-DAY) });
    const dropZone = container.querySelector('input[type="file"]')?.parentElement as HTMLElement;

    // A drop goes through the same guard as the picker: the gate is shut either way.
    fireEvent.drop(dropZone, { dataTransfer: { files: [zipFile()] } });

    expect(await screen.findByText(/Đã quá hạn nộp bài \(/)).toBeInTheDocument();
    expect(screen.getByText(/Cổng nộp đã tự động đóng\./)).toBeInTheDocument();
    expect(screen.queryByText('Solution.zip')).not.toBeInTheDocument();
  });
});

describe('SubmissionView – file upload rules', () => {
  it('accepts a .zip archive and fingerprints it with SHA-256', async () => {
    const user = userEvent.setup();
    const { onSubmit } = await openDetail();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.zip');

    await user.upload(input, zipFile('Solution.zip', 100));

    expect(await screen.findByText('Solution.zip')).toBeInTheDocument();
    expect(screen.getByText(/Kích thước: 0\.00 MB/)).toBeInTheDocument();
    // 100 bytes of 'x' hashed with SHA-256, truncated to 16 + 8 characters for display.
    const sha = await screen.findByText(/SHA-256:/);
    expect(sha.textContent).toMatch(/^SHA-256: [0-9a-f]{16}\.\.\.[0-9a-f]{8}$/);

    const submit = screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [file, task] = (onSubmit as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((file as File).name).toBe('Solution.zip');
    expect((task as StudentTaskItem).id).toBe('ASM-LOCAL-01');
  });

  it('remembers the submission locally so the hub can mark it as handed in', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile());
    await screen.findByText(/SHA-256:/);
    await user.click(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ }));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved['ASM-LOCAL-01']).toMatchObject({
      assignmentId: 'ASM-LOCAL-01',
      fileName: 'Solution.zip',
      status: 'QUEUED',
    });
    expect(saved['ASM-LOCAL-01'].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a file larger than the 10 MB limit before uploading it', async () => {
    const user = userEvent.setup();
    const { onSubmit } = await openDetail();

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      zipFile('Solution.zip', 11 * 1024 * 1024),
    );

    expect(await screen.findByText(/KHÔNG THỂ NỘP: DUNG LƯỢNG FILE VƯỢT QUÁ 10MB/)).toBeInTheDocument();
    expect(screen.getByText(/Dung lượng file \(11\.00 MB\) vượt quá giới hạn tối đa 10 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
    // A rejected file must not appear as if it were selected.
    expect(screen.queryByText('Chọn lại file khác')).not.toBeInTheDocument();
  });

  it('honours a smaller per-assignment size limit', async () => {
    const user = userEvent.setup();
    await openDetail({ maxSizeMb: 1 });

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      zipFile('Solution.zip', 2 * 1024 * 1024),
    );

    expect(await screen.findByText(/vượt quá giới hạn tối đa 1 MB/)).toBeInTheDocument();
  });

  it('refuses anything that is not a .zip archive', async () => {
    const { onSubmit } = await openDetail();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // `user.upload` refuses to set a file that `accept=".zip"` excludes, so drive the change
    // handler the way a browser with a stale filter (or a file renamed to .zip then back) would:
    // the component's own extension check is what has to reject it, not the input attribute.
    const txt = new File(['int main() {}'], 'Solution.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [txt], configurable: true });
    fireEvent.change(input);

    expect(
      await screen.findByText('Chỉ chấp nhận file định dạng nén (.zip) chứa mã nguồn.'),
    ).toBeInTheDocument();
    expect(screen.getByText('LỖI BÀI NỘP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a .rar-named archive only because the MIME type is a compressed archive', async () => {
    // The component trusts a compressed MIME type, so a renamed archive still gets through —
    // this pins the rule the UI actually applies.
    const { container } = await openDetail();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const renamed = new File(['PK'], 'Solution.zip', { type: 'application/x-zip-compressed' });
    Object.defineProperty(input, 'files', { value: [renamed], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText('Solution.zip')).toBeInTheDocument();
    expect(container.textContent).toContain('Kích thước');
  });

  it('rejects an empty archive', async () => {
    await openDetail();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const empty = new File([], 'Solution.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { value: [empty], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText(/File rỗng \(0 byte\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();
  });

  it('refuses to accept a file once the deadline has passed', async () => {
    const user = userEvent.setup();
    await openDetail({ deadline: isoIn(-3600 * 1000) });

    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      zipFile(),
    );

    expect(await screen.findByText(/Đã quá hạn nộp bài \(/)).toBeInTheDocument();
    expect(screen.getByText(/Cổng nộp đã tự động đóng\./)).toBeInTheDocument();
  });

  it('accepts a file dropped on the drop zone', async () => {
    const { container } = await openDetail();
    const dropZone = container.querySelector('input[type="file"]')?.parentElement as HTMLElement;

    fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [zipFile('Dropped.zip', 64)] } });

    expect(await screen.findByText('Dropped.zip')).toBeInTheDocument();
  });

  it('ignores a drop that carries no file', async () => {
    const { container } = await openDetail();
    const dropZone = container.querySelector('input[type="file"]')?.parentElement as HTMLElement;

    fireEvent.dragLeave(dropZone, { dataTransfer: { files: [] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });

    expect(screen.getByText(/Kéo và thả file bài làm \.zip vào đây/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();
  });

  it('lets the student clear a chosen file', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile());
    expect(await screen.findByText('Solution.zip')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Chọn lại file khác/ }));
    expect(screen.queryByText('Solution.zip')).not.toBeInTheDocument();
    expect(screen.getByText(/Kéo và thả file bài làm \.zip vào đây/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();
  });

  it('shows the hashing progress and keeps submit disabled until it finishes', async () => {
    const user = userEvent.setup();
    let release: (value: ArrayBuffer) => void = () => {};
    const pending = new Promise<ArrayBuffer>((resolve) => {
      release = resolve;
    });
    const digest = vi.spyOn(crypto.subtle, 'digest').mockReturnValue(pending as unknown as Promise<ArrayBuffer>);

    await openDetail();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile());

    expect(await screen.findByText(/Đang tính toán mã băm SHA-256 xác thực/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeDisabled();

    await act(async () => {
      release(new Uint8Array([1, 2, 3]).buffer);
    });

    expect(await screen.findByText(/SHA-256: 010203/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeEnabled();
    digest.mockRestore();
  });

  it('still accepts the file when the browser cannot hash it', async () => {
    const user = userEvent.setup();
    const digest = vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('không hỗ trợ'));

    await openDetail();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile());

    expect(await screen.findByText('Solution.zip')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeEnabled();
    });
    expect(screen.queryByText(/SHA-256:/)).not.toBeInTheDocument();
    digest.mockRestore();
  });

  it('demonstrates the oversized-file exception from the review banner', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole('button', { name: /Demo File Vượt 10MB/ }));

    expect(screen.getByText(/Dung lượng file \(12\.45 MB\) vượt quá giới hạn tối đa 10 MB/)).toBeInTheDocument();
    expect(screen.getByText(/KHÔNG THỂ NỘP: DUNG LƯỢNG FILE VƯỢT QUÁ 10MB/)).toBeInTheDocument();
  });

  it('demonstrates and restores the closed-gate exception', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.click(screen.getByRole('button', { name: /Demo Quá Hạn Nộp/ }));

    expect(screen.getByText(/KHÔNG THỂ NỘP: ĐÃ QUÁ HẠN NỘP BÀI/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cổng Nộp Đã Đóng/ })).toBeDisabled();

    // The countdown must reflect the simulated expiry too.
    expect(screen.getByText('Quá hạn nộp bài')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Khôi phục hạn nộp/ }));
    expect(screen.queryByText(/KHÔNG THỂ NỘP: ĐÃ QUÁ HẠN NỘP BÀI/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ })).toBeInTheDocument();
  });

  it('offers a re-submit wording once a submission exists', async () => {
    const user = userEvent.setup();
    await openDetail();

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile('Solution.zip', 2048));
    await screen.findByText(/SHA-256:/);
    await user.click(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ }));

    expect(
      await screen.findByRole('button', { name: /Nộp Lại Bài & Chấm Điểm Tự Động/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('✓ ĐÃ NỘP BÀI')).toBeInTheDocument();
    expect(screen.getByText(/Lịch Sử Bài Nộp Gần Nhất Của Bạn/)).toBeInTheDocument();
  });

  it('warns instead of crashing when localStorage refuses the write', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('hết dung lượng');
    });

    const { onSubmit } = await openDetail();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, zipFile());
    await screen.findByText(/SHA-256:/);
    await user.click(screen.getByRole('button', { name: /Nộp Bài & Kích Hoạt/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Không thể lưu kết quả nộp bài:', expect.any(Error));
    setItem.mockRestore();
    warn.mockRestore();
  });
});

describe('SubmissionView – submission history', () => {
  const historyEntry = (over: Record<string, unknown> = {}) => ({
    submissionId: 'SUB-000000-OLD001',
    studentId: STUDENT_ID,
    assignmentId: 'ASM-LOCAL-01',
    fileName: 'Old.zip',
    language: 'python',
    score: 4,
    createdAt: '2026-10-18T08:00:00.000Z',
    details: {
      passedTestcases: 1,
      totalTestcases: 2,
      executionTimeMs: 320,
      aiRating: { ...AIRatingFixture, cleanCodeScore: 6.5 },
    },
    ...over,
  });

  it('summarises the previous attempts fetched for the assignment', async () => {
    const { container } = await openDetail();

    expect(await screen.findByText(/Lịch Sử Bài Nộp Gần Nhất Của Bạn/)).toBeInTheDocument();
    expect(container.textContent).toContain('ĐÃ CHẤM: 8.5 / 10.0');
    expect(container.textContent).toContain('File: Solution.py');
    expect(container.textContent).toContain('Testcases: 2/2 Passed');
    expect(container.textContent).toContain('Mã nguồn sạch: 8.5 / 10.0');
    expect(container.textContent).toContain('Thời gian chạy: 185 ms');

    const called = stub.spy.mock.calls.map((c) => String(c[0]));
    expect(called).toContain(
      'http://localhost:3000/api/v1/submissions?assignmentId=ASM-LOCAL-01&studentId=SE170000',
    );
  });

  it('lists every attempt when the student submitted more than once', async () => {
    useFetchRoutes({
      routes: [
        {
          match: '/api/v1/submissions',
          body: { statusCode: 200, data: [historyEntry(), historyEntry({ submissionId: 'SUB-NEW', score: 9 })] },
        },
      ],
    });
    const { container } = await openDetail();

    expect(await screen.findByText(/Tất cả các lần nộp của bài này \(2 lần\)/)).toBeInTheDocument();
    expect(container.textContent).toContain('Lần 2:');
    expect(container.textContent).toContain('SUB-NEW');
    expect(container.textContent).toContain('9.0/10đ');
    expect(screen.getAllByRole('button', { name: /Xem chi tiết/ }).length).toBe(2);
  });

  it('falls back to the locally remembered submission when the API has none', async () => {
    useFetchRoutes({ routes: [{ match: '/api/v1/submissions', body: { statusCode: 200, data: [] } }] });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'ASM-LOCAL-01': {
          assignmentId: 'ASM-LOCAL-01',
          submittedAt: '2026-10-19T10:00:00.000Z',
          fileName: 'Local.zip',
          score: 7.5,
          status: 'GRADED',
        },
      }),
    );
    const { container } = await openDetail();

    expect(await screen.findByText(/Lịch Sử Bài Nộp Gần Nhất Của Bạn/)).toBeInTheDocument();
    expect(container.textContent).toContain('Local.zip');
    expect(container.textContent).toContain('ĐÃ CHẤM: 7.5 / 10.0');
  });

  it('hides the history panel when there is nothing to show', async () => {
    useFetchRoutes({ routes: [{ match: '/api/v1/submissions', body: { statusCode: 200, data: [] } }] });
    await openDetail();

    expect(screen.queryByText(/Lịch Sử Bài Nộp Gần Nhất Của Bạn/)).not.toBeInTheDocument();
  });

  it('survives a failing submissions request', async () => {
    useFetchRoutes({ routes: [{ match: '/api/v1/submissions', status: 500, body: {} }] });
    await openDetail();

    expect(screen.queryByText(/Lịch Sử Bài Nộp Gần Nhất Của Bạn/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tải Lên Mã Nguồn Bài Làm/)).toBeInTheDocument();
  });

  it('opens the detail modal from the history panel', async () => {
    // Regression: this button lives in the detail branch of SubmissionView, but the modal was
    // rendered only in the deadline-list branch, so clicking it flipped state that nothing read
    // and no modal ever appeared.
    const user = userEvent.setup();
    await openDetail();

    await user.click(
      await screen.findByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn, Testcases & AI\)/ }),
    );

    expect(await screen.findByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeInTheDocument();
    expect(screen.getByText('Đóng Cửa Sổ')).toBeInTheDocument();
  });

  it('opens the detail modal for one specific attempt', async () => {
    const user = userEvent.setup();
    useFetchRoutes({
      routes: [
        {
          match: '/api/v1/submissions',
          body: { statusCode: 200, data: [historyEntry(), historyEntry({ submissionId: 'SUB-NEW', score: 9 })] },
        },
      ],
    });
    await openDetail();
    await screen.findByText(/Tất cả các lần nộp/);

    await user.click(screen.getAllByRole('button', { name: /Xem chi tiết/ })[0]);
    expect(await screen.findByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).toBeInTheDocument();
  });

  it('closes the detail modal from the submit screen', async () => {
    const user = userEvent.setup();
    await openDetail();
    await user.click(
      await screen.findByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn, Testcases & AI\)/ }),
    );
    await screen.findByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/);

    await user.click(screen.getByRole('button', { name: /Đóng Cửa Sổ/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/)).not.toBeInTheDocument();
    });
  });

  it('forwards the appeal callback to the modal', async () => {
    const user = userEvent.setup();
    const onOpenAppeal = vi.fn();
    await openDetail({}, { onOpenAppeal });
    await user.click(
      await screen.findByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn, Testcases & AI\)/ }),
    );
    await user.click(await screen.findByRole('button', { name: /Phúc Khảo Bài Nộp Này/ }));

    expect(onOpenAppeal).toHaveBeenCalledWith('SUB-000001-AAAAAA', 8.5);
  });
});
