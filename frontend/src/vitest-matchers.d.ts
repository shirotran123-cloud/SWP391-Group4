/**
 * Pulls the `@testing-library/jest-dom` matcher types into the test typecheck.
 *
 * Importing the package registers matchers such as `toBeInTheDocument` at runtime, but the
 * type declarations only apply when the package has been referenced. This file exists purely
 * for that side effect so `tsc -p tsconfig.test.json` understands the matchers.
 */
import '@testing-library/jest-dom/vitest';
