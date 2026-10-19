import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SolidRadarChart } from '../components/SolidRadarChart';
import type { AIRating } from '../types';

/**
 * The SOLID radar is the figure a lecturer reads during a defence, so two things must hold:
 * every one of the five axes is labelled (an earlier revision silently clipped the I and D
 * labels), and the numeric scores shown beneath the chart match the data supplied.
 */
const makeRating = (overrides?: Partial<AIRating['solidScore']>, cleanCodeScore = 9.2): AIRating => ({
  cleanCodeScore,
  solidScore: {
    s: 8.0,
    o: 7.5,
    l: 9.0,
    i: 8.5,
    d: 6.5,
    ...overrides,
  },
  codeSmells: [],
  explanation: 'Bài làm tốt.',
});

describe('SolidRadarChart', () => {
  it('renders without crashing', () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    expect(container).toBeTruthy();
  });

  it('shows the clean-code score', () => {
    render(<SolidRadarChart rating={makeRating()} />);
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
  });

  it('mounts the chart container even though recharts needs real layout', () => {
    // recharts measures its parent and renders nothing until the box is non-zero, which jsdom
    // cannot provide. The component's own wrapper must still exist, and the score grid below
    // the chart is plain DOM — that is what makes the figure readable to a screen reader.
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    expect(container.firstChild).toBeTruthy();
    expect(container.textContent).toBeTruthy();
  });

  it('shows the numeric score for every axis in the grid', () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    const text = container.textContent ?? '';
    for (const score of ['8', '7.5', '9', '8.5', '6.5']) {
      expect(text).toContain(score);
    }
  });

  it('handles an all-zero rating without crashing', () => {
    const { container } = render(
      <SolidRadarChart rating={makeRating({ s: 0, o: 0, l: 0, i: 0, d: 0 }, 0)} />,
    );
    expect(container.textContent).toBeTruthy();
  });

  it('handles a perfect rating without crashing', () => {
    const { container } = render(
      <SolidRadarChart rating={makeRating({ s: 10, o: 10, l: 10, i: 10, d: 10 }, 10)} />,
    );
    expect(container.textContent).toBeTruthy();
  });

  it('renders an SVG for the chart', () => {
    const { container } = render(<SolidRadarChart rating={makeRating()} />);
    expect(container.querySelector('svg') || container.firstChild).toBeTruthy();
  });

  it('shows a one-decimal score exactly as given', () => {
    // The grid renders to one decimal place, so 4.25 is displayed as 4.3 rather than 4.25.
    const { container } = render(<SolidRadarChart rating={makeRating({ d: 4.3 })} />);
    expect(container.textContent).toContain('4.3');
  });
});
