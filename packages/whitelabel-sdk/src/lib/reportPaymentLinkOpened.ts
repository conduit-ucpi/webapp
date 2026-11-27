import { apiFetch } from './apiFetch';

/**
 * Tells the server a payment link was opened, so the log records it even if the visitor never signs
 * in. See pages/api/contracts/[id]/link-opened.ts.
 *
 * Sends no cookies and no visitor identifier: the line says which link, not who opened it. It
 * does say whether this page is inside a frame, and the server adds the browser's User-Agent, so
 * the log shows what kind of browser a link was opened in.
 *
 * Fire and forget: nothing here may hold up or fail a payment. A partner's site without this route
 * gets a 404, which is ignored like any other failure.
 *
 * Once per browser tab per link: a reload, or coming back from Coinbase in the same tab, is the same
 * visit. Where the tab's storage is unavailable it is recorded every time, since an extra line costs
 * less than a missing one.
 */
export async function reportPaymentLinkOpened(contractId: string): Promise<void> {
  if (alreadyReportedInThisTab(contractId)) return;
  try {
    await apiFetch(`/api/contracts/${encodeURIComponent(contractId)}/link-opened?framed=${framed()}`, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    });
  } catch {
    // Unrecorded.
  }
}

function framed(): '1' | '0' {
  try {
    return window.self !== window.top ? '1' : '0';
  } catch {
    return '1'; // Reading `top` is refused only from inside someone else's frame.
  }
}

function alreadyReportedInThisTab(contractId: string): boolean {
  const key = `paymentLinkOpened:${contractId}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
  } catch {
    // Blocked storage: report it.
  }
  return false;
}
