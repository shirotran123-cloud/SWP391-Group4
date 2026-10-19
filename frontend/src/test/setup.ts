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

// Recharts/recharts-like containers measure themselves; give them a non-zero box.
if (!(HTMLElement.prototype as any).getBoundingClientRect) {
  (HTMLElement.prototype as any).getBoundingClientRect = () => ({
    width: 400,
    height: 300,
    top: 0,
    left: 0,
    bottom: 300,
    right: 400,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
}

// `URL.createObjectURL` is used when exporting files; jsdom has no implementation.
if (!URL.createObjectURL) {
  (URL as any).createObjectURL = () => 'blob:mock';
  (URL as any).revokeObjectURL = () => {};
}
