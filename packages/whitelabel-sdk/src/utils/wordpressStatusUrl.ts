/**
 * Builds the redirect URL used after a contract-create payment, extracted
 * verbatim from contract-create.tsx.
 *
 * For a WordPress integration (returnUrl + orderId present AND
 * wordpressSource === 'true'), it builds a `/usdc-payment-status/<orderId>/`
 * URL on the returnUrl's origin, preserving the original `key` query param and
 * attaching `payment_status` plus any truthy additional params. Otherwise (or
 * on a malformed returnUrl) it returns the returnUrl unchanged, falling back to
 * '/dashboard' when there is no usable returnUrl.
 */
export type PaymentStatus = 'completed' | 'cancelled' | 'error';

export interface WordPressStatusContext {
  returnUrl: string | string[] | undefined;
  orderId: string | string[] | undefined;
  wordpressSource: string | string[] | undefined;
}

export function buildWordPressStatusUrl(
  status: PaymentStatus,
  ctx: WordPressStatusContext,
  additionalParams: Record<string, string> = {}
): string {
  const { returnUrl, orderId, wordpressSource } = ctx;

  // Not a WordPress integration — return the original URL, or dashboard.
  if (!returnUrl || typeof returnUrl !== 'string' || !orderId || wordpressSource !== 'true') {
    return typeof returnUrl === 'string' ? returnUrl : '/dashboard';
  }

  try {
    const url = new URL(returnUrl);

    // Preserve the original order key, if present.
    const orderKey = url.searchParams.get('key') || '';

    const baseUrl = `${url.origin}/usdc-payment-status/${orderId}/`;
    const statusUrl = new URL(baseUrl);

    if (orderKey) {
      statusUrl.searchParams.set('key', orderKey);
    }
    statusUrl.searchParams.set('payment_status', status);

    // Attach truthy additional params (contract_id, contract_hash, tx_hash, error, ...).
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) {
        statusUrl.searchParams.set(key, value);
      }
    });

    return statusUrl.toString();
  } catch (error) {
    console.error('buildWordPressStatusUrl: failed to build status URL:', error);
    return typeof returnUrl === 'string' ? returnUrl : '/dashboard';
  }
}
