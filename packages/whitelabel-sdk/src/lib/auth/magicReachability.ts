/**
 * Pre-flight check: is `tee.express.magiclabs.com` reachable from this browser?
 *
 * Reown's social-login embedded wallet (Google/Apple/etc.) delegates the
 * actual signing to Magic Labs. If the user's network blocks magiclabs.com
 * (BT Web Protect, NextDNS, Pi-hole, ad-blocker browser extensions), social
 * login will silently fail with `Magic RPC Error: -32603 Error signing` only
 * when the user clicks sign-in — by which point they've made several wrong
 * choices already.
 *
 * This module probes the host on app load so we can hide social-login options
 * upfront and show a banner explaining the issue, instead of letting the user
 * walk into the failure.
 */

const MAGIC_PROBE_URL = 'https://tee.express.magiclabs.com/health';
const PROBE_TIMEOUT_MS = 2500;

let cachedProbe: Promise<boolean> | null = null;

/**
 * Returns true if magiclabs.com appears reachable, false if it's being
 * blocked at the DNS / network level.
 *
 * The probe uses `mode: 'no-cors'` because we don't care about the response
 * body — only whether TCP/TLS handshake succeeds. A blocked host will throw
 * a TypeError ("Failed to fetch"); a reachable host will resolve to an opaque
 * response. Either way is enough signal.
 *
 * Result is cached for the lifetime of the page so we don't re-probe on every
 * connect attempt.
 */
export function isMagicReachable(): Promise<boolean> {
  if (cachedProbe) return cachedProbe;

  cachedProbe = (async () => {
    if (typeof fetch === 'undefined') return true; // SSR — assume reachable
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        await fetch(MAGIC_PROBE_URL, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
          credentials: 'omit',
        });
        return true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Network error, DNS failure, or connection refused — all mean blocked.
      return false;
    }
  })();

  return cachedProbe;
}

/**
 * For tests: forget the cached probe so the next call probes again.
 */
export function resetMagicReachabilityCache(): void {
  cachedProbe = null;
}
