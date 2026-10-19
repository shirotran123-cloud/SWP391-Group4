import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveGradingModal } from '../components/LiveGradingModal';
import { HodDashboard } from '../components/HodDashboard';
import { PlagiarismService } from '../services/plagiarism.service';
import type { GradingStep, PlagiarismMatch } from '../types';
import {
  installFetchStub,
  AIRatingFixture,
  PlagiarismMatchFixture,
  GradingStepsFixture,
  AppealFixture,
} from '../test/fixtures';

/**
 * LiveGradingModal, HodDashboard and the client-side plagiarism service.
 *
 * The modal is the only place a student sees the outcome of an automated grading run, so these
 * tests pin what each grading-step status renders, how progress is derived, and both routes out of
 * the dialog (the button and the Escape key). HodDashboard is covered here only for the behaviour
 * `dashboards.test.tsx` does not already exercise: appeal resolution, the flagged-only filter, the
 * statistic values, and both error surfaces.
 */

const baseModalProps = {
  submissionId: 'SUB-000001-AAAAAA',
  studentName: 'Đinh Thành Trung',
  sourceCode: 'print(1)\n',
};

describe('LiveGradingModal', () => {
  let stub: ReturnType<typeof installFetchStub>;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('renders nothing at all while closed', () => {
    const { container } = render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen={false}
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Sinh viên:/i)).not.toBeInTheDocument();
  });

  it('lists every grading step by label while grading is running', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
    );
    for (const step of GradingStepsFixture) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  it('shows the student name and a shortened submission id', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
    );
    expect(screen.getByText('Đinh Thành Trung')).toBeInTheDocument();
    // The chip shows only the first 8 characters of the id, not the whole thing.
    expect(screen.getByText('ID: #SUB-0000')).toBeInTheDocument();
  });

  it('renders the step detail text when a step supplies one', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
    );
    expect(screen.getByText('2/2 đạt')).toBeInTheDocument();
    expect(screen.getByText('12% tương đồng')).toBeInTheDocument();
  });

  it('omits the detail line for a step that has none', () => {
    const noDetail: GradingStep[] = [{ id: 'only', label: 'Bước Không Chi Tiết', status: 'passed' }];
    const { container } = render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={noDetail} isCompleted={false} />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('maps each step status onto its own icon and badge', () => {
    const steps: GradingStep[] = [
      { id: 'p', label: 'Bước Chờ', status: 'pending' },
      { id: 'i', label: 'Bước Đang Chạy', status: 'in_progress' },
      { id: 's', label: 'Bước Đạt', status: 'passed' },
      { id: 'f', label: 'Bước Hỏng', status: 'failed' },
    ];
    const { container } = render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={steps} isCompleted={false} />,
    );

    // Each status owns a distinct lucide icon, so the icon class is a stable proxy for the state.
    const iconClasses = Array.from(container.querySelectorAll('svg')).map((s) => s.getAttribute('class') ?? '');
    expect(iconClasses.some((c) => c.includes('lucide-clock'))).toBe(true);
    expect(iconClasses.some((c) => c.includes('lucide-loader-circle') && c.includes('animate-spin'))).toBe(true);
    expect(iconClasses.some((c) => c.includes('lucide-circle-check'))).toBe(true);
    expect(iconClasses.some((c) => c.includes('lucide-circle-x'))).toBe(true);

    // `passed`, `failed` and `in_progress` get an explicit badge; a pending step stays silent.
    expect(screen.getByText('ĐẠT')).toBeInTheDocument();
    expect(screen.getByText('KHÔNG ĐẠT')).toBeInTheDocument();
    expect(screen.getByText('ĐANG XỬ LÝ...')).toBeInTheDocument();
    expect(screen.queryByText('CHỜ XỬ LÝ')).not.toBeInTheDocument();
  });

  it('counts both passed and failed steps towards the progress bar', () => {
    // Two of the three fixture steps are finished, so progress must read 67%.
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
    );
    expect(screen.getByText('Tiến trình đánh giá')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('reaches 100% only once every step has finished', () => {
    const allDone: GradingStep[] = [
      { id: 'a', label: 'Bước A', status: 'passed' },
      { id: 'b', label: 'Bước B', status: 'failed' },
    ];
    render(<LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={allDone} isCompleted={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows 0% rather than NaN% when there are no steps yet', () => {
    // Regression: `steps` is empty before the first grading event arrives, and `0 / 0 * 100` is
    // NaN. The progress label rendered the literal text "NaN%" and the bar width became `NaN%`,
    // so the modal showed a broken progress bar instead of an honest zero.
    const { container } = render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={[]} isCompleted={false} />,
    );
    expect(container.textContent).not.toContain('NaN');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('announces the completion headline and the final score', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        score={8.5}
      />,
    );
    expect(screen.getByText(/Kết Quả Đánh Giá Mã Nguồn/)).toBeInTheDocument();
    expect(screen.queryByText(/Đang Chấm Bài Tự Động/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tổng Điểm:\s*8\.5 \/ 10/)).toBeInTheDocument();
  });

  it('honours a custom maxScore when printing the total', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        score={85}
        maxScore={100}
      />,
    );
    expect(screen.getByText(/Tổng Điểm:\s*85 \/ 100/)).toBeInTheDocument();
  });

  it('hides the score chip entirely when no score is supplied', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted />,
    );
    expect(screen.queryByText(/Tổng Điểm:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/TC1:/)).not.toBeInTheDocument();
  });

  it('prints the four-part barem when a score breakdown is given', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        score={9.5}
        scoreBreakdown={{ testcase1: 4, testcase2: 3, cleanCode: 1.7, solid: 0.8, total: 9.5 }}
      />,
    );
    expect(screen.getByText(/TC1:\s*4\.0 \/ 4\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/TC2:\s*3\.0 \/ 3\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/Mã Nguồn Sạch:\s*1\.7 \/ 2\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/SOLID:\s*0\.8 \/ 1\.0đ/)).toBeInTheDocument();
  });

  it('falls back to zeroed components when the breakdown is missing', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={5} />,
    );
    expect(screen.getByText(/TC1:\s*0\.0 \/ 4\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/TC2:\s*0\.0 \/ 3\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/Mã Nguồn Sạch:\s*0\.0 \/ 2\.0đ/)).toBeInTheDocument();
    expect(screen.getByText(/SOLID:\s*0\.0 \/ 1\.0đ/)).toBeInTheDocument();
  });

  it('shows the execution time only when it is supplied', () => {
    const { unmount } = render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        score={8.5}
        executionTimeMs={1420}
      />,
    );
    expect(screen.getByText('Thời gian: 1420ms')).toBeInTheDocument();
    unmount();

    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    expect(screen.queryByText(/Thời gian:/)).not.toBeInTheDocument();
  });

  it('renders the AI clean-code score, the SOLID axes and every code smell', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        aiRating={AIRatingFixture}
      />,
    );
    expect(screen.getByText(/Đánh Giá 5 Trục SOLID/)).toBeInTheDocument();
    // SolidRadarChart prints the clean-code score next to the SOLID average.
    expect(screen.getByText(`${AIRatingFixture.cleanCodeScore}/10`)).toBeInTheDocument();
    expect(screen.getByText(/Điểm SOLID Trung Bình:/)).toBeInTheDocument();

    expect(screen.getByText('Cảnh báo Mùi Mã Nguồn (2):')).toBeInTheDocument();
    for (const smell of AIRatingFixture.codeSmells) {
      expect(screen.getByText(smell.description)).toBeInTheDocument();
      expect(screen.getByText(`Dòng ${smell.line}:`)).toBeInTheDocument();
    }
    expect(screen.getByText(`"${AIRatingFixture.explanation}"`)).toBeInTheDocument();
  });

  it('surfaces the first code smell in the AI pedagogy hint', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        aiRating={AIRatingFixture}
      />,
    );
    const hint = screen.getByText(/Gợi Ý Sư Phạm AI/).closest('div');
    expect(hint?.textContent).toContain('Phát hiện vi phạm');
    expect(hint?.textContent).toContain(AIRatingFixture.codeSmells[0].description);
    expect(hint?.textContent).toContain(`tại dòng ${AIRatingFixture.codeSmells[0].line}`);
    expect(hint?.textContent).toContain('Đơn Trách Nhiệm (SRP)');
  });

  it('falls back to a default line number for a smell that reports none', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        aiRating={{
          ...AIRatingFixture,
          codeSmells: [{ line: 0, rule: 'Quy tắc chung', description: 'Mùi mã nguồn không xác định dòng.' }],
        }}
      />,
    );
    // The component substitutes line 15 when the smell carries no usable line, so the label is
    // never a bare "Dòng :".
    expect(screen.getByText('Dòng 15:')).toBeInTheDocument();
    expect(screen.getByText('Mùi mã nguồn không xác định dòng.')).toBeInTheDocument();
  });

  it('praises the architecture instead of naming a violation when there are no code smells', () => {
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        aiRating={{ ...AIRatingFixture, codeSmells: [] }}
      />,
    );
    expect(screen.getByText('Cảnh báo Mùi Mã Nguồn (0):')).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá kiến trúc xuất sắc/)).toBeInTheDocument();
    expect(screen.queryAllByText(/Phát hiện vi phạm/)).toHaveLength(0);
  });

  it('omits the whole AI section when the grading run produced no rating', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={5} />,
    );
    expect(screen.queryByText(/Nhận Xét & Đánh Giá Từ Trợ Lý AI/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gợi Ý Sư Phạm AI/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đánh Giá 5 Trục SOLID/)).not.toBeInTheDocument();
  });

  it('shows the plagiarism warning with the similarity percentage for a flagged match', () => {
    const { container } = render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        plagiarismMatch={PlagiarismMatchFixture}
      />,
    );
    // The percentage is stated in the diff-tab control, and the other side is named next to it.
    expect(screen.getByRole('button', { name: /Đối Sánh Đạo Văn Trực Quan \(92\.5%\)/i })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Hoàng Vinh')).toBeInTheDocument();
    expect(screen.getByText(/\(SE170123\)/)).toBeInTheDocument();
    expect(screen.getByText('1 đoạn mã trùng khớp')).toBeInTheDocument();

    // At or above the 70% threshold the viewer switches to the high-risk alert icon.
    const icons = Array.from(container.querySelectorAll('svg')).map((s) => s.getAttribute('class') ?? '');
    expect(icons.some((c) => c.includes('lucide-triangle-alert'))).toBe(true);
    expect(icons.some((c) => c.includes('lucide-eye'))).toBe(false);
  });

  it('uses the calm eye icon for a match below the flag threshold', () => {
    const clean: PlagiarismMatch = { ...PlagiarismMatchFixture, similarityRate: 12, isFlagged: false };
    const { container } = render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        plagiarismMatch={clean}
      />,
    );
    expect(screen.getByRole('button', { name: /Đối Sánh Đạo Văn Trực Quan \(12%\)/i })).toBeInTheDocument();
    const icons = Array.from(container.querySelectorAll('svg')).map((s) => s.getAttribute('class') ?? '');
    expect(icons.some((c) => c.includes('lucide-eye'))).toBe(true);
    expect(icons.some((c) => c.includes('lucide-triangle-alert'))).toBe(false);
  });

  it('hides the source viewer and the plagiarism tab while grading is unfinished', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
    );
    expect(screen.queryByRole('button', { name: /Đối Sánh Đạo Văn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mã Nguồn Bài Làm/i })).not.toBeInTheDocument();
  });

  it('offers no diff tab when the completed run found no match', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    // The source viewer itself is present, but without a match there is nothing to compare to.
    expect(screen.getByRole('button', { name: /Mã Nguồn Bài Làm/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đối Sánh Đạo Văn/i })).not.toBeInTheDocument();
  });

  it('lets the student switch the source viewer to the side-by-side diff', async () => {
    const user = userEvent.setup();
    render(
      <LiveGradingModal
        {...baseModalProps}
        isOpen
        onClose={() => {}}
        steps={GradingStepsFixture}
        isCompleted
        plagiarismMatch={PlagiarismMatchFixture}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Đối Sánh Đạo Văn Trực Quan/i }));
    // The diff header names both sides of the comparison.
    expect(await screen.findByText(/GỐC: Bài nộp của Đinh Thành Trung/)).toBeInTheDocument();
    expect(screen.getByText(/ĐỐI CHIẾU \(92\.5%\): Nguyễn Hoàng Vinh/)).toBeInTheDocument();
  });

  it('closes through the completion button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    await user.click(screen.getByRole('button', { name: /Hoàn thành & Đóng/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mentions the Escape shortcut on the close button', () => {
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    expect(screen.getByRole('button', { name: /\(Esc\)$/i })).toBeInTheDocument();
  });

  it('closes on the Escape key once the run is complete', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores the Escape key while grading is still running', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted={false} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores the Escape key while the modal is closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LiveGradingModal {...baseModalProps} isOpen={false} onClose={onClose} steps={GradingStepsFixture} isCompleted />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores other keys entirely', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    await user.keyboard('{Enter}{Space}q');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('unbinds the Escape listener when it unmounts', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    unmount();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('starts responding to Escape after a re-render flips it to completed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted={false} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    // The listener is re-bound because the effect depends on `isCompleted`.
    rerender(
      <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('appeal control', () => {
    it('offers "Khiếu Nại Điểm" only after the grading run completes', () => {
      const { unmount } = render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted={false} />,
      );
      expect(screen.queryByRole('button', { name: /Khiếu Nại Điểm/i })).not.toBeInTheDocument();
      unmount();

      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      expect(screen.getByRole('button', { name: /Khiếu Nại Điểm/i })).toBeInTheDocument();
    });

    it('opens the appeal dialog with the submission id locked to this submission', async () => {
      const user = userEvent.setup();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      expect(screen.queryByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));

      expect(await screen.findByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).toBeInTheDocument();
      // The submission id is pre-filled and read-only, so an appeal cannot target another paper.
      const idInput = screen.getByPlaceholderText(/VD: SUB-1728/i) as HTMLInputElement;
      expect(idInput.value).toBe('SUB-000001-AAAAAA');
      expect(idInput.readOnly).toBe(true);
      expect(screen.getByText(/Cố định theo bài/i)).toBeInTheDocument();
    });

    it('passes the score through to the appeal dialog', async () => {
      const user = userEvent.setup();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));
      expect(await screen.findByText('8.5 / 10.0')).toBeInTheDocument();
    });

    it('states the two-attempt appeal limit inside the dialog', async () => {
      const user = userEvent.setup();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));

      expect(await screen.findByText(/Tối đa 2 lần khiếu nại cho mỗi bài nộp/i)).toBeInTheDocument();
      expect(screen.getByText(/Quy định phúc khảo: Tối đa 2 lần khiếu nại cho mỗi bài nộp/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Gửi Đơn Phúc Khảo/i })).toBeDisabled();
    });

    it('offers the first appeal attempt when the submission has no history', async () => {
      stub.restore();
      stub = installFetchStub({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200, data: [] } }] });
      const user = userEvent.setup();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));

      expect(await screen.findByRole('button', { name: /Gửi Đơn Phúc Khảo \(Lần 1\/2\)/i })).toBeInTheDocument();
      expect(screen.getByText(/Còn lại 2 lượt khiếu nại cho bài này/i)).toBeInTheDocument();
    });

    it('counts an existing appeal against the two-attempt limit', async () => {
      // The default fixture serves one appeal for this submission, so the dialog must offer the
      // second and final attempt rather than a fresh one.
      const user = userEvent.setup();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={() => {}} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));

      expect(await screen.findByRole('button', { name: /Gửi Đơn Phúc Khảo \(Lần 2\/2\)/i })).toBeInTheDocument();
      expect(screen.getByText(/Còn lại 1 lượt khiếu nại cho bài này/i)).toBeInTheDocument();
      // The history of the submission is listed back to the student.
      expect(screen.getByText(new RegExp(AppealFixture.reason))).toBeInTheDocument();
      expect(screen.getByText('Lần 1/2')).toBeInTheDocument();
    });

    it('does not close the whole modal when Escape is pressed inside the appeal dialog', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));
      await screen.findByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i);

      await user.keyboard('{Escape}');
      // The guard exists so Escape does not dismiss the grading result behind the nested dialog.
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes the appeal dialog again without closing the grading result', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <LiveGradingModal {...baseModalProps} isOpen onClose={onClose} steps={GradingStepsFixture} isCompleted score={8.5} />,
      );
      await user.click(screen.getByRole('button', { name: /Khiếu Nại Điểm/i }));
      const heading = await screen.findByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i);

      // The nested dialog closes when its own backdrop is clicked.
      await user.click(heading.closest('div[style*="position: fixed"]') as HTMLElement);
      await waitFor(() => {
        expect(screen.queryByText(/Đơn Khiếu Nại & Phúc Khảo Điểm/i)).not.toBeInTheDocument();
      });
      expect(onClose).not.toHaveBeenCalled();
      // The grading result is still on screen underneath.
      expect(screen.getByText(/Kết Quả Đánh Giá Mã Nguồn/)).toBeInTheDocument();
    });
  });
});

