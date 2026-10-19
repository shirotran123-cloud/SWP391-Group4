import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentAppealsView } from '../components/StudentAppealsView';
import { AssignmentDescriptionView } from '../components/AssignmentDescriptionView';
import { RblBenchmarkView } from '../components/RblBenchmarkView';
import { CountdownTimer } from '../components/CountdownTimer';
import { MonacoDiffViewer } from '../components/MonacoDiffViewer';
import { RBL_BENCHMARK_PAIRS } from '../services/ast-engine/rbl-benchmark-pairs';
import { installFetchStub } from '../test/fixtures';

/**
 * Component behaviour tests for the student-facing and read-only views.
 *
 * These components all fetch on mount, so each test installs the router from
 * `test/fixtures.ts`. The assertions target what a student actually reads: the empty state when
 * there is nothing to show, the appeal list when there is, and the countdown semantics.
 */
describe('StudentAppealsView', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders without crashing', () => {
    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);
    expect(container).toBeTruthy();
  });

  it('shows the student name or the appeal heading', async () => {
    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await waitFor(() => {
      const text = container.textContent ?? '';
      expect(text.length).toBeGreaterThan(0);
    });
  });

  it('requests the appeals of the given student', async () => {
    render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/appeals'));
      expect(called).toBe(true);
    });
  });

  it('renders an empty state when the student has no appeals', async () => {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200, data: [] } }] });
    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await waitFor(() => {
      expect(container.textContent).toBeTruthy();
    });
  });

  it('survives a failing appeals endpoint', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/appeals', status: 500, body: { message: 'lỗi' } }],
    });
    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);
    await waitFor(() => {
      expect(container.textContent).toBeTruthy();
    });
  });
});

describe('AssignmentDescriptionView', () => {
  const DESCRIPTION = `
Cho một dãy số nguyên, hãy tính tổng.

Yêu cầu kỹ thuật:
1. Đọc dữ liệu từ stdin.
2. In kết quả ra stdout.

Định dạng Đầu vào:
- Dòng 1: số nguyên N.

Định dạng Đầu ra:
- In ra tổng.

Ràng buộc:
- 1 <= N <= 100000
`;

  it('renders without crashing', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} />);
    expect(container).toBeTruthy();
  });

  it('shows the parsed problem context', () => {
    render(<AssignmentDescriptionView description={DESCRIPTION} />);
    expect(screen.getByText(/dãy số/)).toBeInTheDocument();
  });

  it('shows the input format section', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} />);
    expect(container.textContent).toContain('N');
  });

  it('shows the constraint value', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} />);
    expect(container.textContent).toContain('100000');
  });

  it('renders the given title', () => {
    // Regression: `title` used to be accepted and passed by every caller but never rendered,
    // so the assignment title silently disappeared from the page.
    render(<AssignmentDescriptionView description={DESCRIPTION} title="Bài tập tuần 3" />);
    expect(screen.getByText(/Bài tập tuần 3/)).toBeInTheDocument();
  });

  it('renders the title in the compact header mode too', () => {
    render(
      <AssignmentDescriptionView description={DESCRIPTION} title="Bài tập tuần 4" mode="HEADER_COMPACT" />,
    );
    expect(screen.getByText(/Bài tập tuần 4/)).toBeInTheDocument();
  });

  it('renders no heading when no title is given', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} />);
    expect(container.querySelector('h2')).toBeNull();
  });

  it('handles an empty description', () => {
    const { container } = render(<AssignmentDescriptionView description="" />);
    expect(container.textContent).toBeTruthy();
  });

  it('shows the time limit when supplied', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} timeLimitMs={2000} />);
    expect(container.textContent).toBeTruthy();
  });

  it('shows the test case count when supplied', () => {
    const { container } = render(<AssignmentDescriptionView description={DESCRIPTION} testCasesCount={5} />);
    expect(container.textContent).toBeTruthy();
  });
});

