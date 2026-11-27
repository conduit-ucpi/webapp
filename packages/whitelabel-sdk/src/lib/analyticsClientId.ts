/**
 * Where the payment pages get the buyer's analytics client id, for the GA4 `purchase` event the
 * backend sends when their escrow is funded.
 *
 * ⚠️ SET BY THE HOST APP, NEVER READ FROM THE PAGE. These pages also run on partners' sites, where
 *    `window.gtag` is the partner's own Google Analytics: its client id means nothing in ours, and
 *    sending it would be collecting the partner's visitors' ids without their say. Our webapp
 *    registers a source that answers only once the visitor has consented to analytics; anywhere
 *    nothing is registered, nothing is sent.
 */
type AnalyticsClientIdSource = () => Promise<string | null>;

let source: AnalyticsClientIdSource | null = null;

export function setAnalyticsClientIdSource(next: AnalyticsClientIdSource | null): void {
  source = next;
}

/** The registered source's answer, or null — never a throw. */
export async function analyticsClientId(): Promise<string | null> {
  if (!source) return null;
  try {
    return await source();
  } catch {
    return null;
  }
}

/**
 * Puts this visitor's client id on a contract they just started, for the `purchase` event sent
 * when it is funded. Called by whoever STARTED the payment on our site — the seller making a
 * request, or a buyer pushing a payment from /pay — never by a buyer paying someone else's
 * request: that revenue is the seller's, who brought the buyer. contractservice keeps the first
 * id it is given.
 *
 * Fire and forget: nothing here may hold up or fail a payment. Unattributed is the worst outcome.
 */
export async function attachAnalyticsClientId(
  contractId: string,
  fetcher: (url: string, init?: RequestInit) => Promise<Response>
): Promise<void> {
  const clientId = await analyticsClientId();
  if (!clientId) return;
  try {
    await fetcher(`/api/contracts/${encodeURIComponent(contractId)}/analytics-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
  } catch {
    // Unattributed.
  }
}
