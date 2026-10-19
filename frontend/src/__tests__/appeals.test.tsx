import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LecturerAppealsManager } from '../components/LecturerAppealsManager';
import { StudentHistoryView } from '../components/StudentHistoryView';
import { AppealModal } from '../components/AppealModal';
import { installFetchStub, AppealFixture } from '../test/fixtures';
import type { Appeal } from '../types';

/**
 * UC-06 / BR-05 — the appeal workflow end to end.
 *
 * Three screens cooperate here: the student files an appeal (AppealModal), the student and the
 * lecturer read the resulting state (StudentHistoryView, LecturerAppealsManager), and the
 * lecturer resolves it. Every component fetches on mount, so each test installs the router from
 * `test/fixtures.ts` and asserts on the real endpoint, HTTP method and request body.
 *
 * The BR-05 cap (max 2 appeals per submission) and the 10-character minimum on the reason are
 * the two rules the UI is responsible for enforcing before the gateway ever sees the request.
 */

/**
 * The default `apiBaseUrl` all three components fall back to when the prop is omitted — which is
 * how every test below renders them, so the assertions double as a check that the default holds.
 */
const API = 'http://localhost:3000';

/** The `init` object of the first fetch call whose URL contains `fragment`. */
function callFor(
  spy: { mock: { calls: unknown[][] } },
  fragment: string,
): { url: string; init: RequestInit | undefined } | undefined {
  const hit = spy.mock.calls.find((c) => String(c[0]).includes(fragment));
  if (!hit) return undefined;
  return { url: String(hit[0]), init: hit[1] as RequestInit | undefined };
}

function bodyOf(init: RequestInit | undefined): any {
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return { ...(AppealFixture as unknown as Appeal), ...overrides };
}

/**
 * The reason textarea carries no `htmlFor` on its label, so it is addressed by its placeholder.
 * (`getByRole('textbox')` is ambiguous here: the submission-id `<input>` is also a textbox.)
 */
const reasonBox = () =>
  screen.getByPlaceholderText(/Trình bày chi tiết lý do bạn cho rằng điểm số chưa chính xác/i);

/** Same story for the lecturer's resolution note. */
const noteBox = () =>
  screen.getByPlaceholderText(/Ví dụ: Đã đối chiếu mã nguồn QuickSort/i);

/** A `fetch` implementation that returns one payload for POST /resolve and another otherwise. */
function resolveRoute(status: number, payload: unknown) {
  return async (input: any) => {
    const isResolve = String(input).includes('/resolve');
    const actual = isResolve ? status : 200;
    const body = isResolve ? payload : { statusCode: 200, data: [] };
    return {
      ok: actual >= 200 && actual < 300,
      status: actual,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
      clone() { return this; },
    } as any;
  };
}

/**
 * Read back what a component put on the clipboard.
 *
 * `userEvent.setup()` installs an in-memory clipboard stub on `window.navigator`, which is both
 * why a bare `navigator.clipboard.writeText(...)` no longer throws in jsdom and why this works
 * without a browser: the stub remembers what was written.
 */
async function clipboardText(): Promise<string> {
  return window.navigator.clipboard.readText();
}

// ─────────────────────────────────────────────────────────────────────────────
// AppealModal — the form a student uses to file an appeal
// ─────────────────────────────────────────────────────────────────────────────

