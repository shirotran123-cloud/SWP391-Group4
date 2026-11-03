/**
 * Ngrok compatibility patch.
 * The ngrok free plan returns an HTML "browser warning" page instead of the real
 * API response unless the request carries the `ngrok-skip-browser-warning` header.
 * This patch adds that header to every fetch() aimed at the API Gateway when
 * VITE_API_URL points to an ngrok domain. It has no effect in local dev.
 */
import { API_BASE_URL } from './api';

export const IS_NGROK_BACKEND = /ngrok/i.test(API_BASE_URL);

export function installNgrokFetchPatch(): void {
  if (!IS_NGROK_BACKEND || typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (!url.startsWith(API_BASE_URL)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set('ngrok-skip-browser-warning', 'true');

    return originalFetch(input, { ...init, headers });
  };
}

