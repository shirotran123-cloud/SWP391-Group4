/**
 * Single source of truth for backend URLs.
 *
 * The URL used to be hardcoded as `http://localhost:3000` in five components and a further six
 * places inline. That works on a developer's machine and breaks the moment the app is deployed:
 * the bundle is executed by the *visitor's* browser, so `localhost:3000` means the visitor's own
 * machine, not the server. The symptom is a deployed site whose every request fails with a
 * connection error while the server logs show no traffic at all.
 *
 * Resolution order:
 *   1. `VITE_API_BASE_URL` — set at BUILD time, because Vite inlines `import.meta.env` into the
 *      bundle. A runtime environment variable would arrive too late to have any effect.
 *   2. Same-origin when the page is served over http(s) and no explicit URL was configured.
 *      This is what a single-service deployment needs: the gateway serves the built frontend and
 *      proxies `/api` on the same host, so no cross-origin request or CORS pre-flight is involved.
 *   3. `http://localhost:3000` — the development default, used when the page is opened from the
 *      filesystem or from a test runner where `window.location` has no meaningful origin.
 *
 * The decision itself lives in `resolveBackendUrl`, a pure function, because Vite substitutes
 * `import.meta.env` at transform time: a test cannot change the value the module already captured.
 * Keeping the logic pure makes it verifiable without depending on build-time substitution.
 */

export interface UrlResolutionInput {
  /** Value of `VITE_API_BASE_URL`, or undefined when it was never set at build time. */
  configured?: string;
  /** Page protocol, e.g. `https:`. */
  protocol?: string;
  /** Page host, e.g. `aita.onrender.com` or `localhost:5173`. */
  host?: string;
}

const DEV_DEFAULT = 'http://localhost:3000';

/**
 * Decides which backend origin to use.
 *
 * An empty string is a valid configured value meaning "same origin", which is why this checks
 * `undefined` rather than truthiness — treating `''` as unset would silently send a deployed
 * build back to localhost.
 */
export function resolveBackendUrl(input: UrlResolutionInput): string {
  const configured = input.configured;
  if (configured !== undefined && configured !== '') {
    return configured.replace(/\/+$/, '');
  }

  // jsdom, `file://` and `about:blank` have no usable backend origin.
  const protocol = input.protocol;
  const host = input.host;
  if (protocol !== 'http:' && protocol !== 'https:') return DEV_DEFAULT;
  if (!host) return DEV_DEFAULT;

  return `${protocol}//${host}`;
}

function currentPageOrigin(): { protocol?: string; host?: string } {
  if (typeof window === 'undefined' || !window.location) return {};
  return { protocol: window.location.protocol, host: window.location.host };
}

export const API_BASE_URL: string = resolveBackendUrl({
  configured: (import.meta as any).env?.VITE_API_BASE_URL,
  ...currentPageOrigin(),
});

/** The GenAI Hub is a separate service; in a single-service deployment it is proxied too. */
export const GENAI_HUB_URL: string = resolveBackendUrl({
  configured: (import.meta as any).env?.VITE_GENAI_HUB_URL,
  ...currentPageOrigin(),
});

/** Builds an absolute backend URL from a path such as `/api/v1/courses`. */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

/** Builds a GenAI Hub URL. Falls back to the API host when the hub is proxied alongside it. */
export function hubUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${GENAI_HUB_URL}${suffix}`;
}
