import { apiFetch } from './apiFetch';
import { visitorCountry } from './visitorCountry';
import { fundingContract } from './fundingContract';

export type FundingEvent =
  | 'privy-started'
  | 'privy-completed'
  | 'privy-processing'
  | 'privy-cancelled'
  | 'privy-failed'
  | 'transfer-opened'
  | 'kraken-opened'
  | 'link-opened'
  | 'other-wallet-opened'
  | 'choice-opened'
  | 'coinbase-opened'
  | 'coinbase-closed'
  | 'card-service-opened'
  | 'exchange-opened'
  | 'balance-checked'
  | 'paid-pressed'
  | 'wallet-funded'
  | 'balance-polled'
  | 'address-polled'
  | 'trouble-shown'
  | 'trouble-reason'
  | 'trouble-action';

/** Where a purchase was to land: straight into the payment, or into the wallet to pay from. */
export type FundingRoute = 'payment' | 'wallet';

/**
 * Tells the server about a funding step only the browser can see. See pages/api/funding-event.ts.
 *
 * Fire and forget, so nothing here may hold up or fail a payment. The contract is the payment the
 * page says it is showing (lib/fundingContract), or the one in its address. The session goes with it: the server names the signed-in
 * user in the line from the session, never from anything sent here.
 */
export async function reportFundingEvent(
  event: FundingEvent,
  fields: { wallet?: string; amount?: string; detail?: string; provider?: string; route?: FundingRoute } = {}
): Promise<void> {
  try {
    await apiFetch('/api/funding-event', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        contract: fundingContract(),
        locale: navigator.language,
        country: (await visitorCountry()) ?? undefined,
        ...fields,
      }),
    });
  } catch {
    // Unrecorded.
  }
}
