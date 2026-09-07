/**
 * Single entry point for calls to the Node API.
 *
 * Every call site used to be a relative `fetch('/api/...')`, which the browser
 * resolves against whatever origin served the page. That is correct while the app
 * and the API are the same box, but the static GitHub Pages build has no server of
 * its own — a relative path there resolves to the Pages domain and 404s. See
 * STATIC_FRONTEND_MIGRATION_PLAN.md.
 *
 * NEXT_PUBLIC_API_BASE_URL is empty for the box build, so `${''}/api/x` is byte
 * for byte the relative path it always was and nothing changes. The Pages build
 * sets it to the box's API hostname (https://api.stabledrop.me).
 */

/** '' on the box; the API origin for the static build. No trailing slash. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Absolute URL for an API path. Pass paths beginning with '/api/'.
 *
 * Already-absolute URLs pass through untouched, so this is safe to apply in
 * helpers that take a caller-supplied url and may be handed either form.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

/**
 * `fetch`, pointed at the API and carrying cookies.
 *
 * `credentials: 'include'` is the default because the session cookie has to travel
 * cross-origin once the frontend moves to Pages. On the box this is a no-op: the
 * request is same-origin, where cookies are sent anyway. It is spread first so an
 * explicit `credentials` in `init` still wins.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { credentials: 'include', ...init });
}