describe('HodDashboard', () => {
  let stub: ReturnType<typeof installFetchStub>;

  const reports = [
    {
      reportId: 'PLG-001',
      assignmentId: 'ASM-SWP391-01',
      submissionAId: 'SUB-A',
      submissionBId: 'SUB-B',
      similarityRate: 92.5,
      commonFingerprintsCount: 41,
      flaggedAsFraud: true,
    },
    {
      reportId: 'PLG-002',
      assignmentId: 'ASM-SWP391-02',
      submissionAId: 'SUB-C',
      submissionBId: 'SUB-D',
      similarityRate: 74,
      commonFingerprintsCount: 12,
    },
    {
      reportId: 'PLG-003',
      assignmentId: 'ASM-SWP391-03',
      submissionAId: 'SUB-E',
      submissionBId: 'SUB-F',
      similarityRate: 55,
    },
  ];

  /** Replaces the router with a fresh one; the previous stub is always torn down first. */
  const installWith = (extra: Parameters<typeof installFetchStub>[0] = {}) => {
    stub.restore();
    stub = installFetchStub(extra);
  };

  /** Points `fetch` at a function that always rejects, to exercise the `catch` arms. */
  const installRejectingFetch = (message: string) => {
    stub.restore();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error(message))) as any;
  };

  const reportsRoute = (data: unknown) => ({
    routes: [{ match: '/api/v1/plagiarism', body: { statusCode: 200, data } }],
  });

  const openAppeals = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));
    await screen.findByText(AppealFixture.reason);
  };

  /** The statistic tiles render the value immediately above its label. */
  const statValueFor = (label: string) => screen.getByText(label).previousElementSibling?.textContent;

  beforeEach(() => {
    stub = installFetchStub();
  });

  afterEach(() => {
    stub.restore();
  });

  describe('integrity tab', () => {
    it('renders one table row per report with its identifiers and similarity', async () => {
      installWith(reportsRoute(reports));
      render(<HodDashboard />);

      expect(await screen.findByText('PLG-001')).toBeInTheDocument();
      expect(screen.getByText('PLG-002')).toBeInTheDocument();
      expect(screen.getByText('PLG-003')).toBeInTheDocument();

      expect(screen.getByText('ASM-SWP391-01')).toBeInTheDocument();
      expect(screen.getByText('SUB-A')).toBeInTheDocument();
      expect(screen.getByText('SUB-B')).toBeInTheDocument();
      expect(screen.getByText('92.5%')).toBeInTheDocument();
      expect(screen.getByText('41')).toBeInTheDocument();
      // A report with no fingerprint count falls back to an em dash rather than "undefined".
      expect(screen.getAllByText('—')).toHaveLength(1);
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('derives the status badge from the row when the API omits one', async () => {
      installWith(reportsRoute(reports));
      render(<HodDashboard />);

      await screen.findByText('PLG-001');
      // PLG-001 carries `flaggedAsFraud`; the other two do not.
      expect(screen.getByText('FLAGGED')).toBeInTheDocument();
      expect(screen.getAllByText('SUSPECTED')).toHaveLength(2);
    });

    it('prefers the status the API reports over the derived badge', async () => {
      installWith(reportsRoute([{ ...reports[0], status: 'ĐÃ XÁC MINH' }]));
      render(<HodDashboard />);

      expect(await screen.findByText('ĐÃ XÁC MINH')).toBeInTheDocument();
      expect(screen.queryByText('FLAGGED')).not.toBeInTheDocument();
    });

    it('counts flagged pairs, severe pairs and the average similarity', async () => {
      installWith(reportsRoute(reports));
      const { container } = render(<HodDashboard />);

      await screen.findByText('PLG-001');
      expect(statValueFor('Cặp bài bị gắn cờ')).toBe('3');
      // Only 92.5 clears the 80% severe threshold; 74 sits in the warning band below it.
      expect(statValueFor('Cặp nghiêm trọng (≥80%)')).toBe('1');
      // mean(92.5, 74, 55) = 73.833…, rounded to one decimal.
      expect(statValueFor('Tương đồng trung bình')).toBe('73.8%');
      expect(container.textContent).not.toContain('NaN');
    });

    it('reports a zero average instead of NaN when there are no reports', async () => {
      installWith(reportsRoute([]));
      const { container } = render(<HodDashboard />);

      expect(await screen.findByText(/Chưa có cặp bài nộp nào bị gắn cờ đạo văn/i)).toBeInTheDocument();
      expect(statValueFor('Cặp bài bị gắn cờ')).toBe('0');
      expect(statValueFor('Tương đồng trung bình')).toBe('0%');
      expect(container.textContent).not.toContain('NaN');
    });

    it('tolerates a payload whose `data` is not an array', async () => {
      installWith(reportsRoute(null));
      const { container } = render(<HodDashboard />);

      expect(await screen.findByText(/Chưa có cặp bài nộp nào bị gắn cờ đạo văn/i)).toBeInTheDocument();
      expect(statValueFor('Cặp bài bị gắn cờ')).toBe('0');
      expect(container.textContent).not.toContain('NaN');
    });

    it('treats a report with no similarity rate as zero without crashing', async () => {
      installWith(reportsRoute([{ reportId: 'PLG-EMPTY', assignmentId: 'ASM-X', submissionAId: 'A', submissionBId: 'B' }]));
      const { container } = render(<HodDashboard />);

      expect(await screen.findByText('PLG-EMPTY')).toBeInTheDocument();
      expect(statValueFor('Tương đồng trung bình')).toBe('0%');
      expect(container.textContent).not.toContain('NaN');
    });
  });

  describe('flagged-only filter', () => {
    it('asks for flagged pairs only by default', async () => {
      render(<HodDashboard />);
      await waitFor(() => {
        expect(
          stub.spy.mock.calls.some(
            (c) => String(c[0]).includes('/api/v1/plagiarism/reports') && String(c[0]).includes('flaggedOnly=true'),
          ),
        ).toBe(true);
      });
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('sends the role so the API can enforce BR-04 itself', async () => {
      render(<HodDashboard />);
      await waitFor(() => {
        expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('role=HOD'))).toBe(true);
      });
    });

    it('drops the filter and re-queries when the box is cleared', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked());

      stub.spy.mockClear();
      await user.click(screen.getByRole('checkbox'));

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await waitFor(() => {
        const called = stub.spy.mock.calls.filter((c) => String(c[0]).includes('/api/v1/plagiarism/reports'));
        expect(called.length).toBeGreaterThan(0);
        // Every request after clearing the box must omit the filter.
        for (const call of called) {
          expect(String(call[0])).not.toContain('flaggedOnly');
        }
      });
    });

    it('restores the filter when the box is ticked again', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      const box = await screen.findByRole('checkbox');

      await user.click(box);
      await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked());
      stub.spy.mockClear();

      await user.click(screen.getByRole('checkbox'));
      await waitFor(() => {
        expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('flaggedOnly=true'))).toBe(true);
      });
    });

    it('labels the ≥70% warning threshold it applies', async () => {
      render(<HodDashboard />);
      expect(screen.getByText(/Chỉ hiển thị cặp đã vượt ngưỡng cảnh báo \(≥70%\)/i)).toBeInTheDocument();
      // Let the mount fetch settle so the state update lands inside the test.
      await waitFor(() => expect(stub.spy).toHaveBeenCalled());
    });
  });

  describe('appeals tab', () => {
    it('lists a pending appeal with its reason and the three counters', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      expect(screen.getByText(AppealFixture.appealId)).toBeInTheDocument();
      expect(screen.getByText(AppealFixture.reason)).toBeInTheDocument();
      expect(screen.getByText(/bài nộp SUB-000001-AAAAAA/)).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();

      expect(statValueFor('Tổng đơn phúc khảo')).toBe('1');
      expect(statValueFor('Chờ bộ môn xử lý')).toBe('1');
      expect(statValueFor('Đã chấp thuận')).toBe('0');
    });

    it('counts only the accepted appeals in the third counter', async () => {
      installWith({
        routes: [
          {
            match: '/api/v1/appeals',
            body: {
              statusCode: 200,
              data: [
                { ...AppealFixture, appealId: 'APL-1', status: 'PENDING' },
                { ...AppealFixture, appealId: 'APL-2', status: 'ACCEPTED' },
                { ...AppealFixture, appealId: 'APL-3', status: 'REJECTED' },
              ],
            },
          },
        ],
      });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));
      await screen.findByText('APL-1');

      expect(statValueFor('Tổng đơn phúc khảo')).toBe('3');
      expect(statValueFor('Chờ bộ môn xử lý')).toBe('1');
      expect(statValueFor('Đã chấp thuận')).toBe('1');
    });

    it('offers the decision buttons only on a pending appeal', async () => {
      installWith({
        routes: [
          {
            match: '/api/v1/appeals',
            body: {
              statusCode: 200,
              data: [
                { ...AppealFixture, appealId: 'APL-PENDING', status: 'PENDING' },
                { ...AppealFixture, appealId: 'APL-DONE', status: 'ACCEPTED' },
              ],
            },
          },
        ],
      });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));
      await screen.findByText('APL-PENDING');

      // Exactly one pair of buttons, belonging to the pending row only.
      expect(screen.getAllByRole('button', { name: 'Chấp thuận' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Từ chối' })).toHaveLength(1);
    });

    it('shows an empty state when nobody has appealed', async () => {
      installWith({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200, data: [] } }] });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      expect(await screen.findByText(/Chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
      expect(statValueFor('Tổng đơn phúc khảo')).toBe('0');
    });

    it('tolerates an appeals payload whose `data` is not an array', async () => {
      installWith({ routes: [{ match: '/api/v1/appeals', body: { statusCode: 200, data: null } }] });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      expect(await screen.findByText(/Chưa có đơn phúc khảo nào/i)).toBeInTheDocument();
      expect(statValueFor('Tổng đơn phúc khảo')).toBe('0');
    });

    it('shows the resolution note, reviewer and corrected score of a settled appeal', async () => {
      installWith({
        routes: [
          {
            match: '/api/v1/appeals',
            body: {
              statusCode: 200,
              data: [
                {
                  ...AppealFixture,
                  status: 'ACCEPTED',
                  reviewerId: 'GV0001',
                  resolutionNote: 'Đã cộng lại điểm testcase 2.',
                  adjustedScore: 7.5,
                },
              ],
            },
          },
        ],
      });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      await screen.findByText(/Đã cộng lại điểm testcase 2/);
      expect(screen.getByText(/\(GV0001\)/)).toBeInTheDocument();
      expect(screen.getByText(/Điểm mới: 7\.5/)).toBeInTheDocument();
    });

    it('omits the reviewer id and the new score when the note has neither', async () => {
      installWith({
        routes: [
          {
            match: '/api/v1/appeals',
            body: {
              statusCode: 200,
              data: [{ ...AppealFixture, status: 'REJECTED', resolutionNote: 'Giữ nguyên điểm.' }],
            },
          },
        ],
      });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      await screen.findByText(/Giữ nguyên điểm/);
      expect(screen.queryByText(/\(GV/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Điểm mới:/)).not.toBeInTheDocument();
    });
  });

  describe('appeal resolution', () => {
    it('sends an ACCEPTED decision with the HOD reviewer id', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));

      await waitFor(() => {
        const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/resolve'));
        expect(call).toBeDefined();
        expect(String(call![0])).toContain(`/api/v1/appeals/${AppealFixture.appealId}/resolve`);
        expect(call![1].method).toBe('PUT');
        expect(call![1].headers['Content-Type']).toContain('application/json');
        const body = JSON.parse(call![1].body);
        expect(body.status).toBe('ACCEPTED');
        expect(body.reviewerId).toBe('HOD001');
        expect(body.resolutionNote).toContain('phê duyệt');
      });
    });

    it('sends a REJECTED decision with its own note', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      await user.click(screen.getByRole('button', { name: 'Từ chối' }));

      await waitFor(() => {
        const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/resolve'));
        expect(call).toBeDefined();
        const body = JSON.parse(call![1].body);
        expect(body.status).toBe('REJECTED');
        expect(body.reviewerId).toBe('HOD001');
        expect(body.resolutionNote).toContain('không điều chỉnh điểm');
      });
    });

    it('confirms an accepted appeal and reloads the queue', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      stub.spy.mockClear();
      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));

      expect(await screen.findByText(`Đã chấp thuận đơn ${AppealFixture.appealId}.`)).toBeInTheDocument();
      // The list is re-fetched so the row reflects its new status.
      expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/appeals'))).toBe(true);
    });

    it('confirms a rejected appeal with its own wording', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      await user.click(screen.getByRole('button', { name: 'Từ chối' }));
      expect(await screen.findByText(`Đã từ chối đơn ${AppealFixture.appealId}.`)).toBeInTheDocument();
    });

    it('shows the API message when the decision is refused', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      installWith({ routes: [{ match: '/resolve', status: 409, body: { message: 'Đơn đã được xử lý' } }] });
      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));

      expect(await screen.findByText(`Không xử lý được ${AppealFixture.appealId}: Đơn đã được xử lý`)).toBeInTheDocument();
    });

    it('paints a failed decision as an error, not as a success', async () => {
      // Regression: `actionMsg` carried both outcomes and was always rendered in the green
      // success banner with a check mark, so a refused approval told the HOD it had succeeded.
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      installWith({ routes: [{ match: '/resolve', status: 500, body: { message: 'máy chủ hỏng' } }] });
      await user.click(screen.getByRole('button', { name: 'Từ chối' }));

      const text = await screen.findByText(`Không xử lý được ${AppealFixture.appealId}: máy chủ hỏng`);
      const banner = text.parentElement!;
      const style = banner.getAttribute('style') ?? '';
      expect(style).toContain('244, 63, 94');
      expect(style).not.toContain('16, 185, 129');
      expect(banner.querySelector('.lucide-triangle-alert')).toBeTruthy();
      expect(banner.querySelector('.lucide-circle-check')).toBeNull();
    });

    it('falls back to the HTTP status when the error body has no message', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      installWith({ routes: [{ match: '/resolve', status: 503, body: {} }] });
      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));

      expect(await screen.findByText(`Không xử lý được ${AppealFixture.appealId}: 503`)).toBeInTheDocument();
    });

    it('reports a network failure during resolution without crashing', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      installRejectingFetch('gateway sập');
      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));

      expect(await screen.findByText(/Lỗi kết nối: gateway sập/)).toBeInTheDocument();
    });

    it('clears a previous decision message before the next one', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      await user.click(screen.getByRole('button', { name: 'Chấp thuận' }));
      await screen.findByText(`Đã chấp thuận đơn ${AppealFixture.appealId}.`);

      installWith({ routes: [{ match: '/resolve', status: 500, body: { message: 'hỏng rồi' } }] });
      await user.click(screen.getByRole('button', { name: 'Từ chối' }));

      expect(await screen.findByText(/hỏng rồi/)).toBeInTheDocument();
      expect(screen.queryByText(`Đã chấp thuận đơn ${AppealFixture.appealId}.`)).not.toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('surfaces the API message when the report request is refused', async () => {
      installWith({
        routes: [
          { match: '/api/v1/plagiarism', status: 403, body: { message: 'Sinh viên không được xem dữ liệu đạo văn' } },
        ],
      });
      render(<HodDashboard />);

      expect(await screen.findByText('Sinh viên không được xem dữ liệu đạo văn')).toBeInTheDocument();
      // A refused request must leave the table empty rather than showing stale rows.
      expect(screen.getByText(/Chưa có cặp bài nộp nào bị gắn cờ đạo văn/i)).toBeInTheDocument();
    });

    it('falls back to a message naming the HTTP status when none is supplied', async () => {
      installWith({ routes: [{ match: '/api/v1/plagiarism', status: 500, body: {} }] });
      render(<HodDashboard />);

      expect(await screen.findByText(/Không tải được báo cáo đạo văn \(HTTP 500\)/i)).toBeInTheDocument();
    });

    it('reports an unreachable gateway for the integrity tab', async () => {
      installRejectingFetch('ECONNREFUSED');
      render(<HodDashboard />);

      expect(await screen.findByText(/Không kết nối được API Gateway: ECONNREFUSED/)).toBeInTheDocument();
    });

    it('surfaces the API message when the appeal request is refused', async () => {
      installWith({ routes: [{ match: '/api/v1/appeals', status: 403, body: { message: 'Không có quyền xem phúc khảo' } }] });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      expect(await screen.findByText('Không có quyền xem phúc khảo')).toBeInTheDocument();
    });

    it('falls back to the appeals HTTP status when the body carries no message', async () => {
      installWith({ routes: [{ match: '/api/v1/appeals', status: 502, body: {} }] });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      expect(await screen.findByText(/Không tải được danh sách phúc khảo \(HTTP 502\)/i)).toBeInTheDocument();
    });

    it('reports an unreachable gateway for the appeals tab', async () => {
      installRejectingFetch('mất kết nối');
      const user = userEvent.setup();
      render(<HodDashboard />);
      await user.click(screen.getByRole('button', { name: /Phúc khảo cấp bộ môn/i }));

      expect(await screen.findByText(/Không kết nối được API Gateway: mất kết nối/)).toBeInTheDocument();
    });

    it('clears a previous error once the refresh button succeeds', async () => {
      installWith({ routes: [{ match: '/api/v1/plagiarism', status: 500, body: { message: 'lỗi tạm thời' } }] });
      const user = userEvent.setup();
      render(<HodDashboard />);
      await screen.findByText('lỗi tạm thời');

      installWith();
      await user.click(screen.getByRole('button', { name: /Làm mới/i }));

      await waitFor(() => expect(screen.queryByText('lỗi tạm thời')).not.toBeInTheDocument());
    });
  });

  describe('refresh control', () => {
    it('re-queries the integrity feed', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await waitFor(() => expect(stub.spy.mock.calls.length).toBeGreaterThan(0));

      stub.spy.mockClear();
      await user.click(screen.getByRole('button', { name: /Làm mới/i }));

      await waitFor(() => expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/plagiarism'))).toBe(true));
    });

    it('re-queries the appeal queue when that tab is active', async () => {
      const user = userEvent.setup();
      render(<HodDashboard />);
      await openAppeals(user);

      stub.spy.mockClear();
      await user.click(screen.getByRole('button', { name: /Làm mới/i }));

      await waitFor(() => expect(stub.spy.mock.calls.some((c) => String(c[0]).includes('/api/v1/appeals'))).toBe(true));
    });
  });
});

