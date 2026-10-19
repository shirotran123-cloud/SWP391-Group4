import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Frontend test configuration.
 *
 * Milestone 3 requires ≥80% unit-test coverage on backend AND frontend. The backend has been
 * measured with c8; this file gives the frontend the same treatment with Vitest's V8 provider.
 *
 * The thresholds are declared here rather than passed on the command line so that
 * `npm test` fails the build the moment coverage drops — a CI gate cannot be skipped by
 * forgetting a flag.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Count every source file, including ones no test imports yet. Without `all`, an
      // untested file is simply absent from the report and the percentage looks better
      // than reality — which is exactly the trap this gate must avoid.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        // Pure type declarations: `types.ts` exports only interfaces and type aliases, so it
        // emits no runnable code and no test can ever execute a line of it. Counting it would
        // report a permanent 0% that says nothing about test quality.
        'src/types.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
