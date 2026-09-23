/**
 * Guard for client-side redirect targets that derive from user-controlled input
 * (the `return` query param, flowing through buildWordPressStatusUrl into
 * window.location.href / window.opener.location.href).
 *
 * Returns the candidate ONLY if it is a safe navigation target:
 *   - an absolute http:// or https:// URL, or
 *   - a same-origin relative path beginning with a single "/"
 * Otherwise returns `fallback`.
 *
 * This closes the DOM-XSS vector (CodeQL js/xss) by rejecting dangerous schemes
 * such as javascript:, data:, vbscript:, and file:. Scheme-relative URLs
 * ("//host/…") are rejected too, since they navigate cross-origin while looking
 * relative.
 *
 * NOTE: this does NOT restrict which http(s) host may be redirected to — an
 * open redirect to an arbitrary https site is still possible and remains a
 * phishing consideration. Constraining the host to an allow-list is a separate,
 * larger change (it needs the set of legitimate merchant/WordPress origins).
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function safeRedirectUrl(
  candidate: string | string[] | null | undefined,
  fallback: string = '/dashboard'
): string {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return fallback;
  }

  const trimmed = candidate.trim();

  // Same-origin relative path: a single leading slash, but NOT "//" (which is
  // scheme-relative and navigates cross-origin).
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return candidate;
  }

  // Absolute URL: only http/https schemes are safe navigation targets.
  try {
    const url = new URL(trimmed);
    if (SAFE_PROTOCOLS.has(url.protocol)) {
      return candidate;
    }
  } catch {
    // Unparseable — fall through to the fallback.
  }

  return fallback;
}
