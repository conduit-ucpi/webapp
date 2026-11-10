import { apiFetch } from './apiFetch';
import { visitorCountry } from './visitorCountry';

export type FundingEvent =
  | 'privy-started'
  | 'privy-completed'
  | 'privy-cancelled'
  | 'privy-failed'
  | 'transfer-opened'
  | 'kraken-opened'
  | 'link-opened'
  | 'other-wallet-opened';

/**
 * Tells the server about a funding step only the browser can see. See pages/api/funding-event.ts.
 *
 * Fire and forget, so nothing here may hold up or fail a payment. The contract comes from the page's
 * address, when this is a payment request. No cookies: the wallet is what the line is matched by.
 */
export async function reportFundingEvent(
  event: FundingEvent,
  fields: { wallet?: string; amount?: string; detail?: string } = {}
): Promise<void> {
  try {
    await apiFetch('/api/funding-event', {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        contract: new URLSearchParams(window.location.search).get('contractId') ?? undefined,
        locale: navigator.language,
        country: (await visitorCountry()) ?? undefined,
        ...fields,
      }),
    });
  } catch {
    // Unrecorded.
  }
}
