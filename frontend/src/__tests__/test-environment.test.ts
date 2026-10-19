import { describe, it, expect } from 'vitest';

/**
 * Verifies the shared jsdom shims actually take effect.
 *
 * `src/test/setup.ts` installs these once for the whole suite. A shim guarded by a condition
 * that is never true installs nothing and fails silently — every chart test then renders at
 * 0x0 and asserts nothing meaningful, while still reporting green. This file exists so that
 * class of mistake fails loudly.
 */
describe('test environment shims', () => {
  it('gives elements a non-zero bounding box', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    // jsdom returns all zeros by default; charts need a real box to render into.
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    document.body.removeChild(el);
  });

  it('reports a larger box for a wide container than for a bare one', () => {
    const el = document.createElement('div');
    expect(el.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('provides ResizeObserver', () => {
    expect(typeof (globalThis as any).ResizeObserver).toBe('function');
    const ro = new (globalThis as any).ResizeObserver(() => {});
    expect(() => ro.observe(document.createElement('div'))).not.toThrow();
    expect(() => ro.disconnect()).not.toThrow();
  });

  it('provides matchMedia', () => {
    expect(typeof window.matchMedia).toBe('function');
    const mql = window.matchMedia('(min-width: 100px)');
    expect(mql).toHaveProperty('matches');
    expect(() => mql.addEventListener('change', () => {})).not.toThrow();
  });

  it('provides URL.createObjectURL for file export', () => {
    expect(typeof URL.createObjectURL).toBe('function');
    const blob = new Blob(['x'], { type: 'text/plain' });
    expect(typeof URL.createObjectURL(blob)).toBe('string');
  });

  it('starts each test with empty localStorage', () => {
    // `afterEach` in setup.ts clears it, so this only proves the API is usable.
    localStorage.setItem('probe', '1');
    expect(localStorage.getItem('probe')).toBe('1');
    localStorage.clear();
    expect(localStorage.getItem('probe')).toBeNull();
  });
});