describe('PlagiarismService', () => {
  let stub: ReturnType<typeof installFetchStub>;

  const subA = {
    submissionId: 'SUB-A',
    studentName: 'Đinh Thành Trung',
    studentId: 'SE170000',
    sourceCode: 'def solve(a):\n    return a\n',
    language: 'python',
  };
  const subB = {
    submissionId: 'SUB-B',
    studentName: 'Trần Thanh Nguyên',
    studentId: 'SE170123',
    sourceCode: 'def solve(a):\n    return a\n',
    language: 'python',
  };

  /** A payload shaped exactly like the GenAI Hub REST response. */
  const remoteResult = {
    submissionAId: 'SUB-A',
    submissionBId: 'SUB-B',
    similarityRate: 88.5,
    commonFingerprintsCount: 30,
    totalUniqueFingerprints: 40,
    isFlagged: true,
    status: 'FLAGGED_PLAGIARISM',
    executionTimeMs: 17,
    matchedTokensJson: {
      submissionAId: 'SUB-A',
      submissionBId: 'SUB-B',
      similarityRate: 88.5,
      jaccardSimilarity: 75,
      winnowingContainment: 90,
      astStructuralSimilarity: 96,
      totalUniqueFingerprintsA: 40,
      totalUniqueFingerprintsB: 33,
      commonFingerprintsCount: 30,
      matchedSegments: [
        {
          hashValue: 'h1',
          lineRangeA: { start: 1, end: 2 },
          lineRangeB: { start: 3, end: 4 },
          tokenRangeA: { start: 0, end: 5 },
          tokenRangeB: { start: 0, end: 5 },
          tokenCount: 6,
        },
      ],
    },
  };

  beforeEach(() => {
    stub = installFetchStub();
    // The service logs each decision; silencing keeps the run readable.
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    stub.restore();
    vi.restoreAllMocks();
  });

  /** Makes the hub unreachable so the embedded engine has to take over. */
  const forceOffline = (mode: 'http-error' | 'network-error' = 'http-error') => {
    stub.restore();
    if (mode === 'http-error') {
      stub = installFetchStub({ routes: [{ match: '/api/v1/ast/compare', status: 503, body: { message: 'hub down' } }] });
    } else {
      globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as any;
    }
  };

  describe('compareSubmissions', () => {
    it('prefers the GenAI Hub response and maps every field onto the match', async () => {
      installWithRemote(remoteResult);

      const match = await PlagiarismService.compareSubmissions(subA, subB);

      expect(match.similarityRate).toBe(88.5);
      expect(match.isFlagged).toBe(true);
      expect(match.status).toBe('FLAGGED_PLAGIARISM');
      expect(match.executionTimeMs).toBe(17);
      expect(match.jaccardSimilarity).toBe(75);
      expect(match.winnowingContainment).toBe(90);
      expect(match.astStructuralSimilarity).toBe(96);
      // The matched segment line ranges are flattened into [start, end] tuples for the UI.
      expect(match.matchedTokens).toEqual([{ lineA: [1, 2], lineB: [3, 4] }]);
      // The two source bodies are copied straight through so the diff viewer can show them.
      expect(match.sourceCodeA).toBe(subA.sourceCode);
      expect(match.sourceCodeB).toBe(subB.sourceCode);
    });

    it('identifies the matched student from submission B', async () => {
      installWithRemote(remoteResult);

      const match = await PlagiarismService.compareSubmissions(subA, subB);
      expect(match.matchedStudentName).toBe('Trần Thanh Nguyên');
      expect(match.matchedStudentId).toBe('SE170123');
    });

    it('posts both submissions to the compare endpoint', async () => {
      installWithRemote(remoteResult);

      await PlagiarismService.compareSubmissions(subA, subB);

      const call = stub.spy.mock.calls.find((c) => String(c[0]).includes('/api/v1/ast/compare'));
      expect(call).toBeDefined();
      expect(call![1].method).toBe('POST');
      expect(call![1].headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(call![1].body);
      expect(body.submissionA.submissionId).toBe('SUB-A');
      expect(body.submissionB.submissionId).toBe('SUB-B');
    });

    it('tries the second hub URL when the first fails', async () => {
      stub.restore();
      stub = installFetchStub({
        routes: [
          { match: 'localhost:3002', status: 503, body: { message: 'down' } },
          { match: 'localhost:3001', body: remoteResult },
        ],
      });

      const match = await PlagiarismService.compareSubmissions(subA, subB);

      expect(match.similarityRate).toBe(88.5);
      const urls = stub.spy.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('3002'))).toBe(true);
      expect(urls.some((u) => u.includes('3001'))).toBe(true);
    });

    it('abandons a hung hub request and tries the next URL', async () => {
      // The service arms a 1.2s AbortController per URL so a stalled GenAI Hub cannot freeze the
      // modal. This fetch never settles on its own and only rejects once that signal aborts, which
      // is what the timeout has to trigger for the second URL to be reached at all.
      stub.restore();
      const hanging = (input: any, init?: any) =>
        new Promise((_resolve, reject) => {
          if (String(input).includes('localhost:3002')) {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          } else {
            reject(new Error('unexpected url'));
          }
        });
      const remoteSpy = vi.fn(hanging);
      globalThis.fetch = ((input: any, init?: any) => {
        const url = String(input);
        if (url.includes('localhost:3002')) return remoteSpy(input, init);
        // The second hub answers normally.
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => remoteResult,
          text: async () => JSON.stringify(remoteResult),
        } as any);
      }) as any;

      const match = await PlagiarismService.compareSubmissions(subA, subB);

      expect(remoteSpy).toHaveBeenCalledTimes(1);
      expect(match.similarityRate).toBe(88.5);
    }, 10000);

    it('falls back to the embedded engine on a failing HTTP response', async () => {
      forceOffline('http-error');

      const match = await PlagiarismService.compareSubmissions(subA, subB);

      // Identical code must still be flagged even with the hub unreachable.
      expect(match.similarityRate).toBeGreaterThan(0);
      expect(match.isFlagged).toBe(true);
      expect(match.matchedStudentName).toBe('Trần Thanh Nguyên');
      expect(Array.isArray(match.matchedTokens)).toBe(true);
    });

    it('falls back to the embedded engine when the network is unreachable', async () => {
      forceOffline('network-error');

      const match = await PlagiarismService.compareSubmissions(subA, subB);

      expect(typeof match.similarityRate).toBe('number');
      expect(match.sourceCodeA).toBe(subA.sourceCode);
    });

    it('falls back rather than rejecting when a 200 response is unreadable', async () => {
      // A 200 with a null body makes the remote mapping throw; that throw is caught per-URL, so
      // the call has to degrade to the embedded engine instead of rejecting.
      stub.restore();
      stub = installFetchStub({ routes: [{ match: '/api/v1/ast/compare', status: 200, body: null }] });

      const match = await PlagiarismService.compareSubmissions(subA, subB);
      expect(typeof match.similarityRate).toBe('number');
    });

    it('reports a low similarity for unrelated programs through the embedded engine', async () => {
      forceOffline();

      const other = {
        ...subB,
        sourceCode: 'class Queue:\n    def __init__(self):\n        self.items = []\n    def push(self, x):\n        self.items.append(x)\n',
      };
      const match = await PlagiarismService.compareSubmissions(subA, other);

      expect(match.similarityRate).toBeLessThan(70);
      expect(match.isFlagged).toBe(false);
      expect(match.status).not.toContain('FLAGGED');
    });

    it('substitutes placeholder identities when submission B has none', async () => {
      forceOffline();

      const anonymous = { submissionId: 'SUB-B', sourceCode: 'def solve(a):\n    return a\n', language: 'python' };
      const match = await PlagiarismService.compareSubmissions(subA, anonymous);

      // The fallback identity keeps the UI from rendering an empty "matched with" label.
      expect(match.matchedStudentName).toBe('Trần Thanh Nguyên (Kho bài lớp)');
      expect(match.matchedStudentId).toBe('SE170123');
    });

    it('treats an empty student name as missing', async () => {
      forceOffline();

      const blank = { ...subB, studentName: '', studentId: '' };
      const match = await PlagiarismService.compareSubmissions(subA, blank);

      expect(match.matchedStudentName).toBe('Trần Thanh Nguyên (Kho bài lớp)');
      expect(match.matchedStudentId).toBe('SE170123');
    });

    it('records an execution time on the embedded path too', async () => {
      forceOffline();
      const match = await PlagiarismService.compareSubmissions(subA, subB);
      expect(typeof match.executionTimeMs).toBe('number');
      expect(match.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('does not throw when both submissions are empty', async () => {
      forceOffline();
      const match = await PlagiarismService.compareSubmissions(
        { ...subA, sourceCode: '' },
        { ...subB, sourceCode: '' },
      );
      expect(typeof match.similarityRate).toBe('number');
    });
  });

  describe('evaluateBenchmarkPair', () => {
    it('evaluates a known pair through the embedded engine', async () => {
      forceOffline();

      const match = await PlagiarismService.evaluateBenchmarkPair(1);

      expect(match.sourceCodeA).toContain('def calculate_factorial');
      expect(match.sourceCodeB).toContain('def compute_fact');
      expect(typeof match.similarityRate).toBe('number');
    });

    it('names the benchmark side after the pair title', async () => {
      forceOffline();

      const match = await PlagiarismService.evaluateBenchmarkPair(2);

      // The benchmark submission is the "other" paper, so its label is the pair title, which is
      // what the diff viewer prints as the matched student.
      expect(match.matchedStudentName).toMatch(/Pair 0?2/);
    });

    it('falls back to the first pair for an unknown id', async () => {
      forceOffline();

      const match = await PlagiarismService.evaluateBenchmarkPair(9999);

      // An unknown id must not throw; it degrades to the first benchmark pair.
      expect(match.sourceCodeA).toContain('def calculate_factorial');
    });

    it('flags the near-duplicate renaming benchmark', async () => {
      forceOffline();

      const match = await PlagiarismService.evaluateBenchmarkPair(1);
      expect(match.isFlagged).toBe(true);
      expect(match.similarityRate).toBeGreaterThanOrEqual(70);
    });

    it('does not flag the independent-code negative control', async () => {
      forceOffline();

      const match = await PlagiarismService.evaluateBenchmarkPair(10);
      expect(match.isFlagged).toBe(false);
      expect(match.similarityRate).toBeLessThan(70);
    });

    it('uses the hub when it answers', async () => {
      installWithRemote(remoteResult);

      const match = await PlagiarismService.evaluateBenchmarkPair(3);
      expect(match.similarityRate).toBe(88.5);
    });
  });

  describe('getBenchmarkPairs', () => {
    it('returns the full RBL benchmark set', () => {
      const pairs = PlagiarismService.getBenchmarkPairs();
      expect(pairs.length).toBeGreaterThan(0);
      for (const pair of pairs) {
        expect(typeof pair.pairId).toBe('number');
        expect(typeof pair.title).toBe('string');
        expect(typeof pair.expectedIsPlagiarized).toBe('boolean');
        expect(pair.codeA.length).toBeGreaterThan(0);
        expect(pair.codeB.length).toBeGreaterThan(0);
      }
    });

    it('exposes unique pair ids', () => {
      const ids = PlagiarismService.getBenchmarkPairs().map((p) => p.pairId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('returns the same array instance on every call', () => {
      expect(PlagiarismService.getBenchmarkPairs()).toBe(PlagiarismService.getBenchmarkPairs());
    });
  });

  /** Points the router at a successful hub response. */
  function installWithRemote(body: unknown) {
    stub.restore();
    stub = installFetchStub({ routes: [{ match: '/api/v1/ast/compare', body }] });
  }
});
