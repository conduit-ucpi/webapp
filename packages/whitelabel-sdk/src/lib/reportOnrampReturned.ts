import { apiFetch } from './apiFetch';
import { reportOnrampStatus } from './reportOnrampStatus';

/**
 * Tells the server Coinbase sent a buyer back. See pages/api/coinbase/onramp-returned.ts.
 *
 * Fire and forget, and sent with keepalive because this page leaves or closes straight away. The
 * contract comes from the path they are returning to, when that is a payment request.
 */
export async function reportOnrampReturned(returnPath: unknown): Promise<void> {
  try {
    const path = typeof returnPath === 'string' ? returnPath : '/';
    // And how the purchase stands at Coinbase, logged beside this line.
    void reportOnrampStatus('returned', path);
    const contractId = new URL(path, window.location.origin).searchParams.get('contractId');
    const query = contractId ? `?contract=${encodeURIComponent(contractId)}` : '';
    await apiFetch(`/api/coinbase/onramp-returned${query}`, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    });
  } catch {
    // Unrecorded.
  }
}
