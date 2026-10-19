import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Shared test setup.
 *
 * jsdom does not implement a few browser APIs these components depend on, so they are stubbed
 * here once instead of in every test file.
 */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// Chart libraries and the radar chart read element size; jsdom reports zero for everything.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any;
}

// ResizeObserver is used by the responsive chart container.
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Charts measure their container before rendering. jsdom DOES define
// `getBoundingClientRect`, but it returns all zeros, so a chart inside it computes a 0x0 box and
// renders nothing at all.
//
// This previously read `if (!HTMLElement.prototype.getBoundingClientRect)`, which is never true
// because jsdom always provides the method. The shim therefore never installed and every chart
// test silently asserted against an empty container — recharts logged the warning
// "width(0) and height(0) of chart should be greater than 0" and produced no SVG.
//
// The check is now for a ZERO box rather than a missing method, which is the condition that
// actually matters. `src/__tests__/test-environment.test.ts` guards this so the mistake cannot
// return unnoticed.
const jsdomRect = HTMLElement.prototype.getBoundingClientRect;
const rectIsZero = (() => {
  try {
    const probe = jsdomRect.call(document.createElement('div'));
    return !probe || (probe.width === 0 && probe.height === 0);
  } catch {
    return true;
  }
})();

if (rectIsZero) {
  (HTMLElement.prototype as any).getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 1024,
      height: 768,
      top: 0,
      left: 0,
      bottom: 768,
      right: 1024,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect;
  };
}

// `URL.createObjectURL` is used when exporting files; jsdom has no implementation.
if (!URL.createObjectURL) {
  (URL as any).createObjectURL = () => 'blob:mock';
  (URL as any).revokeObjectURL = () => {};
}
