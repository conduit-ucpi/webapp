import { apiFetch } from './apiFetch';

/** What prompted the look: back on the return page, the popup closed, or "check my balance". */
export type OnrampStatusTrigger = 'returned' | 'closed' | 'balance-checked';

/**
 * Has the server ask Coinbase how this buyer's card purchases stand, and log it. See
 * pages/api/coinbase/onramp-status.ts. The answer is only logged: nothing comes back to act on.
 *
 * Fire and forget, with keepalive since the return page closes straight away. The session cookie
 * goes with it: Coinbase is asked about the signed-in buyer, never one named here. The contract
 * comes from `path` (the page being returned to) or this page's own address.
 */
export async function reportOnrampStatus(trigger: OnrampStatusTrigger, path?: string): Promise<void> {
  try {
    const contractId = new URL(path ?? window.location.href, window.location.origin).searchParams.get('contractId');
    const query = new URLSearchParams({ trigger });
    if (contractId) query.set('contract', contractId);
    await apiFetch(`/api/coinbase/onramp-status?${query.toString()}`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    // Unrecorded.
  }
}