describe('AppealModal', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders the appeal form with the submission id pinned', async () => {
    render(
      <AppealModal
        isOpen
        onClose={() => {}}
        submissionId="SUB-000001-AAAAAA"
        studentId="SE170000"
        currentScore={5}
      />,
    );

    expect(screen.getByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).toBeInTheDocument();
    const subIdInput = screen.getByPlaceholderText(/VD: SUB-1728/i) as HTMLInputElement;
    expect(subIdInput.value).toBe('SUB-000001-AAAAAA');
    // "Cố định theo bài" — a student opening the modal from a submission must not be able to
    // retarget the appeal at somebody else's submission.
    expect(subIdInput.readOnly).toBe(true);
    expect(screen.getByText(/Cố định theo bài/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 \/ 10\.0/)).toBeInTheDocument();
    // Let the mount-time appeal fetch settle before the test ends.
    await screen.findByText(/Lịch sử phúc khảo của bài nộp này/i);
  });

  it('renders nothing at all when closed', () => {
    const { container } = render(
      <AppealModal isOpen={false} onClose={() => {}} studentId="SE170000" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('queries the appeals of the submission it was opened for', async () => {
    render(
      <AppealModal
        isOpen
        onClose={() => {}}
        submissionId="SUB-000001-AAAAAA"
        studentId="SE170000"
      />,
    );

    await waitFor(() => {
      expect(callFor(stub.spy, '/api/v1/appeals?submissionId=')).toBeDefined();
    });
    const call = callFor(stub.spy, '/api/v1/appeals?submissionId=')!;
    expect(call.url).toContain('submissionId=SUB-000001-AAAAAA');
  });

  it('shows how many appeal turns this submission has left', async () => {
    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    // The fixture returns one existing appeal, so 1/2 is used and 1 remains.
    expect(await screen.findByText(/1\/2 lượt/)).toBeInTheDocument();
    expect(screen.getByText(/Còn lại 1 lượt khiếu nại cho bài này/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử phúc khảo của bài nộp này \(1\/2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Em nghĩ bài của em đúng testcase 2 ạ\./)).toBeInTheDocument();
  });

  it('posts the typed reason to /api/v1/appeals', async () => {
    const user = userEvent.setup();
    render(
      <AppealModal
        isOpen
        onClose={() => {}}
        submissionId="SUB-000001-AAAAAA"
        studentId="SE170000"
        currentScore={4.5}
      />,
    );

    const reason = 'Bài em đã xử lý đúng testcase biên, đề nghị giảng viên chấm lại ạ.';
    await user.type(reasonBox(), reason);
    await user.click(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i }));

    await waitFor(() => {
      expect(callFor(stub.spy, '/api/v1/appeals')).toBeDefined();
    });

    const post = stub.spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(post, 'the appeal must be submitted with POST').toBeDefined();
    expect(String(post![0])).toBe(`${API}/api/v1/appeals`);
    expect(bodyOf(post![1] as RequestInit)).toEqual({
      submissionId: 'SUB-000001-AAAAAA',
      studentId: 'SE170000',
      reason,
    });
  });

  it('confirms the submission and notifies the parent', async () => {
    const user = userEvent.setup();
    let successes = 0;
    render(
      <AppealModal
        isOpen
        onClose={() => {}}
        submissionId="SUB-000001-AAAAAA"
        studentId="SE170000"
        onAppealSuccess={() => { successes += 1; }}
      />,
    );

    await user.type(reasonBox(), 'Điểm testcase 2 bị tính sai ạ.');
    await user.click(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i }));

    expect(await screen.findByText(/đã được gửi thành công/i)).toBeInTheDocument();
    expect(successes).toBe(1);
    // The textarea is cleared so the student cannot accidentally double-submit the same text.
    expect((reasonBox() as HTMLTextAreaElement).value).toBe('');
  });

  it('renders the gateway error message when the POST is rejected', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/api/v1/appeals', body: { statusCode: 200, data: [] } },
      ],
    });
    const user = userEvent.setup();
    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    // Re-point the appeals endpoint at a 400 for the POST specifically.
    stub.spy.mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      const status = init?.method === 'POST' && url.includes('/api/v1/appeals') ? 400 : 200;
      const bodyData =
        status === 400
          ? { message: 'Đã quá thời hạn phúc khảo cho phép!' }
          : { statusCode: 200, data: [] };
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => bodyData,
        text: async () => JSON.stringify(bodyData),
        clone() { return this; },
      } as any;
    });

    await user.type(reasonBox(), 'Em xin phúc khảo lại bài này ạ.');
    await user.click(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i }));

    expect(await screen.findByText('Đã quá thời hạn phúc khảo cho phép!')).toBeInTheDocument();
  });

  // ── Client-side validation ────────────────────────────────────────────────

  it('refuses to POST a reason shorter than 10 characters', async () => {
    const user = userEvent.setup();
    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );
    await screen.findByText(/Lịch sử phúc khảo của bài nộp này/i);

    const submit = screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i });
    // Nothing typed yet: the button is disabled, so a stray Enter cannot fire a request.
    expect(submit).toBeDisabled();

    await user.type(reasonBox(), 'sai roi');
    expect(submit).toBeDisabled();

    const posted = stub.spy.mock.calls.some(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(posted, 'a too-short reason must never reach the network').toBe(false);
  });

  it('rejects a blank reason submitted through the form directly', async () => {
    // The button is disabled for a blank reason, so drive the form's submit handler the way a
    // browser would when the student presses Enter in the textarea.
    const { container } = render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );
    await screen.findByText(/Lịch sử phúc khảo của bài nộp này/i);

    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(
      screen.getByText(/Vui lòng nhập lý do khiếu nại cụ thể \(tối thiểu 10 ký tự\)/i),
    ).toBeInTheDocument();
    expect(stub.spy.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(
      false,
    );
  });

  it('rejects a reason longer than the 1000-character limit the counter advertises', async () => {
    // Regression: the counter under the textarea promised "x/1000 ký tự" and the gateway DTO
    // enforces MaxLength(1000), but nothing on the client stopped an 8800-character essay from
    // being POSTed — the student lost the entire appeal to a 400 after the round trip.
    const { container } = render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );
    // Let the mount-time appeal fetch settle first, so React is not updating state mid-test.
    await screen.findByText(/Lịch sử phúc khảo của bài nộp này/i);

    // `fireEvent.change` writes the value straight into React state, which is exactly the case
    // the guard exists for: it cannot rely on the browser honouring the textarea's maxLength.
    fireEvent.change(reasonBox(), { target: { value: 'a'.repeat(1200) } });
    expect(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i })).toBeDisabled();

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });

    expect(screen.getByText(/tối đa 1000 ký tự/i)).toBeInTheDocument();
    expect(
      stub.spy.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
  });

  it('caps the reason at 1000 characters so a browser never lets it overflow', async () => {
    render(<AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />);
    expect(reasonBox()).toHaveAttribute('maxlength', '1000');
    await screen.findByText(/Lịch sử phúc khảo của bài nộp này/i);
  });

  it('will not POST without a submission id', async () => {
    const user = userEvent.setup();
    render(<AppealModal isOpen onClose={() => {}} studentId="SE170000" />);

    await user.type(reasonBox(), 'Lý do hợp lệ và đủ dài để gửi ạ.');
    await user.click(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i }));

    expect(
      await screen.findByText(/Vui lòng nhập mã bài nộp \(Submission ID\) cần phúc khảo/i),
    ).toBeInTheDocument();
    expect(
      stub.spy.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST'),
    ).toBe(false);
  });

  // ── BR-05 cap ─────────────────────────────────────────────────────────────

  it('blocks a third appeal once the submission has used both turns', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({ appealId: 'APL-1', status: 'REJECTED', createdAt: '2026-10-19T10:00:00.000Z' }),
              makeAppeal({ appealId: 'APL-2', status: 'ACCEPTED', adjustedScore: 7.5, createdAt: '2026-10-19T11:00:00.000Z' }),
            ],
          },
        },
      ],
    });

    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    expect(
      await screen.findByText(/Đã đạt giới hạn phúc khảo của bài nộp này \(2\/2 lần\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Đã hết lượt phúc khảo cho bài nộp này/i)).toBeInTheDocument();
    // The form itself is gone, so there is no third submission path at all.
    expect(screen.queryByRole('button', { name: /Gửi Đơn Phúc Khảo/i })).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Trình bày chi tiết lý do bạn cho rằng điểm số chưa chính xác/i),
    ).not.toBeInTheDocument();
  });

  it('renders the lecturer decision on an accepted appeal', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({
                status: 'ACCEPTED',
                adjustedScore: 8.5,
                reviewerId: 'GV0001',
                resolutionNote: 'Đã chấm lại testcase 2, cộng 2.0 điểm.',
                resolvedAt: '2026-10-19T12:00:00.000Z',
              }),
            ],
          },
        },
      ],
    });

    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    expect(await screen.findByText(/ĐÃ CHẤP THUẬN/)).toBeInTheDocument();
    expect(screen.getByText(/Phản hồi từ Giảng viên \(GV0001\)/i)).toBeInTheDocument();
    expect(screen.getByText('Đã chấm lại testcase 2, cộng 2.0 điểm.')).toBeInTheDocument();
    expect(screen.getByText(/Điểm số chính thức sau phúc khảo: 8\.5 \/ 10\.0/)).toBeInTheDocument();
  });

  it('renders the lecturer decision on a rejected appeal', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({
                status: 'REJECTED',
                reviewerId: 'GV0001',
                resolutionNote: 'Điểm số giữ nguyên.',
                resolvedAt: '2026-10-19T12:00:00.000Z',
              }),
            ],
          },
        },
      ],
    });

    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    expect(await screen.findByText(/ĐÃ TỪ CHỐI/)).toBeInTheDocument();
    expect(screen.getByText('Điểm số giữ nguyên.')).toBeInTheDocument();
  });

  it('shows an in-review appeal as awaiting the lecturer', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/api/v1/appeals', body: { statusCode: 200, data: [makeAppeal({ status: 'IN_REVIEW' })] } },
      ],
    });

    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    expect(await screen.findByText(/ĐANG PHÚC TRA/)).toBeInTheDocument();
    expect(
      screen.getByText(/Đang trong danh sách chờ Giảng viên xem xét và phúc tra/i),
    ).toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    let closed = 0;
    const { container } = render(
      <AppealModal isOpen onClose={() => { closed += 1; }} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    await user.click(container.firstElementChild as HTMLElement);
    expect(closed).toBe(1);
  });

  it('does not close when the click lands inside the dialog', async () => {
    const user = userEvent.setup();
    let closed = 0;
    render(
      <AppealModal isOpen onClose={() => { closed += 1; }} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    await user.click(screen.getByText(/Quy định phúc khảo: Tối đa 2 lần khiếu nại cho mỗi bài nộp/i));
    expect(closed).toBe(0);
  });

  it('loads the appeal history when the submission id is typed and the field blurred', async () => {
    const user = userEvent.setup();
    render(<AppealModal isOpen onClose={() => {}} studentId="SE170000" />);

    const input = screen.getByPlaceholderText(/VD: SUB-1728/i);
    await user.type(input, 'SUB-999999-ZZZZZZ');
    await user.tab();

    await waitFor(() => {
      expect(
        stub.spy.mock.calls.some((c) => String(c[0]).includes('submissionId=SUB-999999-ZZZZZZ')),
      ).toBe(true);
    });
  });

  it('survives an appeals endpoint that returns a server error', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', status: 500, body: { message: 'lỗi' } }] });

    const { container } = render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    // No history block, but the form is still usable.
    await waitFor(() => expect(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i })).toBeInTheDocument());
    expect(container.textContent).not.toContain('Lịch sử phúc khảo');
  });

  it('reports a network failure instead of hanging on "Đang gửi đơn..."', async () => {
    stub.restore();
    stub = installFetchStub();
    const user = userEvent.setup();
    render(
      <AppealModal isOpen onClose={() => {}} submissionId="SUB-000001-AAAAAA" studentId="SE170000" />,
    );

    stub.spy.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });

    await user.type(reasonBox(), 'Mạng lỗi nhưng lý do đã đủ dài ạ.');
    await user.click(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i }));

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StudentHistoryView — the student's submission history
// ─────────────────────────────────────────────────────────────────────────────

