import { describe, it, expect } from 'vitest';
import { resolveBackendUrl, apiUrl, hubUrl, API_BASE_URL, GENAI_HUB_URL } from '../config/api';

/**
 * The backend URL decides whether a deployed build works at all.
 *
 * The bug this guards against is specific and destructive: `http://localhost:3000` was
 * hardcoded across the app, so a deployed bundle instructed every visitor's browser to call
 * *their own* machine. The server logs stayed empty while the UI failed with connection errors,
 * which reads like a backend outage rather than a frontend configuration mistake.
 *
 * Vite substitutes `import.meta.env` at transform time, so a test cannot change the value the
 * module already captured. That is why the decision lives in the pure `resolveBackendUrl`
 * function below and is tested directly, while a separate block checks the module wired it up.
 */
describe('resolveBackendUrl', () => {
  it('uses the configured URL when one was set at build time', () => {
    const url = resolveBackendUrl({
      configured: 'https://aita-api.onrender.com',
      protocol: 'https:',
      host: 'aita-web.onrender.com',
    });
    expect(url).toBe('https://aita-api.onrender.com');
  });

  it('strips a trailing slash so paths do not double up', () => {
    expect(resolveBackendUrl({ configured: 'https://api.example.com/' })).toBe('https://api.example.com');
    expect(resolveBackendUrl({ configured: 'https://api.example.com///' })).toBe('https://api.example.com');
  });

  it('falls back to the page origin when nothing was configured', () => {
    // The single-service deployment case: the API is proxied on the same host.
    expect(resolveBackendUrl({ configured: undefined, protocol: 'https:', host: 'aita.onrender.com' })).toBe(
      'https://aita.onrender.com',
    );
  });

  it('preserves the scheme of the serving page', () => {
    expect(resolveBackendUrl({ configured: undefined, protocol: 'http:', host: '192.168.1.50:8080' })).toBe(
      'http://192.168.1.50:8080',
    );
  });

  it('never resolves to localhost when served over https', () => {
    // The exact production failure. An https page calling http:// is blocked as mixed content,
    // so this must not be possible on a deployed site.
    const url = resolveBackendUrl({ configured: undefined, protocol: 'https:', host: 'aita.onrender.com' });
    expect(url).not.toContain('localhost');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('treats an empty configured value as "same origin" rather than as unset', () => {
    // Treating '' as unset would silently send a deployed build back to localhost.
    expect(resolveBackendUrl({ configured: '', protocol: 'https:', host: 'aita.onrender.com' })).toBe(
      'https://aita.onrender.com',
    );
  });

  it('falls back to localhost for a filesystem page', () => {
    expect(resolveBackendUrl({ configured: undefined, protocol: 'file:', host: '' })).toBe(
      'http://localhost:3000',
    );
  });

  it('falls back to localhost when there is no page origin at all', () => {
    expect(resolveBackendUrl({ configured: undefined })).toBe('http://localhost:3000');
  });

  it('falls back to localhost for a non-http protocol', () => {
    expect(resolveBackendUrl({ configured: undefined, protocol: 'about:', host: '' })).toBe(
      'http://localhost:3000',
    );
  });

  it('accepts an IP address host with a port', () => {
    expect(resolveBackendUrl({ configured: undefined, protocol: 'http:', host: '127.0.0.1:3000' })).toBe(
      'http://127.0.0.1:3000',
    );
  });
});

describe('url builders', () => {
  it('builds an API path with a leading slash', () => {
    expect(apiUrl('/api/v1/users')).toBe(`${API_BASE_URL}/api/v1/users`);
  });

  it('accepts a path without a leading slash', () => {
    expect(apiUrl('api/v1/users')).toBe(`${API_BASE_URL}/api/v1/users`);
  });

  it('builds a hub path', () => {
    expect(hubUrl('/health')).toBe(`${GENAI_HUB_URL}/health`);
  });
});

describe('module wiring', () => {
  it('exposes a usable backend URL under the test runner', () => {
    // jsdom serves from http://localhost:3000 by default, so the resolved value is either that
    // origin or the configured override — never an empty string, which would produce requests
    // to a relative path and fail confusingly.
    expect(API_BASE_URL).toBeTruthy();
    expect(API_BASE_URL).toMatch(/^https?:\/\//);
  });

  it('exposes a hub URL', () => {
    expect(GENAI_HUB_URL).toBeTruthy();
    expect(GENAI_HUB_URL).toMatch(/^https?:\/\//);
  });

  it('produces an absolute URL from apiUrl', () => {
    expect(apiUrl('/api/v1/x')).toMatch(/^https?:\/\/.+\/api\/v1\/x$/);
  });
});
