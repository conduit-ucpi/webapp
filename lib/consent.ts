/**
 * Cookie consent for analytics (UK PECR / EU ePrivacy).
 *
 * The visitor's choice is kept in a first-party cookie. That cookie is itself
 * strictly necessary — it exists only to remember the answer — so it needs no
 * consent of its own. It expires after six months, after which the banner asks
 * again, in line with ICO/CNIL guidance on how long a choice may be relied on.
 *
 * Google Analytics is never loaded until the visitor has said yes.
 *
 * The measurement ID comes from NEXT_PUBLIC_GA_MEASUREMENT_ID, which Next
 * inlines at build time, so it must be set when building, not on the running
 * container. A build without it has no analytics at all, and so nothing to ask
 * consent for: the banner stays hidden (see analyticsEnabled).
 */

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_COOKIE = 'cookie_consent';
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

export function analyticsEnabled(): boolean {
  return GA_MEASUREMENT_ID !== '';
}

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

/** Fired on window to reopen the banner, e.g. from a footer "Cookie settings" link. */
export const OPEN_CONSENT_EVENT = 'cookie-consent:open';

export function readConsent(): ConsentChoice | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  const value = match?.slice(CONSENT_COOKIE.length + 1);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function writeConsent(choice: ConsentChoice): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let gaLoaded = false;

export function loadAnalytics(): void {
  if (!analyticsEnabled()) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (gaLoaded) return;
  gaLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads the Arguments object itself, not an array copy.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Stops GA for the rest of this page's life and deletes the cookies it set.
 * GA writes them on the registrable domain (e.g. `.conduit-ucpi.com`), so each
 * parent of the current host is tried; the browser ignores the ones that miss.
 */
export function disableAnalytics(): void {
  if (!analyticsEnabled()) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;

  const gaCookies = document.cookie
    .split('; ')
    .map((c) => c.split('=')[0])
    .filter((name) => name === '_ga' || name.startsWith('_ga_') || name === '_gid' || name === '_gat');

  const labels = window.location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < labels.length - 1; i++) {
    domains.push(`; Domain=.${labels.slice(i).join('.')}`);
  }

  for (const name of gaCookies) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }
}

/**
 * This visitor's GA client id, for the `purchase` event the backend sends when an escrow they
 * paid is funded (registered with the SDK's payment pages in ClientOnlyApp). Null unless they
 * accepted analytics and GA is running — so withdrawing consent stops it at once, even though
 * `window.gtag` stays defined.
 *
 * gtag queues commands until gtag.js has loaded, so the answer can take a moment; a GA that
 * never answers (blocked by an extension, say) gives up rather than hold anything up.
 */
export function analyticsClientId(timeoutMs = 2000): Promise<string | null> {
  if (!analyticsEnabled() || !gaLoaded || readConsent() !== 'granted') return Promise.resolve(null);
  if (window[`ga-disable-${GA_MEASUREMENT_ID}`] || !window.gtag) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    window.gtag!('get', GA_MEASUREMENT_ID, 'client_id', (id: unknown) => {
      clearTimeout(timer);
      resolve(typeof id === 'string' && id ? id : null);
    });
  });
}