describe('StudentHistoryView', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('loads this student\u2019s submissions', async () => {
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    await waitFor(() => {
      expect(callFor(stub.spy, '/api/v1/submissions?studentId=')).toBeDefined();
    });
    expect(callFor(stub.spy, '/api/v1/submissions?studentId=')!.url).toContain('studentId=SE170000');
  });

  it('renders the submission card with score, testcases and clean-code breakdown', async () => {
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText('SUB-000001-AAAAAA')).toBeInTheDocument();
    expect(screen.getByText(/ĐẠT \(8\.5\/10\)/)).toBeInTheDocument();
    // The headline score in the corner of the card, distinct from the clean-code sub-score.
    expect(screen.getByText(/Điểm Tổng Hợp/i).parentElement?.textContent).toContain('8.5 / 10.0');
    expect(screen.getByText(/2\/2 Testcases/)).toBeInTheDocument();
    expect(screen.getByText(/Mã nguồn sạch:/i).parentElement?.textContent).toContain('8.5 / 10.0');
    expect(screen.getByText(/S:9 O:8 L:8\.5 I:7\.5 D:8/)).toBeInTheDocument();
    expect(screen.getByText(/Mã nguồn rõ ràng, còn vài điểm cần cải thiện về đặt tên\./)).toBeInTheDocument();
  });

  it('summarises the totals in the header', async () => {
    const { container } = render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/TỔNG BÀI ĐÃ NỘP/i)).toBeInTheDocument();
    expect(screen.getByText(/BÀI ĐẠT YÊU CẦU/i)).toBeInTheDocument();
    // One submission, and it passed: "1 bài" and "1 / 1 bài".
    expect(container.textContent).toContain('1 bài');
    expect(container.textContent).toContain('/ 1 bài');
  });

  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows the "no submissions yet" empty state for a student with nothing', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/submissions', body: { statusCode: 200, total: 0, data: [] } }],
    });

    render(<StudentHistoryView studentId="SE171111" studentName="Sinh viên mới" />);

    expect(await screen.findByText(/Bạn chưa có bài nộp nào/i)).toBeInTheDocument();
  });

  it('offers a way to submit from the empty state', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/submissions', body: { statusCode: 200, total: 0, data: [] } }],
    });
    const user = userEvent.setup();
    let navigated = 0;

    render(
      <StudentHistoryView
        studentId="SE171111"
        studentName="Sinh viên mới"
        onNavigateToSubmit={() => { navigated += 1; }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Nộp Bài Tập Ngay/i }));
    expect(navigated).toBe(1);
  });

  it('shows the filter empty state, not the "no submissions" one, when a filter matches nothing', async () => {
    // Regression: the empty-state heading keyed only on `searchTerm`, so selecting the "Chưa đạt"
    // filter with only passing submissions on screen told a student with graded work that they
    // had never submitted anything.
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await screen.findByText('SUB-000001-AAAAAA');

    await user.click(screen.getByRole('button', { name: /Chưa đạt/i }));

    expect(
      await screen.findByText(/Không tìm thấy bài nộp nào phù hợp bộ lọc/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Bạn chưa có bài nộp nào/i)).not.toBeInTheDocument();
  });

  it('falls back to the unfiltered submission list when the student query is empty', async () => {
    stub.restore();
    stub = installFetchStub();
    stub.spy.mockImplementation(async (input: any) => {
      const url = String(input);
      const empty = url.includes('studentId=');
      const payload = empty
        ? { statusCode: 200, total: 0, data: [] }
        : {
            statusCode: 200,
            total: 1,
            data: [
              {
                submissionId: 'SUB-FALLBACK-01',
                studentId: 'SE170000',
                assignmentId: 'ASM-SWP391-02',
                language: 'java',
                fileName: 'Main.java',
                status: 'FAILED',
                score: 3.0,
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
          };
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => payload,
        text: async () => JSON.stringify(payload),
        clone() { return this; },
      } as any;
    });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText('SUB-FALLBACK-01')).toBeInTheDocument();
    expect(screen.getByText(/CHƯA ĐẠT \(3\.0\/10\)/)).toBeInTheDocument();
    expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('limit=20'))).toBe(true);
  });

  // ── Search and filters ────────────────────────────────────────────────────

  it('filters submissions by the search box', async () => {
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await screen.findByText('SUB-000001-AAAAAA');

    await user.type(screen.getByPlaceholderText(/Tìm theo Mã bài nộp/i), 'khong-ton-tai');

    expect(await screen.findByText(/Không tìm thấy bài nộp nào phù hợp bộ lọc/i)).toBeInTheDocument();
    expect(screen.queryByText('SUB-000001-AAAAAA')).not.toBeInTheDocument();
  });

  it('reloads every list when "Làm mới" is pressed', async () => {
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await screen.findByText('SUB-000001-AAAAAA');

    const before = stub.spy.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Làm mới/i }));

    await waitFor(() => expect(stub.spy.mock.calls.length).toBeGreaterThan(before));
  });

  // ── Appeals on the card ───────────────────────────────────────────────────

  it('requests the student\u2019s appeals alongside the submissions', async () => {
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    await waitFor(() => {
      expect(callFor(stub.spy, '/api/v1/appeals?studentId=')).toBeDefined();
    });
    expect(callFor(stub.spy, '/api/v1/appeals?studentId=')!.url).toContain('studentId=SE170000');
  });

  it('renders the appeal history attached to the submission', async () => {
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(
      await screen.findByText(/Thông Tin Phúc Khảo Bài Nộp \(Đã sử dụng: 1\/2 lượt của bài này\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lý do bạn khiếu nại:/i)).toBeInTheDocument();
    expect(screen.getByText(/Em nghĩ bài của em đúng testcase 2 ạ\./)).toBeInTheDocument();
    expect(screen.getByText(/Phúc khảo: 1\/2 lượt/)).toBeInTheDocument();
    expect(screen.getByText(/ĐANG CHỜ GIẢNG VIÊN XEM XÉT/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phúc khảo lần 2 \(1\/2 lượt\)/i })).toBeEnabled();
  });

  it('applies an accepted appeal\u2019s adjusted score and dims the original', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({
                status: 'ACCEPTED',
                adjustedScore: 9.5,
                reviewerId: 'GV0001',
                resolutionNote: 'Đã chấm lại, cộng 1.0 điểm.',
                resolvedAt: '2026-10-19T12:00:00.000Z',
              }),
            ],
          },
        },
      ],
    });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Điểm Sau Phúc Khảo/i)).toBeInTheDocument();
    expect(screen.getByText(/Điểm gốc: 8\.5\/10\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Điểm số điều chỉnh chính thức: 9\.5 \/ 10\.0/)).toBeInTheDocument();
    expect(screen.getByText(/ĐÃ CHẤP THUẬN CẬP NHẬT ĐIỂM/i)).toBeInTheDocument();
  });

  it('shows a rejected appeal with the lecturer\u2019s note', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({
                status: 'REJECTED',
                reviewerId: 'GV0001',
                resolutionNote: 'Bài nộp không đúng yêu cầu đề bài.',
                resolvedAt: '2026-10-19T12:00:00.000Z',
              }),
            ],
          },
        },
      ],
    });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/ĐÃ TỪ CHỐI KHIẾU NẠI/i)).toBeInTheDocument();
    expect(screen.getByText('Bài nộp không đúng yêu cầu đề bài.')).toBeInTheDocument();
    expect(screen.getByText(/✕ Đã từ chối/)).toBeInTheDocument();
  });

  it('does not adopt appeals filed by another student', async () => {
    // Regression: when the student-scoped query came back empty, the component fell back to the
    // UNFILTERED `/api/v1/appeals` list and adopted it wholesale. Another student's appeal —
    // reason, lecturer feedback and adjusted score — then rendered inside this student's card.
    stub.restore();
    stub = installFetchStub();
    stub.spy.mockImplementation(async (input: any) => {
      const url = String(input);
      const scoped = url.includes('studentId=');
      const payload = scoped
        ? { statusCode: 200, total: 0, data: [] }
        : {
            statusCode: 200,
            total: 1,
            data: [
              makeAppeal({
                appealId: 'APL-OTHER-STUDENT',
                studentId: 'SE179999',
                reason: 'Đơn khiếu nại của sinh viên khác.',
                status: 'ACCEPTED',
                adjustedScore: 10,
              }),
            ],
          };
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => payload,
        text: async () => JSON.stringify(payload),
        clone() { return this; },
      } as any;
    });

    const { container } = render(
      <StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />,
    );
    await screen.findByText('SUB-000001-AAAAAA');

    await waitFor(() => {
      expect(stub.spy.mock.calls.some((c) => !String(c[0]).includes('studentId='))).toBe(true);
    });

    expect(container.textContent).not.toContain('Đơn khiếu nại của sinh viên khác.');
    expect(screen.queryByText(/Điểm Sau Phúc Khảo/i)).not.toBeInTheDocument();
  });

  it('disables the appeal button once both turns are used', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({ appealId: 'APL-1', status: 'REJECTED', createdAt: '2026-10-19T10:00:00.000Z' }),
              makeAppeal({ appealId: 'APL-2', status: 'PENDING', createdAt: '2026-10-19T11:00:00.000Z' }),
            ],
          },
        },
      ],
    });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    const exhausted = await screen.findByRole('button', { name: /Hết lượt phúc khảo \(2\/2\)/i });
    expect(exhausted).toBeDisabled();
    expect(screen.getByText(/Phúc khảo: 2\/2 lượt/)).toBeInTheDocument();
  });

  it('hands the appeal off to the parent callback when one is supplied', async () => {
    const user = userEvent.setup();
    const calls: Array<[string, number | undefined]> = [];

    render(
      <StudentHistoryView
        studentId="SE170000"
        studentName="Đinh Thành Trung"
        onOpenAppealModal={(submissionId, currentScore) => { calls.push([submissionId, currentScore]); }}
      />,
    );

    await screen.findByText('SUB-000001-AAAAAA');
    // The fixture already used one turn, so the button offers turn 2.
    await user.click(screen.getByRole('button', { name: /Phúc khảo lần 2/i }));

    // No internal modal is rendered when the parent owns the appeal flow.
    expect(screen.queryByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).not.toBeInTheDocument();
    expect(calls).toEqual([['SUB-000001-AAAAAA', 8.5]]);
  });

  it('opens its own appeal modal when no parent callback is supplied', async () => {
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    await screen.findByText('SUB-000001-AAAAAA');
    await user.click(screen.getByRole('button', { name: /Phúc khảo lần 2 \(1\/2 lượt\)/i }));

    expect(await screen.findByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).toBeInTheDocument();
    const subIdInput = screen.getByPlaceholderText(/VD: SUB-1728/i) as HTMLInputElement;
    expect(subIdInput.value).toBe('SUB-000001-AAAAAA');
    // The modal is seeded with the effective score of the submission it was opened for.
    expect(screen.getByText(/Điểm hiện tại/i).parentElement?.textContent).toContain('8.5 / 10.0');
  });

  // ── Detail modal + download ───────────────────────────────────────────────

  it('opens the detail modal for the chosen submission', async () => {
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    await screen.findByText('SUB-000001-AAAAAA');
    await user.click(screen.getByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn & AI\)/i }));

    expect(await screen.findByText(/Chi Tiết Bài Nộp & Kết Quả Chấm AI/i)).toBeInTheDocument();
  });

  it('opens the appeal modal from the detail modal\u2019s footer', async () => {
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    await screen.findByText('SUB-000001-AAAAAA');
    await user.click(screen.getByRole('button', { name: /Xem Chi Tiết \(Mã Nguồn & AI\)/i }));
    await user.click(await screen.findByRole('button', { name: /Phúc Khảo Bài Nộp Này/i }));

    expect(await screen.findByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).toBeInTheDocument();
  });

  it('downloads the submission zip from the per-submission download endpoint', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await screen.findByText('SUB-000001-AAAAAA');

    await user.click(screen.getByRole('button', { name: /Tải lại bài \(\.zip\)/i }));

    await waitFor(() => {
      expect(callFor(stub.spy, '/download')).toBeDefined();
    });
    expect(callFor(stub.spy, '/download')!.url).toBe(
      `${API}/api/v1/submissions/SUB-000001-AAAAAA/download`,
    );
    // The stub deliberately has no `blob()`, so the save path fails — and the failure has to be
    // reported to the student rather than leaving a silently dead button.
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it('copies the submission id to the clipboard and confirms it inline', async () => {
    const user = userEvent.setup();

    const { container } = render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await screen.findByText('SUB-000001-AAAAAA');

    const copyButton = screen.getByTitle(/Sao chép mã bài nộp để phúc khảo/i);
    await user.click(copyButton);

    // The id the student would otherwise have to retype into the appeal form.
    expect(await clipboardText()).toBe('SUB-000001-AAAAAA');
    // The copy icon swaps for a check mark to confirm the action.
    expect(container.querySelector('button[title*="Sao chép"] svg')).toBeTruthy();
  });

  it('survives a failing submission endpoint', async () => {
    stub.restore();
    stub = installFetchStub({ defaultStatus: 500, defaultBody: { message: 'lỗi' } });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    // The student-scoped query AND the `limit=20` fallback both fail: the honest answer is the
    // empty state, not a crash and not fabricated history.
    await waitFor(() =>
      expect(screen.getByText(/Bạn chưa có bài nộp nào/i)).toBeInTheDocument(),
    );
  });

  it('survives a failing appeals endpoint without losing the submissions', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', status: 500, body: { message: 'lỗi' } }] });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText('SUB-000001-AAAAAA')).toBeInTheDocument();
    expect(screen.queryByText(/Thông Tin Phúc Khảo Bài Nộp/i)).not.toBeInTheDocument();
  });

  it('shows a queued submission as still being graded', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions',
          body: {
            statusCode: 200,
            total: 1,
            data: [
              {
                submissionId: 'SUB-QUEUED-01',
                studentId: 'SE170000',
                assignmentId: 'ASM-SWP391-01',
                language: 'cpp',
                fileName: 'main.cpp',
                status: 'QUEUED',
                createdAt: '2026-10-19T10:00:00.000Z',
              },
            ],
          },
        },
        { match: '/api/v1/appeals', body: { statusCode: 200, data: [] } },
      ],
    });

    render(<StudentHistoryView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/ĐANG CHẤM/)).toBeInTheDocument();
    expect(screen.getByText('Chờ chấm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phúc khảo bài này \(0\/2 lượt\)/i })).toBeEnabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LecturerAppealsManager — the lecturer's appeal inbox and resolution screen
// ─────────────────────────────────────────────────────────────────────────────

describe('LecturerAppealsManager', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('loads the appeal inbox', async () => {
    render(<LecturerAppealsManager />);

    await waitFor(() => expect(callFor(stub.spy, '/api/v1/appeals')).toBeDefined());
    expect(callFor(stub.spy, '/api/v1/appeals')!.url).toBe(`${API}/api/v1/appeals`);
  });

  it('renders one row per appeal with its reason and status', async () => {
    render(<LecturerAppealsManager />);

    expect(await screen.findByText('#APL-000001')).toBeInTheDocument();
    expect(screen.getByText('SE170000')).toBeInTheDocument();
    expect(screen.getByText('SUB-000001-AAAAAA')).toBeInTheDocument();
    expect(screen.getByText(AppealFixture.reason)).toBeInTheDocument();
    expect(screen.getByText('CHỜ DUYỆT')).toBeInTheDocument();
  });

  it('counts each status on the filter tabs', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({ appealId: 'APL-A', status: 'PENDING' }),
              makeAppeal({ appealId: 'APL-B', status: 'ACCEPTED', adjustedScore: 9 }),
              makeAppeal({ appealId: 'APL-C', status: 'REJECTED' }),
            ],
          },
        },
      ],
    });

    render(<LecturerAppealsManager />);

    expect(await screen.findByRole('button', { name: /Tất Cả \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chờ Duyệt \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đã Chấp Thuận \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đã Từ Chối \(1\)/i })).toBeInTheDocument();
  });

  it('filters the table by status', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({ appealId: 'APL-PENDING', status: 'PENDING' }),
              makeAppeal({ appealId: 'APL-REJECTED', status: 'REJECTED' }),
            ],
          },
        },
      ],
    });
    const user = userEvent.setup();

    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-PENDING');

    await user.click(screen.getByRole('button', { name: /Đã Từ Chối \(1\)/i }));

    expect(screen.getByText('#APL-REJECTED')).toBeInTheDocument();
    expect(screen.queryByText('#APL-PENDING')).not.toBeInTheDocument();
  });

  it('renders an empty state when the inbox has no appeals', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200, data: [] } }] });

    render(<LecturerAppealsManager />);

    expect(
      await screen.findByText(/Không có đơn phúc khảo nào trong danh mục này\./i),
    ).toBeInTheDocument();
  });

  it('renders an empty state when the gateway is offline', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', status: 503, body: { message: 'offline' } }] });

    render(<LecturerAppealsManager />);

    // No fabricated demo appeals: an unreachable gateway must look empty, not populated.
    expect(
      await screen.findByText(/Không có đơn phúc khảo nào trong danh mục này\./i),
    ).toBeInTheDocument();
  });

  it('reloads the inbox when "Làm mới" is pressed', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');

    const before = stub.spy.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /Làm mới/i }));

    await waitFor(() => expect(stub.spy.mock.calls.length).toBeGreaterThan(before));
  });

  // ── The audit modal ───────────────────────────────────────────────────────

  it('opens the audit dossier for a pending appeal', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');

    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));

    expect(await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Thẩm Định Đơn Phúc Khảo #APL-000001/ })).toBeInTheDocument();
    expect(screen.getByText(/LÝ DO & NGUYỆN VỌNG CỦA SINH VIÊN:/i)).toBeInTheDocument();
    expect(screen.getByText(`"${AppealFixture.reason}"`)).toBeInTheDocument();
  });

  it('labels a decided appeal with "Xem Chi Tiết" and reopens its note', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/appeals',
          body: {
            statusCode: 200,
            data: [
              makeAppeal({
                status: 'ACCEPTED',
                adjustedScore: 9,
                reviewerId: 'GV0001',
                resolutionNote: 'Đã cộng 1.0 điểm cho testcase 2.',
              }),
            ],
          },
        },
      ],
    });
    const user = userEvent.setup();

    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    expect(screen.getByText('ĐÃ DUYỆT (9đ)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Xem Chi Tiết/i }));

    // The appeal id appears both in the table row and in the modal heading, so match the heading.
    expect(
      await screen.findByRole('heading', { name: /Thẩm Định Đơn Phúc Khảo #APL-000001/i }),
    ).toBeInTheDocument();
    expect((noteBox() as HTMLTextAreaElement).value).toBe('Đã cộng 1.0 điểm cho testcase 2.');
  });

  it('fetches the submission under audit and renders the real AI rating', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions/SUB-000001-AAAAAA',
          body: {
            statusCode: 200,
            data: {
              submissionId: 'SUB-000001-AAAAAA',
              score: 7.5,
              details: {
                passedTestcases: 2,
                totalTestcases: 3,
                aiRating: {
                  cleanCodeScore: 6.5,
                  solidScore: { s: 6, o: 7, l: 6, i: 8, d: 7 },
                  explanation: 'Cần tách hàm xử lý I/O ra khỏi thuật toán.',
                  codeSmells: [{ line: 3, rule: 'SRP', description: 'Hàm làm quá nhiều việc.' }],
                },
              },
            },
          },
        },
      ],
    });
    const user = userEvent.setup();

    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));

    await waitFor(() => {
      expect(callFor(stub.spy, '/api/v1/submissions/SUB-000001-AAAAAA')).toBeDefined();
    });
    expect(await screen.findByText('7.5 / 10.0')).toBeInTheDocument();
    // Passed/total from the real submission detail, not the bundled 2/2 fallback.
    expect(
      await screen.findByRole('button', { name: /2\. Test Cases & Môi Trường Cách Ly \(2\/3\)/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /3\. AI Đánh Giá & SOLID/i }));
    expect(await screen.findByText('Cần tách hàm xử lý I/O ra khỏi thuật toán.')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText(/Dòng 3: SRP/)).toBeInTheDocument();
    expect(screen.getByText(/Hàm làm quá nhiều việc\./)).toBeInTheDocument();
  });

  it('walks all four audit tabs', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    // Tab 1 — source code, plus the zip download link for the raw submission.
    expect(screen.getByText(/Solution\.java/)).toBeInTheDocument();
    const download = screen.getByRole('link', { name: /Tải file \.zip gốc/i });
    // Absolute URL built from the default apiBaseUrl, pointing at the download endpoint the
    // gateway exposes for the submission under audit.
    expect(download).toHaveAttribute(
      'href',
      `${API}/api/v1/submissions/SUB-000001-AAAAAA/download`,
    );

    // Tab 2 — testcases in the sandbox.
    await user.click(screen.getByRole('button', { name: /2\. Test Cases & Môi Trường Cách Ly/i }));
    expect(await screen.findByText('TC-01')).toBeInTheDocument();
    expect(screen.getByText('TC-02')).toBeInTheDocument();
    expect(screen.getByText(/Cách ly hoàn toàn \(cgroups v2\)/i)).toBeInTheDocument();

    // Tab 3 — AI review and SOLID breakdown.
    await user.click(screen.getByRole('button', { name: /3\. AI Đánh Giá & SOLID/i }));
    expect(await screen.findByText(/Nhận xét sư phạm từ Trợ lý AI:/i)).toBeInTheDocument();
    expect(screen.getByText('S - Đơn Trách Nhiệm')).toBeInTheDocument();

    // Tab 4 — plagiarism.
    await user.click(screen.getByRole('button', { name: /4\. Kiểm Tra Đạo Văn/i }));
    expect(await screen.findByText(/KẾT LUẬN LIÊM CHÍNH HỌC THUẬT:/i)).toBeInTheDocument();
  });

  it('copies the source code to the clipboard', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    // The copy button holds the source code of the submission under audit.
    await user.click(screen.getByRole('button', { name: /Sao chép mã/i }));

    const copied = await clipboardText();
    expect(copied).toContain('quickSort');
    expect(copied).toContain('MA NGUON NOP BAI: SUB-000001-AAAAAA');
    // The button confirms in place rather than leaving the lecturer guessing.
    expect(await screen.findByRole('button', { name: /Đã sao chép/i })).toBeInTheDocument();
  });

  it('closes the audit modal with the X button', async () => {
    const user = userEvent.setup();
    const { container } = render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    await user.keyboard('{Escape}').catch(() => {});
    await user.click(screen.getByRole('button', { name: /Đóng \/ Hủy/i }));
    await waitFor(() => expect(container.querySelector('h3')).toBeNull());
  });

  // ── Resolution ────────────────────────────────────────────────────────────

  it('resolves an appeal with PUT /api/v1/appeals/:id/resolve', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager lecturerId="GV0001" />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    const note = 'Đã đối chiếu mã nguồn và chạy lại testcase 2; chấp thuận cộng điểm.';
    await user.type(noteBox(), note);
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    await waitFor(() => {
      expect(callFor(stub.spy, '/resolve')).toBeDefined();
    });

    const put = stub.spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
    expect(put, 'resolving must use PUT, matching AppealsController').toBeDefined();
    expect(String(put![0])).toBe(`${API}/api/v1/appeals/APL-000001/resolve`);
    expect(bodyOf(put![1] as RequestInit)).toEqual({
      status: 'ACCEPTED',
      reviewerId: 'GV0001',
      resolutionNote: note,
      adjustedScore: 9,
    });
  });

  it('defaults the reviewer decision to ACCEPTED with the score box visible', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    expect(screen.getByText(/Điểm số điều chỉnh sau phúc khảo/i)).toBeInTheDocument();
    const scoreInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(scoreInput.value).toBe('9');
  });

  it('omits the adjusted score when the appeal is rejected', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    await user.click(screen.getByRole('button', { name: /Từ Chối Khiếu Nại \(Giữ Nguyên Điểm Gốc\)/i }));
    // The score box is gone: a rejection carries no adjusted score at all.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    const note = 'Bài nộp đúng như kết quả chấm, không đủ căn cứ điều chỉnh.';
    await user.type(noteBox(), note);
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    await waitFor(() => expect(callFor(stub.spy, '/resolve')).toBeDefined());
    const put = stub.spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')!;
    const body = bodyOf(put[1] as RequestInit);
    expect(body.status).toBe('REJECTED');
    expect(body.resolutionNote).toBe(note);
    // JSON.stringify drops `undefined`, so the key is simply absent — which is what the
    // gateway DTO expects for @IsOptional() adjustedScore.
    expect('adjustedScore' in body).toBe(false);
  });

  it('sends the adjusted score the lecturer typed', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    const scoreInput = screen.getByRole('spinbutton');
    await user.clear(scoreInput);
    await user.type(scoreInput, '7.5');
    await user.type(noteBox(), 'Chấm lại và điều chỉnh lên 7.5 điểm.');
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    await waitFor(() => expect(callFor(stub.spy, '/resolve')).toBeDefined());
    const put = stub.spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')!;
    expect(bodyOf(put[1] as RequestInit).adjustedScore).toBe(7.5);
  });

  it('refuses to resolve without a resolution note', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringMatching(/tối thiểu 5 ký tự/i),
    );
    expect(stub.spy.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(
      false,
    );
    alertSpy.mockRestore();
  });

  it('refuses to resolve when the resolution note is too short', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    await user.type(noteBox(), 'ok');
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    expect(alertSpy).toHaveBeenCalled();
    expect(stub.spy.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(
      false,
    );
    alertSpy.mockRestore();
  });

  it('confirms a successful resolution and refreshes the inbox', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    const before = stub.spy.mock.calls.filter((c) => String(c[0]).endsWith('/api/v1/appeals')).length;
    await user.type(noteBox(), 'Đồng ý điều chỉnh điểm cho sinh viên.');
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    expect(
      await screen.findByText(/Đã xử lý thành công đơn phúc khảo #APL-000001/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      const after = stub.spy.mock.calls.filter((c) => String(c[0]).endsWith('/api/v1/appeals')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('surfaces the gateway error message when the resolution is rejected', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    stub.spy.mockImplementation(
      resolveRoute(400, { message: 'Điểm điều chỉnh phải nằm trong khoảng 0 - 10' }),
    );

    await user.type(noteBox(), 'Thử lưu quyết định với điểm sai.');
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Điểm điều chỉnh phải nằm trong khoảng 0 - 10'),
    );
    // The modal stays open so the lecturer can correct the score.
    expect(screen.getByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ')).toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('falls back to a local update when the resolve request throws', async () => {
    const user = userEvent.setup();
    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));
    await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ');

    stub.spy.mockImplementation(async (input: any) => {
      if (String(input).includes('/resolve')) throw new TypeError('Failed to fetch');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ statusCode: 200, data: [] }),
        text: async () => '{}',
        clone() { return this; },
      } as any;
    });

    await user.type(noteBox(), 'Mạng lỗi, lưu tạm quyết định tại chỗ.');
    await user.click(screen.getByRole('button', { name: /Xác Nhận Quyết Định Phúc Khảo/i }));

    expect(
      await screen.findByText(/Đã cập nhật quyết định phúc khảo đơn #APL-000001/i),
    ).toBeInTheDocument();
  });

  it('tolerates a submission detail endpoint that fails', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/submissions/', status: 404, body: { message: 'không thấy' } }],
    });
    const user = userEvent.setup();

    render(<LecturerAppealsManager />);
    await screen.findByText('#APL-000001');
    await user.click(screen.getByRole('button', { name: /Thẩm Định & Xử Lý/i }));

    // The dossier still opens using the bundled audit fallback rather than crashing.
    expect(await screen.findByText('HỒ SƠ PHÚC KHẢO ĐIỆN TỬ')).toBeInTheDocument();
    expect(screen.getByText(/6\.5 \/ 10\.0/)).toBeInTheDocument();
  });
});
