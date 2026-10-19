import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SolidRadarChart } from '../components/SolidRadarChart';
import { StudentAppealsView } from '../components/StudentAppealsView';
import { GeminiAIService, isPureTextModel, pickBestTextModel } from '../services/gemini-ai.service';
import { parseAssignmentDescription } from '../utils/assignmentParser';
import { installFetchStub, AppealFixture } from '../test/fixtures';
import type { AIRating, Appeal } from '../types';

/**
 * Deep-coverage suite for the four weakest files in the frontend.
 *
 * The existing specs for these files (`SolidRadarChart.test.tsx`, `student-views.test.tsx`,
 * `gemini-ai.service.test.ts`, `assignmentParser.test.ts`) pin the happy path only. This file
 * adds the branches those specs never reach: the recharts tooltip renderer, the appeal status
 * badges and modal wiring, `pingKey` + the model-selection/retry loop of the Gemini service,
 * and the tag detector in the assignment parser.
 */

// ---------------------------------------------------------------------------------------------
// SolidRadarChart
// ---------------------------------------------------------------------------------------------

/**
 * recharts measures its parent through `getBoundingClientRect`, and jsdom returns a 400x300
 * box… except that `src/test/setup.ts` guards its stub with `if (!HTMLElement.prototype
 * .getBoundingClientRect)`, which is never true because jsdom *does* define the method — it just
 * returns all zeros. So under the shared setup the chart renders an empty container and no
 * `<svg>`, no axis ticks and no tooltip. Patching the prototype per test is the only way to make
 * recharts lay the chart out; `src/test/setup.ts` must not be edited, so it happens here.
 */
const CHART_BOX = {
  width: 400,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 400,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

const makeRating = (over: Partial<AIRating> = {}): AIRating => ({
  cleanCodeScore: 8.5,
  solidScore: { s: 9, o: 8, l: 8.5, i: 7.5, d: 8 },
  codeSmells: [],
  explanation: 'Mã nguồn rõ ràng.',
  ...over,
});

describe('SolidRadarChart – score grid and summary line', () => {
  it('prints every axis score to one decimal place', () => {
    const { container } = render(
      <SolidRadarChart rating={makeRating({ solidScore: { s: 1, o: 2.25, l: 3.5, i: 4.75, d: 5 } })} />,
    );
    const text = container.textContent ?? '';
    // Each tile shows the axis letter, the rounded score and the Vietnamese axis name.
    for (const expected of ['1.0', '2.3', '3.5', '4.8', '5.0']) {
      expect(text).toContain(expected);
    }
  });

  it('labels all five tiles with their Vietnamese SOLID axis name', () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    for (const label of [
      'S — Đơn trách nhiệm',
      'O — Mở / Đóng',
      'L — Thay thế Liskov',
      'I — Phân tách Interface',
      'D — Đảo ngược phụ thuộc',
    ]) {
      expect(container.querySelector(`[title="${label}"]`)).not.toBeNull();
    }
  });

  it('averages the five axes for the SOLID summary line', () => {
    const { container } = render(
      <SolidRadarChart rating={makeRating({ solidScore: { s: 10, o: 10, l: 10, i: 10, d: 10 } })} />,
    );
    expect(container.textContent).toContain('Điểm SOLID Trung Bình: 10.0/10');
  });

  it('reports an all-zero rating as 0.0 rather than NaN', () => {
    const { container } = render(
      <SolidRadarChart
        rating={makeRating({ cleanCodeScore: 0, solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 } })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Điểm mã nguồn sạch: 0/10');
    expect(text).toContain('Điểm SOLID Trung Bình: 0.0/10');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('keeps out-of-range input readable instead of throwing', () => {
    // The component does no clamping; the point is that a backend that sends 12.5 or -3 still
    // renders a number the lecturer can read rather than blank tiles.
    const { container } = render(
      <SolidRadarChart
        rating={makeRating({ cleanCodeScore: 12.5, solidScore: { s: -3, o: 100, l: 10.05, i: 0, d: 7 } })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('-3.0');
    expect(text).toContain('100.0');
    expect(text).toContain('10.1');
    expect(text).toContain('Điểm SOLID Trung Bình: 22.8/10');
  });

  it('renders a card even when the optional lists of the rating are empty', () => {
    // Branch coverage for "which optional props are present": an AIRating with no code smells and
    // an empty explanation must not add or remove DOM.
    const { container } = render(<SolidRadarChart rating={makeRating({ codeSmells: [], explanation: '' })} />);
    expect(container.textContent).toContain('Điểm mã nguồn sạch: 8.5/10');
    expect(container.textContent).not.toContain('undefined');
  });

  it('does not print a code-smell list of its own', () => {
    // The smells are reported by the reviewer panel, not by this figure: a regression that
    // started dumping them under the grid would duplicate the list on screen.
    const { container } = render(
      <SolidRadarChart
        rating={makeRating({
          codeSmells: [{ line: 12, rule: 'Phương thức quá dài', description: 'Nên tách nhỏ.' }],
        })}
      />,
    );
    expect(container.textContent).not.toContain('Phương thức quá dài');
  });
});

describe('SolidRadarChart – chart layer (real layout)', () => {
  let realGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = () => CHART_BOX;
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
  });

  /** Recharts only paints once its wrapper measures a non-zero box, which the patch above fakes. */
  const surface = (container: HTMLElement) => container.querySelector('svg.recharts-surface');

  const tooltipText = (container: HTMLElement) =>
    container.querySelector('.recharts-tooltip-wrapper')?.textContent ?? '';

  const hoverChart = async (container: HTMLElement) => {
    const svg = surface(container) as SVGSVGElement;
    expect(svg).not.toBeNull();
    (svg as any).getBoundingClientRect = () => CHART_BOX;
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 90 }));
    });
    await waitFor(() => {
      expect(tooltipText(container).length).toBeGreaterThan(0);
    });
    return tooltipText(container);
  };

  it('draws the radar surface, polar grid and all five axis labels', () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);

    expect(surface(container)).not.toBeNull();
    expect(container.querySelector('.recharts-polar-grid')).not.toBeNull();

    const axisLabels = Array.from(
      container.querySelectorAll('.recharts-polar-angle-axis-tick-value'),
    ).map((node) => node.textContent);
    expect(axisLabels).toEqual(['S · SRP', 'O · OCP', 'L · LSP', 'I · ISP', 'D · DIP']);
  });

  it('plots the five scores on the radar polygon', async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<SolidRadarChart rating={makeRating()} />);
      // recharts animates the radius in on mount, so the first paint is a degenerate path at the
      // centre (200,150) of the 400x300 surface; the vertices only spread out once it settles.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      const polygon = container.querySelector('.recharts-radar-polygon path.recharts-polygon');
      expect(polygon).not.toBeNull();
      const d = polygon!.getAttribute('d') ?? '';
      expect(d).toMatch(/^M[\d.,L\s]+Z$/);
      expect(d).not.toBe('M200,150L200,150L200,150L200,150L200,150L200,150Z');

      const vertices = d
        .replace(/^M/, '')
        .replace(/Z$/, '')
        .split('L')
        .map((pair) => pair.split(',').map(Number));
      expect(vertices).toHaveLength(6);
      // Five distinct axes plus the closing vertex; none of them may sit on the centre.
      expect(vertices.slice(0, 5).every(([x, y]) => x !== 200 || y !== 150)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains the active axis in the tooltip', async () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    const text = await hoverChart(container);

    // CustomSolidTooltip: subject, full description and the score out of ten.
    expect(text).toMatch(/[SOLID] · (SRP|OCP|LSP|ISP|DIP)/);
    expect(text).toMatch(/Responsibility|Open\/Closed|Liskov|Interface Segregation|Dependency Inversion/);
    expect(text).toMatch(/\d+(\.\d+)? \/ 10 điểm/);
  });

  it('shows the score of the axis under the pointer', async () => {
    const { container } = render(<SolidRadarChart rating={makeRating({ solidScore: { s: 1, o: 2, l: 3, i: 4, d: 5 } })} />);
    const text = await hoverChart(container);

    const score = Number(text.match(/(\d+) \/ 10 điểm/)?.[1]);
    expect([1, 2, 3, 4, 5]).toContain(score);
  });

  it('keeps the tooltip readable when an axis label is blank', async () => {
    // Regression guard for CustomSolidTooltip's `active && payload && payload.length` chain: a
    // rating whose data yields no axis text used to be the quickest way to make the tooltip throw
    // (payload[0] undefined). It must render the score line and nothing else.
    const { container } = render(
      <SolidRadarChart
        rating={makeRating({ solidScore: { s: 0, o: 0, l: 0, i: 0, d: 0 }, cleanCodeScore: 0 })}
      />,
    );
    const text = await hoverChart(container);

    expect(text).toContain('0 / 10 điểm');
    expect(text).not.toMatch(/undefined|NaN/);
  });
});

