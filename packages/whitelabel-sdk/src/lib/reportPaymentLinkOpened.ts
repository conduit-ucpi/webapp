import { apiFetch } from './apiFetch';

/**
 * Tells the server a payment link was opened, so the log records it even if the visitor never signs
 * in. See pages/api/contracts/[id]/link-opened.ts.
 *
 * Sends no cookies and no visitor identifier: the line says which link, not who opened it.
 *
 * Fire and forget: nothing here may hold up or fail a payment. A partner's site without this route
 * gets a 404, which is ignored like any other failure.
 */
export async function reportPaymentLinkOpened(contractId: string): Promise<void> {
  try {
    await apiFetch(`/api/contracts/${encodeURIComponent(contractId)}/link-opened`, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    });
  } catch {
    // Unrecorded.
  }
}