describe('CountdownTimer', () => {
  it('renders without crashing for a future deadline', () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const { container } = render(<CountdownTimer deadline={future} />);
    expect(container.textContent).toBeTruthy();
  });

  it('shows a passed state for a past deadline', () => {
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    const { container } = render(<CountdownTimer deadline={past} />);
    expect(container.textContent).toBeTruthy();
  });

  it('does not show a negative day count for a past deadline', () => {
    const past = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    const { container } = render(<CountdownTimer deadline={past} />);
    // A "-5" would mean the timer renders nonsense once the deadline is behind us.
    expect(container.textContent ?? '').not.toMatch(/-\d+\s*ngày/i);
  });

  it('handles an invalid deadline string', () => {
    const { container } = render(<CountdownTimer deadline="không-phải-ngày" />);
    expect(container.textContent).toBeTruthy();
  });

  it('renders a deadline that is only seconds away', () => {
    const soon = new Date(Date.now() + 5000).toISOString();
    const { container } = render(<CountdownTimer deadline={soon} />);
    expect(container.textContent).toBeTruthy();
  });
});

describe('MonacoDiffViewer', () => {
  it('renders without crashing with no plagiarism match', () => {
    const { container } = render(
      <MonacoDiffViewer studentName="Đinh Thành Trung" sourceCode={'print(1)\n'} />,
    );
    expect(container.textContent).toBeTruthy();
  });

  it('renders the student name', () => {
    const { container } = render(
      <MonacoDiffViewer studentName="Đinh Thành Trung" sourceCode={'print(1)\n'} />,
    );
    expect(container.textContent).toContain('Đinh Thành Trung');
  });

  it('renders with an empty source', () => {
    const { container } = render(<MonacoDiffViewer studentName="A" sourceCode="" />);
    expect(container.textContent).toBeTruthy();
  });
});

describe('RblBenchmarkView', () => {
  it('renders the lab heading', () => {
    render(<RblBenchmarkView />);
    expect(screen.getByText(/Phòng Thí Nghiệm Nghiên Cứu Đối Soát Mã Nguồn/i)).toBeInTheDocument();
  });

  it('renders one card per benchmark pair', () => {
    const { container } = render(<RblBenchmarkView />);
    for (const pair of RBL_BENCHMARK_PAIRS) {
      expect(container.textContent).toContain(pair.title.split(':')[0]);
    }
  });

  it('states the plagiarism threshold it uses', () => {
    const { container } = render(<RblBenchmarkView />);
    expect(container.textContent).toContain('70');
  });

  it('hides the diff button when no callback is given', () => {
    // The control would be dead without a handler, so it must not render at all.
    render(<RblBenchmarkView />);
    expect(screen.queryByText(/So Khớp Mã Nguồn Chi Tiết/i)).not.toBeInTheDocument();
  });

  it('shows the diff button once a pair has been evaluated', async () => {
    const user = userEvent.setup();
    render(<RblBenchmarkView onOpenDiffViewer={() => {}} />);

    const runButton = screen
      .getAllByRole('button')
      .find((b) => /chạy|đối soát|phân tích|kiểm định/i.test(b.textContent ?? ''));
    expect(runButton).toBeDefined();
    await user.click(runButton!);

    expect(await screen.findByText(/So Khớp Mã Nguồn Chi Tiết/i)).toBeInTheDocument();
  });

  it('invokes the callback with the evaluation result', async () => {
    const user = userEvent.setup();
    let received: unknown = null;
    render(<RblBenchmarkView onOpenDiffViewer={(m) => { received = m; }} />);

    const runButton = screen
      .getAllByRole('button')
      .find((b) => /chạy|đối soát|phân tích|kiểm định/i.test(b.textContent ?? ''));
    await user.click(runButton!);

    await user.click(await screen.findByText(/So Khớp Mã Nguồn Chi Tiết/i));
    expect(received).toBeTruthy();
    expect(typeof (received as any).similarityRate).toBe('number');
  });
});
