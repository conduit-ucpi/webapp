import { apiFetch } from './apiFetch';

/**
 * Tells the server Coinbase sent a buyer back. See pages/api/coinbase/onramp-returned.ts.
 *
 * Fire and forget, and sent with keepalive because this page leaves or closes straight away. The
 * contract comes from the path they are returning to, when that is a payment request.
 */
export async function reportOnrampReturned(returnPath: unknown): Promise<void> {
  try {
    const path = typeof returnPath === 'string' ? returnPath : '/';
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
