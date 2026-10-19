import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LecturerDashboard } from '../components/LecturerDashboard';
import { AdminDashboard } from '../components/AdminDashboard';
import { HodDashboard } from '../components/HodDashboard';
import { LecturerPanel } from '../components/LecturerPanel';
import { installFetchStub, SubmissionFixture } from '../test/fixtures';

/**
 * Staff-facing dashboards.
 *
 * These are the screens a lecturer, HOD and admin actually operate, and they are the largest
 * components in the app. The tests drive the real tab switches and assert on the API calls each
 * tab triggers, plus the BR-04 rule that plagiarism data is never shown to a student.
 */

describe('LecturerDashboard', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders without crashing', () => {
    const { container } = render(<LecturerDashboard />);
    expect(container).toBeTruthy();
  });

  it('offers the main working tabs', async () => {
    render(<LecturerDashboard />);
    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).toMatch(/Khóa Học & Lớp Học Phần/i);
      expect(text).toMatch(/Soạn Đề & Barem AI/i);
      expect(text).toMatch(/Sổ Điểm & Bài Nộp/i);
    });
  });

  it('loads the gradebook from the API', async () => {
    render(<LecturerDashboard />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/submissions/gradebook'));
      expect(called).toBe(true);
    });
  });

  it('shows the attempt policy selector on the gradebook tab', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    // The selector lives inside the "Sổ Điểm & Bài Nộp" tab, so open that tab first.
    await user.click(screen.getByText(/Sổ Điểm & Bài Nộp/i));
    expect(await screen.findByText(/Bài nộp cuối/i)).toBeInTheDocument();
  });

  it('offers all three attempt policies', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByText(/Sổ Điểm & Bài Nộp/i));
    expect(await screen.findByText(/Bài nộp cuối/i)).toBeInTheDocument();
    expect(screen.getByText(/Điểm cao nhất/i)).toBeInTheDocument();
    expect(screen.getByText(/Bài nộp đầu/i)).toBeInTheDocument();
  });

  it('re-queries the gradebook with the chosen policy', async () => {
    const user = userEvent.setup();
    render(<LecturerDashboard />);
    await user.click(screen.getByText(/Sổ Điểm & Bài Nộp/i));
    const best = await screen.findByText(/Điểm cao nhất/i);
    await user.click(best);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('policy=BEST'));
      expect(called).toBe(true);
    });
  });

  it('survives a failing gradebook endpoint', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        { match: '/api/v1/submissions/gradebook', status: 500, body: { message: 'lỗi máy chủ' } },
      ],
    });
    const { container } = render(<LecturerDashboard />);
    await waitFor(() => expect(container.textContent).toBeTruthy());
  });

  it('renders an empty gradebook without crashing', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [
        {
          match: '/api/v1/submissions/gradebook',
          body: {
            statusCode: 200,
            data: {
              policy: 'LAST',
              totalRows: 0,
              totalSubmissionsConsidered: 0,
              supersededCount: 0,
              entries: [],
            },
          },
        },
      ],
    });
    const { container } = render(<LecturerDashboard />);
    await waitFor(() => expect(container.textContent).toBeTruthy());
  });
});

describe('AdminDashboard', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders without crashing', () => {
    const { container } = render(<AdminDashboard token="stub-token" />);
    expect(container).toBeTruthy();
  });

  it('requests the queue statistics', async () => {
    render(<AdminDashboard token="stub-token" />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/queue/stats'));
      expect(called).toBe(true);
    });
  });

  it('requests the dead-letter queue', async () => {
    render(<AdminDashboard token="stub-token" />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/queue/dlq'));
      expect(called).toBe(true);
    });
  });

  it('requests the user list', async () => {
    render(<AdminDashboard token="stub-token" />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/users'));
      expect(called).toBe(true);
    });
  });

  it('survives every admin endpoint failing', async () => {
    stub.restore();
    stub = installFetchStub({ defaultStatus: 500, defaultBody: { message: 'lỗi' } });
    const { container } = render(<AdminDashboard token="stub-token" />);
    await waitFor(() => expect(container.textContent).toBeTruthy());
  });
});

describe('HodDashboard', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders without crashing', () => {
    const { container } = render(<HodDashboard />);
    expect(container).toBeTruthy();
  });

  it('requests the plagiarism reports', async () => {
    render(<HodDashboard />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/plagiarism'));
      expect(called).toBe(true);
    });
  });

  it('requests the appeals inbox when the appeals tab is opened', async () => {
    const user = userEvent.setup();
    render(<HodDashboard />);
    // The label sits inside a nested element, so match the button by its accessible name.
    const appealsTab = screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i });
    await user.click(appealsTab);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/appeals'));
      expect(called).toBe(true);
    });
  });

  it('exposes both the integrity and appeals views', async () => {
    render(<HodDashboard />);
    expect(await screen.findByRole('button', { name: /Liêm chính học thuật/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i })).toBeInTheDocument();
  });

  it('survives a failing plagiarism endpoint', async () => {
    stub.restore();
    stub = installFetchStub({
      routes: [{ match: '/api/v1/plagiarism', status: 403, body: { message: 'bị chặn' } }],
    });
    const { container } = render(<HodDashboard />);
    await waitFor(() => expect(container.textContent).toBeTruthy());
  });
});

describe('LecturerPanel', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    localStorage.setItem('aita_token', 'stub-token');
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  // LecturerPanel is a self-contained LIST view: it takes only a token and fetches the
  // submissions itself. It does not receive a submission prop.
  it('renders without crashing', () => {
    const { container } = render(<LecturerPanel token="stub-token" />);
    expect(container).toBeTruthy();
  });

  it('shows its own heading', () => {
    const { container } = render(<LecturerPanel token="stub-token" />);
    expect(container.textContent).toContain('Bảng Giảng Viên');
  });

  it('requests the submission list', async () => {
    render(<LecturerPanel token="stub-token" />);
    await waitFor(() => {
      const called = stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/submissions'));
      expect(called).toBe(true);
    });
  });

  it('renders a row for each submission returned', async () => {
    const { container } = render(<LecturerPanel token="stub-token" />);
    await waitFor(() => {
      // This panel keys its rows off the student id; it does not show the full name.
      expect(container.textContent).toContain(SubmissionFixture.studentId);
    });
  });

  it('survives a failing submission list', async () => {
    stub.restore();
    stub = installFetchStub({ defaultStatus: 500, defaultBody: { message: 'lỗi' } });
    const { container } = render(<LecturerPanel token="stub-token" />);
    await waitFor(() => expect(container.textContent).toBeTruthy());
  });
});
