/**
 * The buyer's country as Cloudflare sees it, for greying out what cannot serve them.
 *
 * /cdn-cgi/trace is answered by Cloudflare on any domain it serves, so this is the page's own origin
 * and not apiFetch: the API is not behind Cloudflare. As far as we know it is not a documented API,
 * and it does not exist on localhost or a domain outside Cloudflare, so null is an ordinary answer.
 *
 * ⚠️ FOR ADVICE ONLY. A VPN or a trip abroad gives the wrong country, and a browser can claim any.
 *    Offer an override wherever this greys something out, and never rely on it to enforce anything.
 *
 * Read once per page. It is not stored or sent anywhere except with the funding log lines.
 */
let pending: Promise<string | null> | null = null;

async function read(): Promise<string | null> {
  try {
    // Localhost has no Cloudflare, so ?testCountry=VE stands in for it there. Never in a build.
    if (process.env.NODE_ENV !== 'production') {
      const test = new URLSearchParams(window.location.search).get('testCountry');
      if (test) return test.toUpperCase();
    }
    const response = await fetch('/cdn-cgi/trace', { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const country = (await response.text()).match(/^loc=([A-Z]{2})$/m)?.[1];
    // XX is Cloudflare's "no country data".
    return country && country !== 'XX' ? country : null;
  } catch {
    return null;
  }
}

export function visitorCountry(): Promise<string | null> {
  pending ??= read();
  return pending;
}

export function _resetVisitorCountryForTesting(): void {
  pending = null;
}