// ---------------------------------------------------------------------------------------------
// StudentAppealsView
// ---------------------------------------------------------------------------------------------

const appealOf = (over: Partial<Appeal>): Appeal => ({ ...AppealFixture, ...over }) as Appeal;

const appealRoutes = (appeals: Appeal[], status = 200) =>
  installFetchStub({ routes: [{ match: '/api/v1/appeals', status, body: { statusCode: status, data: appeals } }] });

describe('StudentAppealsView – list, statuses and answers', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders the empty state and the appeal counter when the student has no appeals', async () => {
    stub.restore();
    stub = appealRoutes([]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Bạn chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
    expect(container.textContent).toContain('Danh Sách Đơn Phúc Khảo Của Bạn (0)');
    expect(container.textContent).toContain('Tạo Đơn Phúc Khảo Mới');
  });

  it('treats a response with no `data` field as an empty list', async () => {
    // `json.data || []`: the gateway omits `data` entirely when a student has never appealed.
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200 } }] });

    render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Bạn chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
  });

  it('shows one card per appeal with its reason, submission and creation date', async () => {
    stub.restore();
    stub = appealRoutes([appealOf({ appealId: 'APL-000007', reason: 'Bài em chạy đúng testcase 2.' })]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(1\)/)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).toContain('#APL-000007');
    expect(text).toContain('Mã bài nộp: SUB-000001-AAAAAA');
    expect(text).toContain('Lý do khiếu nại: Bài em chạy đúng testcase 2.');
    expect(text).toContain('Ngày gửi:');
  });

  it('falls back to the row index when an appeal has no id', async () => {
    // `key={app.appealId || idx}` and the `#id` chip both tolerate a missing id.
    stub.restore();
    stub = appealRoutes([
      appealOf({ appealId: undefined as unknown as string, submissionId: 'SUB-A', reason: 'Thiếu mã đơn.' }),
      appealOf({ appealId: '', submissionId: 'SUB-B', reason: 'Mã đơn rỗng.' }),
    ]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(2\)/)).toBeInTheDocument();
    expect(container.textContent).toContain('Thiếu mã đơn.');
    expect(container.textContent).toContain('Mã đơn rỗng.');
  });

  it('renders a badge for each appeal status', async () => {
    stub.restore();
    stub = appealRoutes([
      appealOf({ appealId: 'A1', status: 'ACCEPTED', reason: 'Đã chấp thuận.' }),
      appealOf({ appealId: 'A2', status: 'REJECTED', reason: 'Đã từ chối.' }),
      appealOf({ appealId: 'A3', status: 'PENDING', reason: 'Đang chờ.' }),
      appealOf({ appealId: 'A4', status: 'IN_REVIEW', reason: 'Đang phúc tra.' }),
    ]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(4\)/)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).toContain('ĐÃ CHẤP THUẬN');
    expect(text).toContain('ĐÃ TỪ CHỐI');
    // PENDING and IN_REVIEW both fall through to the "waiting" badge.
    expect(text.match(/ĐANG CHỜ DUYỆT/g)).toHaveLength(2);
  });

  it('shows the reviewer answer, the adjusted score and the resolution date', async () => {
    stub.restore();
    stub = appealRoutes([
      appealOf({
        appealId: 'A1',
        status: 'ACCEPTED',
        reason: 'Điểm chưa đúng.',
        reviewerId: 'GV0001',
        resolutionNote: 'Đã chấm lại, cộng thêm 1.5 điểm.',
        adjustedScore: 9.5,
        resolvedAt: '2026-10-20T08:30:00.000Z',
      }),
      appealOf({
        appealId: 'A2',
        status: 'REJECTED',
        reason: 'Không đồng ý.',
        resolutionNote: 'Bài làm giữ nguyên điểm.',
      }),
    ]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(2\)/)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).toContain('Phản hồi từ Giảng viên (GV0001):');
    expect(text).toContain('Đã chấm lại, cộng thêm 1.5 điểm.');
    expect(text).toContain('Điểm số chính thức sau phúc khảo: 9.5 / 10.0');
    expect(text).toContain('Ngày giải quyết:');
    // Second appeal: no reviewerId -> generic label, no adjustedScore -> no score chip.
    expect(text).toContain('Phản hồi từ Giảng viên (Giảng viên phụ trách):');
    expect(text.match(/Điểm số chính thức sau phúc khảo/g)).toHaveLength(1);
  });

  it('omits the reviewer block entirely when there is no answer yet', async () => {
    stub.restore();
    stub = appealRoutes([appealOf({ appealId: 'A1', status: 'IN_REVIEW', resolutionNote: undefined })]);

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(1\)/)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toContain('Phản hồi từ Giảng viên');
    expect(text).not.toContain('Ngày giải quyết:');
  });

  it('sends the placeholder student id when none is given', async () => {
    // `studentId || 'SE170000'`: the gateway rejects an empty query value, so the fallback matters.
    stub.restore();
    stub = appealRoutes([]);

    render(<StudentAppealsView studentId="" studentName="Khách" apiBaseUrl="http://test.local" />);

    await waitFor(() => {
      expect(
        stub.spy.mock.calls.some((call) => String(call[0]).includes('studentId=SE170000')),
      ).toBe(true);
    });
    expect(String(stub.spy.mock.calls[0][0])).toContain('http://test.local/api/v1/appeals');
  });

  it('falls back to the empty state when the request itself fails', async () => {
    // The catch block used to fabricate a demo appeal; it must now clear the list instead.
    stub.restore();
    (globalThis as any).fetch = vi.fn(() => Promise.reject(new Error('mất kết nối')));

    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Bạn chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain('APL-001-DEMO');
  });

  it('falls back to the empty state on a 500 response', async () => {
    stub.restore();
    stub = appealRoutes([], 500);

    render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Bạn chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
  });

  it('re-fetches when "Làm mới" is pressed', async () => {
    const user = userEvent.setup();
    render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(1\)/)).toBeInTheDocument();
    const before = stub.spy.mock.calls.filter((call) => String(call[0]).includes('/api/v1/appeals')).length;

    await user.click(screen.getByRole('button', { name: /Làm mới/i }));

    await waitFor(() => {
      const after = stub.spy.mock.calls.filter((call) => String(call[0]).includes('/api/v1/appeals')).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('opens the appeal form and re-fetches when it is closed again', async () => {
    const user = userEvent.setup();
    const { container } = render(<StudentAppealsView studentId="SE170000" studentName="Đinh Thành Trung" />);

    expect(await screen.findByText(/Danh Sách Đơn Phúc Khảo Của Bạn \(1\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tạo Đơn Phúc Khảo Mới/i }));
    expect(await screen.findByText('Đơn Khiếu Nại & Phúc Khảo Điểm')).toBeInTheDocument();
    // The modal is handed the current score so the student can see what is being disputed.
    expect(screen.getByText(/8\.0 \/ 10\.0/)).toBeInTheDocument();

    const callsWhileOpen = stub.spy.mock.calls.length;
    const closeIcon = container.querySelector('svg.lucide-x');
    expect(closeIcon).not.toBeNull();
    await user.click(closeIcon!.closest('button')!);

    await waitFor(() => {
      expect(screen.queryByText('Đơn Khiếu Nại & Phúc Khảo Điểm')).not.toBeInTheDocument();
    });
    // onClose closes the modal and refreshes the list in one go.
    await waitFor(() => {
      expect(stub.spy.mock.calls.length).toBeGreaterThan(callsWhileOpen);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// gemini-ai.service
// ---------------------------------------------------------------------------------------------

type GeminiRoute = {
  match: string;
  status?: number;
  statusText?: string;
  body?: unknown;
  /** Overrides the serialised `text()` body, for malformed-JSON cases. */
  rawText?: string;
  /** Makes the request reject instead of resolving. */
  reject?: unknown;
};

/**
 * A tiny router for `globalThis.fetch` shaped like the Gemini REST API. `installFetchStub` cannot
 * express a `statusText` or a rejecting request, and the service reads both.
 */
function stubGeminiFetch(routes: GeminiRoute[]) {
  const spy = vi.fn(async (input: unknown, init?: { signal?: AbortSignal }) => {
    const url = String(input);
    for (const route of routes) {
      if (!url.includes(route.match)) continue;
      if ('reject' in route) throw route.reject;
      const status = route.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: route.statusText ?? '',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => route.body,
        text: async () => (route.rawText !== undefined ? route.rawText : JSON.stringify(route.body ?? {})),
        clone() {
          return this;
        },
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: '',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      text: async () => '{}',
      clone() {
        return this;
      },
    } as unknown as Response;
  });
  (globalThis as any).fetch = spy;
  return spy;
}

const textModel = (name: string) => ({ name, supportedGenerationMethods: ['generateContent'] });

/** A well-formed `generateContent` reply carrying `text` as the model's message. */
const geminiReply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

const EXAM = {
  title: 'Đề kiểm thử',
  description: 'Mô tả đề.',
  timeLimitMs: 3000,
  memoryLimitMb: 256,
  testCases: [{ input: '1 2', output: '3', weight: 2, isHidden: true }],
  rubric: [{ criterion: 'Đúng', maxScore: 10, description: 'ok' }],
  starterCode: '// start',
  referenceSolution: '// ref',
};

const GENERATE = ':generateContent';
const LIST = '/v1beta/models?key=';

const generateCalls = (spy: ReturnType<typeof stubGeminiFetch>) =>
  spy.mock.calls.filter((call) => String(call[0]).includes(GENERATE));

const listCalls = (spy: ReturnType<typeof stubGeminiFetch>) =>
  spy.mock.calls.filter((call) => String(call[0]).includes(LIST));

const assignmentOptions = (over: Record<string, unknown> = {}) => ({
  courseName: 'Dự án Phần mềm',
  courseCode: 'SWP391',
  topicPrompt: 'sắp xếp',
  ...over,
});

describe('gemini-ai.service – model filtering helpers', () => {
  it('rejects an object whose only generation method is embedding', () => {
    expect(isPureTextModel(textModel('models/gemini-embedding-001'))).toBe(false);
    expect(
      isPureTextModel({ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['embedContent'] }),
    ).toBe(false);
  });

  it('accepts an object that advertises generateContent', () => {
    expect(
      isPureTextModel({ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }),
    ).toBe(true);
  });

  it('rejects an object with no usable name', () => {
    // `modelItem.name || ''` — an entry from ListModels without a name is not a text model.
    expect(isPureTextModel({ supportedGenerationMethods: ['generateContent'] })).toBe(false);
    expect(isPureTextModel({ name: '', supportedGenerationMethods: ['generateContent'] })).toBe(false);
  });

  it('falls back to the name check when the entry has no method list', () => {
    expect(isPureTextModel({ name: 'models/gemini-1.5-flash' })).toBe(true);
    expect(isPureTextModel({ name: 'models/text-embedding-004' })).toBe(false);
  });

  it('prefers whichever model advertises "flash" when none is in the priority list', () => {
    expect(pickBestTextModel(['gemini-3-ultra', 'gemini-3-flash-preview'])).toBe('gemini-3-flash-preview');
  });

  it('returns the first pure-text model when nothing matches at all', () => {
    expect(pickBestTextModel(['gemini-3-ultra', 'gemini-3-nano'])).toBe('gemini-3-ultra');
  });

  it('drops the models/ prefix before comparing', () => {
    expect(pickBestTextModel(['models/gemini-2.0-flash-lite', 'models/gemini-1.5-pro'])).toBe(
      'gemini-2.0-flash-lite',
    );
  });
});

describe('GeminiAIService.pingKey', () => {
  let realFetch: typeof globalThis.fetch;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    warn.mockRestore();
  });

  it('refuses an empty key without touching the network', async () => {
    const spy = stubGeminiFetch([]);

    const result = await GeminiAIService.pingKey('   ');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Khóa API Key không được để trống.');
    expect(result.latencyMs).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports the text models Google grants and honours the requested one', async () => {
    stubGeminiFetch([
      {
        match: LIST,
        body: {
          models: [
            { name: 'models/gemini-2.0-flash-tts', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            textModel('models/gemini-2.0-flash'),
            textModel('models/gemini-1.5-pro'),
          ],
        },
      },
    ]);

    const result = await GeminiAIService.pingKey('  key-123  ', 'models/gemini-1.5-pro');

    expect(result.success).toBe(true);
    expect(result.availableModels).toEqual(['gemini-2.0-flash', 'gemini-1.5-pro']);
    expect(result.message).toContain('Tìm thấy 2 mô hình văn bản khả dụng');
    expect(result.message).toContain('Mô hình đề xuất: gemini-1.5-pro');
  });

  it('picks the fastest model when the requested one is unavailable', async () => {
    stubGeminiFetch([
      {
        match: LIST,
        body: { models: [textModel('models/gemini-1.5-pro'), textModel('models/gemini-2.0-flash')] },
      },
    ]);

    const result = await GeminiAIService.pingKey('key-123', 'gemini-9-imaginary');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Mô hình đề xuất: gemini-2.0-flash');
  });

  it('picks the fastest model when no model is requested at all', async () => {
    stubGeminiFetch([{ match: LIST, body: { models: [textModel('models/gemini-1.5-pro')] } }]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Mô hình đề xuất: gemini-1.5-pro');
  });

  it('tolerates a ListModels entry that is a bare name instead of an object', async () => {
    // Google always answers with objects, but `isPureTextModel` accepts a bare string too, so the
    // `(m.name || '')` guard has to survive one. The usable model must still be the suggestion.
    stubGeminiFetch([
      {
        match: LIST,
        body: { models: ['gemini-2.0-flash', textModel('models/gemini-1.5-pro')] },
      },
    ]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Mô hình đề xuất: gemini-1.5-pro');
  });

  it('strips an unprefixed model name returned by ListModels', async () => {
    stubGeminiFetch([{ match: LIST, body: { models: [textModel('gemini-2.0-flash')] } }]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(true);
    expect(result.availableModels).toEqual(['gemini-2.0-flash']);
  });

  it('refuses a key that only unlocks audio models', async () => {
    stubGeminiFetch([
      {
        match: LIST,
        body: {
          models: [
            textModel('models/gemini-2.5-flash-preview-tts'),
            { name: 'models/imagen-3.0', supportedGenerationMethods: ['generateContent'] },
          ],
        },
      },
    ]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(false);
    expect(result.message).toContain('chưa cấp quyền mô hình văn bản');
    expect(result.availableModels).toBeUndefined();
  });

  it('refuses a key when Google returns no model list at all', async () => {
    stubGeminiFetch([{ match: LIST, body: { statusCode: 200 } }]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(false);
    expect(result.message).toContain('chưa cấp quyền mô hình văn bản');
  });

  it('surfaces the Google error message for a rejected key', async () => {
    stubGeminiFetch([
      {
        match: LIST,
        status: 403,
        statusText: 'Forbidden',
        body: { error: { message: 'API key not valid. Please pass a valid API key.' } },
      },
    ]);

    const result = await GeminiAIService.pingKey('bad-key');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Lỗi kết nối (403): API key not valid. Please pass a valid API key.');
  });

  it('falls back to the status text when the error body is not a Google error', async () => {
    stubGeminiFetch([
      { match: LIST, status: 500, statusText: 'Internal Server Error', body: { message: 'không rõ' } },
    ]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Lỗi kết nối (500): Internal Server Error');
  });

  it('reports a transport failure without throwing', async () => {
    stubGeminiFetch([{ match: LIST, reject: new Error('getaddrinfo ENOTFOUND') }]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Lỗi kết nối: getaddrinfo ENOTFOUND');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('uses a generic message when the failure carries no message', async () => {
    stubGeminiFetch([{ match: LIST, reject: 'boom' }]);

    const result = await GeminiAIService.pingKey('key-123');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Lỗi kết nối: Không thể gửi yêu cầu tới máy chủ Google');
  });
});

describe('GeminiAIService.generateAssignment – model selection', () => {
  let realFetch: typeof globalThis.fetch;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    warn.mockRestore();
  });

  it('uses the model the lecturer asked for when Google lists it', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-1.5-pro'), textModel('models/gemini-2.0-flash')] } },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'gemini-1.5-pro' }),
    );

    expect(result.modelUsed).toBe('gemini-1.5-pro');
    expect(result.title).toBe('Đề kiểm thử');
    expect(result.isFallback).toBe(false);
  });

  it('accepts a requested model written with the models/ prefix', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash'), textModel('models/gemini-1.5-pro')] } },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'models/gemini-1.5-pro' }),
    );

    expect(result.modelUsed).toBe('gemini-1.5-pro');
  });

  it('ignores a requested model that Google did not list', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'gemini-9-ultra' }),
    );

    expect(result.modelUsed).toBe('gemini-2.0-flash');
  });

  it('ignores a requested model that is not a text model', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-1.5-pro')] } },
    ]);

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions({ model: 'gpt-4o' }));

    expect(result.modelUsed).toBe('gemini-1.5-pro');
  });

  it('appends the built-in fallbacks when Google lists an unknown model', async () => {
    // Google answered, so the `else` branch runs; the unfamiliar model becomes the primary
    // choice and every built-in fallback has to be queued behind it.
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-9-experimental')] } },
    ]);

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.modelUsed).toBe('gemini-9-experimental');
    expect(generateCalls(spy)).toHaveLength(1);
  });

  it('uses a text model that ListModels returned without the models/ prefix', async () => {
    // `availableFromGoogle.find(...) || availableFromGoogle[0]` picks the entry that carries the
    // prefix; an unprefixed name is only reachable through that `||` fallback.
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('gemini-2.5-pro')] } },
    ]);

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.modelUsed).toBe('gemini-2.5-pro');
    // The endpoint still gets the prefix the REST API requires.
    expect(String(generateCalls(spy)[0][0])).toContain('/v1beta/models/gemini-2.5-pro:generateContent');
  });

  it('falls back to the built-in list when ListModels itself fails, keeping the requested model', async () => {
    // A dead ListModels endpoint throws; only then is the warning logged. A non-ok *response* is
    // silently ignored by the service, which is a separate path.
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, reject: new Error('mạng không ổn định') },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'gemini-1.5-flash' }),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Không thể tự động liệt kê models'),
      expect.anything(),
    );
    expect(result.modelUsed).toBe('gemini-1.5-flash');
    expect(String(generateCalls(spy)[0][0])).toContain('/models/gemini-1.5-flash:generateContent');
  });

  it('falls back to the built-in list when ListModels answers with an error status', async () => {
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, status: 500, statusText: 'Internal Server Error', body: {} },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'gemini-1.5-flash' }),
    );

    expect(result.modelUsed).toBe('gemini-1.5-flash');
    expect(String(generateCalls(spy)[0][0])).toContain('/models/gemini-1.5-flash:generateContent');
  });

  it('keeps a requested model that already carries the models/ prefix', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, reject: new Error('offline') },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'models/gemini-1.5-pro' }),
    );

    expect(result.modelUsed).toBe('gemini-1.5-pro');
  });

  it('drops a requested model that is not a text model when falling back', async () => {
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, status: 503, body: {} },
    ]);

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ model: 'gemini-2.5-flash-preview-tts' }),
    );

    expect(result.modelUsed).toBe('gemini-2.0-flash');
    expect(String(generateCalls(spy)[0][0])).not.toContain('tts');
  });

  it('passes the lecturer brief, the language list and the testcase count into the prompt', async () => {
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({
        lecturerDescription: 'Bắt buộc dùng Dijkstra, sinh 7 test case.',
        allowedLanguages: ['python', 'cpp'],
      }),
    );

    const body = JSON.parse(String((generateCalls(spy)[0][1] as RequestInit).body));
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain('Bắt buộc dùng Dijkstra, sinh 7 test case.');
    expect(prompt).toContain('Ngôn ngữ cho phép: python, cpp');
    expect(prompt).toContain('Sinh ĐÚNG CHÍNH XÁC 7 bộ testcases');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('defaults to five testcases when nothing is requested', async () => {
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    const body = JSON.parse(String((generateCalls(spy)[0][1] as RequestInit).body));
    expect(body.contents[0].parts[0].text).toContain('Sinh ĐÚNG CHÍNH XÁC 5 bộ testcases');
  });

  it('honours an explicit numTestCases over the count written in the brief', async () => {
    const spy = stubGeminiFetch([
      { match: GENERATE, body: geminiReply(JSON.stringify(EXAM)) },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ lecturerDescription: 'sinh 9 testcase', numTestCases: 4 }),
    );

    const body = JSON.parse(String((generateCalls(spy)[0][1] as RequestInit).body));
    expect(body.contents[0].parts[0].text).toContain('Sinh ĐÚNG CHÍNH XÁC 4 bộ testcases');
  });
});

describe('GeminiAIService.generateAssignment – response handling', () => {
  let realFetch: typeof globalThis.fetch;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    warn.mockRestore();
  });

  const singleModelRoutes = (text: string): GeminiRoute[] => [
    { match: GENERATE, body: geminiReply(text) },
    { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
  ];

  it('unwraps a plain markdown fence', async () => {
    stubGeminiFetch(singleModelRoutes('```\n' + JSON.stringify(EXAM) + '\n```'));

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.title).toBe('Đề kiểm thử');
    expect(result.testCases).toHaveLength(1);
  });

  it('unwraps JSON that the model wrapped in prose', async () => {
    stubGeminiFetch(
      singleModelRoutes('Chào thầy, đây là đề bài ạ:\n' + JSON.stringify(EXAM) + '\nChúc thầy một ngày tốt lành.'),
    );

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.title).toBe('Đề kiểm thử');
    expect(result.rubric).toHaveLength(1);
  });

  it('keeps every field usable when the model answers with a bare JSON string', async () => {
    // No `{...}` to find, so the object-shape defaults have to carry the whole result.
    stubGeminiFetch(singleModelRoutes('"hello"'));

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.title).toBe('Bài Tập Lập Trình (SWP391)');
    expect(result.description).toBe('Đề bài được tạo bởi Google Gemini AI.');
    expect(result.timeLimitMs).toBe(2000);
    expect(result.memoryLimitMb).toBe(512);
    expect(result.testCases).toEqual([]);
    expect(result.rubric).toEqual([]);
    expect(result.starterCode).toBe('');
    expect(result.referenceSolution).toBe('');
    expect(result.modelUsed).toBe('gemini-2.0-flash');
  });

  it('normalises malformed test cases instead of failing the whole exam', async () => {
    stubGeminiFetch(
      singleModelRoutes(
        JSON.stringify({
          ...EXAM,
          testCases: [
            { output: '3' },
            {},
            { input: 'a', output: 'b', explanation: 'Biên cực tiểu N=1' },
            { input: 'c', output: 'd' },
            { input: 'e', output: 'f', weight: 0, isHidden: 1 },
          ],
          allowedLanguages: undefined,
        }),
      ),
    );

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.testCases).toHaveLength(5);
    expect(result.testCases[0]).toMatchObject({ input: '', output: '3', weight: 1.5, isHidden: false });
    expect(result.testCases[1]).toMatchObject({ input: '', output: '', weight: 2, isHidden: false });
    expect(result.testCases[1].explanation).toBeUndefined();
    expect(result.testCases[2].explanation).toBe('Biên cực tiểu N=1');
    expect(result.testCases[4].weight).toBe(2);
    expect(result.testCases[4].isHidden).toBe(true);
    expect(result.allowedLanguages).toEqual(['java', 'python', 'cpp']);
  });

  it('keeps the language list the lecturer chose', async () => {
    stubGeminiFetch(singleModelRoutes(JSON.stringify(EXAM)));

    const result = await GeminiAIService.generateAssignment(
      'key-123',
      assignmentOptions({ allowedLanguages: ['java'] }),
    );

    expect(result.allowedLanguages).toEqual(['java']);
  });

  it('stops after three models when every one of them fails', async () => {
    const spy = stubGeminiFetch([
      {
        match: LIST,
        body: {
          models: [
            textModel('models/gemini-2.0-flash'),
            textModel('models/gemini-1.5-flash'),
            textModel('models/gemini-1.5-pro'),
            textModel('models/gemini-pro'),
            textModel('models/gemini-2.5-pro'),
          ],
        },
      },
      { match: GENERATE, status: 503, statusText: 'Service Unavailable', body: { message: 'quá tải' } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /Đã thử 3 model nhưng không thành công/,
    );
    // MAX_MODEL_ATTEMPTS bounds the wait: nine fallbacks must not mean nine round trips.
    expect(generateCalls(spy)).toHaveLength(3);
  });

  it('reports an empty completion as the reason for giving up', async () => {
    stubGeminiFetch([
      { match: GENERATE, body: { candidates: [] } },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /nội dung rỗng/,
    );
  });

  it('reports unparseable JSON as the reason for giving up', async () => {
    stubGeminiFetch(singleModelRoutes('Xin lỗi, tôi không thể tạo đề này.'));

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /Đã thử \d+ model nhưng không thành công/,
    );
  });

  it('keeps the description-less HTTP failure readable', async () => {
    stubGeminiFetch([
      { match: GENERATE, status: 500, statusText: 'Internal Server Error', body: { message: 'không rõ' } },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /Google Gemini \(500\): Internal Server Error/,
    );
  });

  it('gives up immediately when Google rejects the key', async () => {
    const spy = stubGeminiFetch([
      {
        match: GENERATE,
        status: 403,
        statusText: 'Forbidden',
        body: { error: { message: 'API key expired. Please renew the API key.' } },
      },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /API key expired/,
    );
    // Retrying a dead key against the other fallbacks is what made a bad key take minutes.
    expect(generateCalls(spy)).toHaveLength(1);
  });

  it('retries the next model after a per-model failure', async () => {
    let attempt = 0;
    const spy = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes(GENERATE)) {
        attempt += 1;
        if (attempt === 1) {
          const status = 429;
          return {
            ok: false,
            status,
            statusText: 'Too Many Requests',
            headers: new Headers(),
            json: async () => ({ error: { message: 'Quota exceeded for this model.' } }),
            text: async () => JSON.stringify({ error: { message: 'Quota exceeded for this model.' } }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          json: async () => geminiReply(JSON.stringify(EXAM)),
          text: async () => '',
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ models: [textModel('models/gemini-2.0-flash'), textModel('models/gemini-1.5-flash')] }),
        text: async () => '',
      } as unknown as Response;
    });
    (globalThis as any).fetch = spy;

    const result = await GeminiAIService.generateAssignment('key-123', assignmentOptions());

    expect(result.modelUsed).toBe('gemini-1.5-flash');
    expect(generateCalls(spy as unknown as ReturnType<typeof stubGeminiFetch>)).toHaveLength(2);
  });

  it('turns an aborted request into an actionable timeout message', async () => {
    // 400 modality errors and 429 quotas fall through to the next model; an abort is reported as a
    // timeout so a lecturer knows the request was cancelled rather than silently dropped.
    const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    stubGeminiFetch([
      { match: GENERATE, reject: abortError },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /không phản hồi sau 45s/,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.0-flash'),
      expect.stringContaining('không phản hồi sau 45s'),
    );
  });

  it('aborts a stalled model after the per-model budget', async () => {
    vi.useFakeTimers();
    try {
      const hanging = vi.fn(async (input: unknown, init?: { signal?: AbortSignal }) => {
        if (String(input).includes(GENERATE)) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
            });
          });
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          json: async () => ({ models: [textModel('models/gemini-2.0-flash')] }),
          text: async () => '',
        } as unknown as Response;
      });
      (globalThis as any).fetch = hanging;

      const pending = GeminiAIService.generateAssignment('key-123', assignmentOptions());
      const settled = expect(pending).rejects.toThrow(/không phản hồi sau 45s/);

      // Three models x a 45s wall-clock budget each, and not one millisecond more.
      await vi.advanceTimersByTimeAsync(45_000);
      await vi.advanceTimersByTimeAsync(45_000);
      await vi.advanceTimersByTimeAsync(45_000);

      await settled;
      expect(hanging.mock.calls.filter((call) => String(call[0]).includes(GENERATE))).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws a generic detail when the failure carries no message', async () => {
    stubGeminiFetch([
      { match: GENERATE, reject: 'boom' },
      { match: LIST, body: { models: [textModel('models/gemini-2.0-flash')] } },
    ]);

    await expect(GeminiAIService.generateAssignment('key-123', assignmentOptions())).rejects.toThrow(
      /Đã thử 3 model nhưng không thành công\. Chi tiết cuối cùng: Không thể kết nối tới máy chủ Google Gemini AI/,
    );
  });

  it('refuses a key made only of whitespace', async () => {
    const spy = stubGeminiFetch([]);

    await expect(GeminiAIService.generateAssignment('   ', assignmentOptions())).rejects.toThrow(
      /Chưa cung cấp Google Gemini API Key/,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// assignmentParser
// ---------------------------------------------------------------------------------------------

describe('parseAssignmentDescription – technology tags', () => {
  it('detects every algorithm it knows about', () => {
    const parsed = parseAssignmentDescription(`
Cho một đồ thị có trọng số, hãy tìm đường đi ngắn nhất.

Yêu cầu kỹ thuật:
1. Dùng thuật toán Dijkstra với Min-Heap / PriorityQueue.
2. Sắp xếp bằng QuickSort 3-Way (partitioning) và cân bằng bằng cây AVL.
3. Tra cứu bằng Binary Search Tree (BST), tuân thủ nguyên lý SOLID và SRP.

Ràng buộc:
- 1 <= N <= 10^5
`);

    expect(parsed.tags).toEqual([
      'Thuật toán Dijkstra',
      'Min-Heap / PriorityQueue',
      'QuickSort 3-Way',
      'Cây Cân Bằng AVL',
      'Binary Search Tree (BST)',
      'SOLID Principle (SRP)',
    ]);
  });

  it('records the most specific complexity that is mentioned', () => {
    expect(
      parseAssignmentDescription('Ràng buộc:\n- Thuật toán chạy trong O((M + N) log N).').tags,
    ).toContain('Độ phức tạp O((M+N) log N)');

    expect(parseAssignmentDescription('Ràng buộc:\n- Cần độ phức tạp O(N log N).').tags).toEqual([
      'Độ phức tạp O(N log N)',
    ]);

    expect(parseAssignmentDescription('Ràng buộc:\n- Chỉ được dùng O(log N) bộ nhớ.').tags).toEqual([
      'Độ phức tạp O(log N)',
    ]);
  });

  it('falls through to the loosest complexity when only the generic form is written', () => {
    // The outer `if` matches on `o((m + n) log n)`, `o(n log n)` OR `o(log n)`; each inner branch
    // has to stay exclusive so a text mentioning all three records only the tightest one.
    const parsed = parseAssignmentDescription(
      'Mục tiêu O(log N), cố gắng đạt O(N log N), lý tưởng là O((M + N) log N).',
    );

    expect(parsed.tags).toEqual(['Độ phức tạp O((M+N) log N)']);
  });

  it('drops a complexity tag when a higher-priority phrase is absent', () => {
    expect(parseAssignmentDescription('Ràng buộc:\n- Độ phức tạp cho phép O(log n).').tags).toEqual([
      'Độ phức tạp O(log N)',
    ]);
  });

  it('does not add a complexity tag when the text mentions none', () => {
    expect(parseAssignmentDescription('Ràng buộc:\n- Chạy trong O(N^2).').tags).toEqual([]);
  });

  it('flags a problem that needs 64-bit arithmetic', () => {
    expect(parseAssignmentDescription('Dùng long trong Java để tránh tràn số.').tags).toContain(
      'Kiểu dữ liệu 64-bit (long/int)',
    );
    expect(parseAssignmentDescription('Giá trị có thể vượt quá 64-bit.').tags).toContain(
      'Kiểu dữ liệu 64-bit (long/int)',
    );
  });

  it('flags a CDN / streaming problem', () => {
    expect(parseAssignmentDescription('Tối ưu bitrate cho hệ thống CDN.').tags).toContain(
      'Hạ tầng CDN & Streaming',
    );
    expect(parseAssignmentDescription('Phân phối luồng streaming đa vùng.').tags).toContain(
      'Hạ tầng CDN & Streaming',
    );
  });

  it('returns no tags for a problem that mentions nothing recognisable', () => {
    expect(parseAssignmentDescription('Tính tổng của một dãy số nguyên.').tags).toEqual([]);
  });
});

describe('parseAssignmentDescription – heading variants', () => {
  it('accepts the English headings and their alternate spellings', () => {
    const parsed = parseAssignmentDescription(`
Compute the shortest path.

Technical Requirement:
1. Read the graph from standard input.

Input Format:
- First line: N and M.

Output Format:
- The distance from 1 to N.

Constraint:
- 1 <= N <= 1000
`);

    expect(parsed.technicalRequirements.join(' ')).toContain('standard input');
    expect(parsed.inputFormat.join(' ')).toContain('N and M');
    expect(parsed.outputFormat.join(' ')).toContain('distance');
    expect(parsed.constraints.join(' ')).toContain('1000');
  });

  it('accepts the "Yêu cầu thuật toán" and bare "Đầu vào"/"Đầu ra" variants', () => {
    const parsed = parseAssignmentDescription(`
Bài toán tìm kiếm.

Yêu cầu thuật toán:
1. Phải chạy nhanh hơn O(N^2).

Đầu vào (StdIn):
- Dòng đầu là số N.

Đầu ra (StdOut):
- In ra đáp án.

Giới hạn:
- N <= 500
`);

    expect(parsed.technicalRequirements.join(' ')).toContain('O(N^2)');
    expect(parsed.inputFormat.join(' ')).toContain('số N');
    expect(parsed.outputFormat.join(' ')).toContain('đáp án');
    expect(parsed.constraints.join(' ')).toContain('500');
  });

  it('treats a trailing heading with no body as empty instead of leaking the next one', () => {
    // Regression: `items.length > 0 ? items : [sectionText]` produced `['']` for a heading with no
    // body. AssignmentDescriptionView renders one row per entry, so "Định dạng Đầu ra:" followed
    // by nothing showed a blank bullet instead of the explanatory default text that an empty
    // array selects. Every section had the same flaw.
    const parsed = parseAssignmentDescription(`
Mô tả ngắn gọn.

Yêu cầu kỹ thuật:
1. Chỉ đọc từ stdin.

Định dạng Đầu vào:
- Dòng 1: N.

Định dạng Đầu ra:

Ràng buộc:
- N <= 9
`);

    expect(parsed.outputFormat).toEqual([]);
    expect(parsed.constraints.join(' ')).toContain('N <= 9');
  });

  it('reports an empty section as empty for every section kind', () => {
    // Regression: same fallback, one heading per section, all with no body.
    const parsed = parseAssignmentDescription(
      'Mô tả.\n\nYêu cầu kỹ thuật:\n\nĐịnh dạng Đầu vào:\n\nĐịnh dạng Đầu ra:\n\nRàng buộc:\n',
    );

    expect(parsed.technicalRequirements).toEqual([]);
    expect(parsed.inputFormat).toEqual([]);
    expect(parsed.outputFormat).toEqual([]);
    expect(parsed.constraints).toEqual([]);
  });

  it('keeps a heading that has no following marker at all', () => {
    // `nextMarker === -1`: the section runs to the end of the text.
    const parsed = parseAssignmentDescription('Yêu cầu kỹ thuật:\n1. Không dùng thư viện ngoài.');

    expect(parsed.technicalRequirements.join(' ')).toContain('Không dùng thư viện ngoài');
    expect(parsed.inputFormat).toEqual([]);
    expect(parsed.outputFormat).toEqual([]);
    expect(parsed.constraints).toEqual([]);
  });

  it('keeps a section whose body is too short to split into bullets', () => {
    // Every split candidate is <= 5 characters, so the raw text has to be kept as one item.
    const parsed = parseAssignmentDescription('Định dạng Đầu vào:\nab\nĐịnh dạng Đầu ra:\ncd\nRàng buộc:\ne');

    expect(parsed.technicalRequirements).toEqual([]);
    expect(parsed.inputFormat).toEqual(['ab']);
    expect(parsed.outputFormat).toEqual(['cd']);
    expect(parsed.constraints).toEqual(['e']);
  });

  it('keeps each section whose heading is the last thing in the text', () => {
    // `nextMarker === -1`: input, output and constraints all run to the end of the document.
    expect(parseAssignmentDescription('Định dạng Đầu vào:\nDòng đầu là N.').inputFormat).toEqual([
      'Dòng đầu là N.',
    ]);
    expect(parseAssignmentDescription('Định dạng Đầu ra:\nIn ra tổng.').outputFormat).toEqual(['In ra tổng.']);
    expect(parseAssignmentDescription('Ràng buộc:\nN nhỏ hơn 10.').constraints).toEqual(['N nhỏ hơn 10.']);
  });

  it('keeps a technical-requirements body that is too short to split', () => {
    // `items.length > 0 ? items : (techText ? [techText] : [])` — "ngắn" is only 4 characters, so
    // the 5-character filter empties the list and the raw body survives as the single item.
    expect(parseAssignmentDescription('Yêu cầu kỹ thuật:\nngắn').technicalRequirements).toEqual(['ngắn']);
  });

  it('keeps the tail of a section that ends without a following heading', () => {
    // The input section stops at the output heading but the output section has no constraint after
    // it, so the two sections take different `nextMarker` branches.
    const parsed = parseAssignmentDescription(
      'Mô tả.\n\nĐịnh dạng Đầu vào:\n- Dòng 1: N.\n\nĐịnh dạng Đầu ra:\n- In ra tổng của dãy.',
    );

    expect(parsed.inputFormat).toEqual(['Dòng 1: N.']);
    expect(parsed.outputFormat).toEqual(['In ra tổng của dãy.']);
    expect(parsed.constraints).toEqual([]);
  });

  it('handles duplicated headings without merging them', () => {
    const parsed = parseAssignmentDescription(`
Mô tả.

Định dạng Đầu vào:
- Dòng 1: N.

Định dạng Đầu vào:
- Dòng 2: M.

Ràng buộc:
- N <= 10
`);

    // The parser keys off the first occurrence of each heading; the duplicate stays in the
    // section body rather than producing a second list.
    expect(parsed.inputFormat.join(' ')).toContain('Dòng 1: N');
    expect(parsed.constraints.join(' ')).toContain('N <= 10');
  });

  it('tolerates CRLF line endings in every section', () => {
    const parsed = parseAssignmentDescription(
      [
        'Bài toán sắp xếp.',
        '',
        'Yêu cầu kỹ thuật:',
        '1. Phải ổn định (stable sort).',
        '2. Không dùng hàm thư viện.',
        '',
        'Định dạng Đầu vào:',
        '- Dòng 1: N.',
        '',
        'Định dạng Đầu ra:',
        '- In ra dãy đã sắp xếp.',
        '',
        'Ràng buộc:',
        '- 1 <= N <= 100000',
      ].join('\r\n'),
    );

    expect(parsed.overview).toContain('sắp xếp');
    expect(parsed.technicalRequirements.length).toBeGreaterThanOrEqual(2);
    expect(parsed.inputFormat.join(' ')).toContain('Dòng 1: N');
    expect(parsed.outputFormat.join(' ')).toContain('đã sắp xếp');
    expect(parsed.constraints.join(' ')).toContain('100000');
  });

  it('summarises with the first two sentences of the overview', () => {
    const parsed = parseAssignmentDescription(
      'Cho một dãy số. Hãy tính tổng. Sau đó in ra màn hình.\n\nRàng buộc:\n- N <= 10',
    );

    expect(parsed.shortSummary).toBe('Cho một dãy số. Hãy tính tổng.');
    expect(parsed.overview).toContain('Sau đó in ra màn hình.');
  });

  it('falls back to the whole overview when it holds no sentence break', () => {
    // `sentences.slice(0, 2).join(' ') || overview`: a one-word overview has no terminator, so the
    // joined list is still that word — but an overview that splits to nothing would fall back.
    const parsed = parseAssignmentDescription('Tính tổng');

    expect(parsed.shortSummary).toBe('Tính tổng');
    expect(parsed.overview).toBe('Tính tổng');
  });

  it('keeps a short overview that has no punctuation at all', () => {
    const parsed = parseAssignmentDescription('Sắp xếp mảng số nguyên theo thứ tự tăng dần');

    expect(parsed.shortSummary).toBe('Sắp xếp mảng số nguyên theo thứ tự tăng dần');
  });

  it('treats whitespace-only input as an empty description', () => {
    const parsed = parseAssignmentDescription('   \n\t  ');

    expect(parsed.overview).toBe('Chưa có mô tả chi tiết cho bài tập này.');
    expect(parsed.shortSummary).toBe('Chưa có mô tả chi tiết.');
    expect(parsed.tags).toEqual([]);
  });
});
