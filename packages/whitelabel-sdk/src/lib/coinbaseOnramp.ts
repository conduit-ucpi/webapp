import { apiFetch } from '@/lib/apiFetch';
import { detectUserCurrency } from '@/utils/currencyDetection';
import {
  buildCoinbaseReturnUrl,
  openCoinbasePayUrl,
  _setRedirectForTesting,
} from '@/lib/coinbasePayWindow';

const COINBASE_ONRAMP_URL = 'https://pay.coinbase.com/buy/select-asset';
const ONRAMP_RETURN_ROUTE = '/onramp-return';

// Re-exported so existing tests (and callers) keep importing the seam from here;
// the implementation moved to coinbasePayWindow when the offramp needed it too.
export { _setRedirectForTesting };

interface OpenCoinbaseOnrampParams {
  /**
   * Where Coinbase sends the crypto. Usually the user's wallet, but it can be a
   * contract — the escrow accepts a plain transfer that is swept in afterwards.
   * Named for what it is, so nobody reads a contract address as a wallet bug.
   */
  destinationAddress: string;
  asset?: string;
  network?: string;
  /**
   * Amount of crypto the user RECEIVES. Prefer this over a fiat amount whenever
   * a downstream check is denominated in tokens: Coinbase's fee comes out of the
   * fiat sum, so presetting fiat delivers less crypto than asked for.
   * Coinbase ignores presetFiatAmount when this is set.
   */
  presetCryptoAmount?: number;
  /** Amount of fiat the user SPENDS, fees included. */
  presetFiatAmount?: number;
  /**
   * What the user pays IN. Defaults to the currency of their browser locale.
   *
   * Coinbase separates the asset (USDC on Base) from the money, and without this
   * it quotes in USD. A UK account shown a USD quote answered "not available in
   * your country" even though Coinbase's own options API lists USDC on Base for
   * GBP by card in GB. Only the currencies Coinbase documents for presets are
   * sent; anything else falls back to USD rather than guessing.
   */
  fiatCurrency?: string;
  /**
   * Where to put the user once Coinbase is done. Defaults to the page they left,
   * which is almost always what you want — they were part-way through paying.
   */
  returnPath?: string;
  /**
   * Called when the desktop popup closes, however it closed — completed,
   * cancelled, or dismissed. Never called on mobile. See openCoinbasePayUrl.
   */
  onPopupClosed?: () => void;
}

/** Message the return page posts to its opener when the popup finishes. */
export const ONRAMP_RETURN_MESSAGE = 'coinbase-onramp-return';

interface SessionTokenResponse {
  token?: string;
  error?: string;
}

async function fetchSessionToken(params: OpenCoinbaseOnrampParams): Promise<string> {
  const response = await apiFetch('/api/coinbase/session-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: params.destinationAddress,
      asset: params.asset ?? 'USDC',
      blockchain: params.network ?? 'base',
    }),
  });

  const data: SessionTokenResponse = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(data.error || `Failed to create Coinbase session (HTTP ${response.status})`);
  }

  return data.token;
}

/** The fiat currencies Coinbase documents for its hosted onramp presets. */
const COINBASE_FIAT_CURRENCIES = new Set(['USD', 'CAD', 'GBP', 'EUR']);

/**
 * The currency to quote in: the caller's choice, else the browser locale's, else
 * USD. Exported for tests.
 */
export function onrampFiatCurrency(requested?: string): string {
  const candidate = (requested ?? detectUserCurrency()).toUpperCase();
  return COINBASE_FIAT_CURRENCIES.has(candidate) ? candidate : 'USD';
}

function buildOnrampUrl(token: string, params: OpenCoinbaseOnrampParams): string {
  const url = new URL(COINBASE_ONRAMP_URL);
  url.searchParams.set('sessionToken', token);
  url.searchParams.set('defaultNetwork', params.network ?? 'base');
  url.searchParams.set('defaultAsset', params.asset ?? 'USDC');
  url.searchParams.set('fiatCurrency', onrampFiatCurrency(params.fiatCurrency));
  url.searchParams.set('redirectUrl', buildCoinbaseReturnUrl(ONRAMP_RETURN_ROUTE, params.returnPath));

  // Coinbase ignores presetFiatAmount when presetCryptoAmount is present, so
  // send one or the other rather than both.
  if (params.presetCryptoAmount) {
    url.searchParams.set('presetCryptoAmount', String(params.presetCryptoAmount));
  } else if (params.presetFiatAmount) {
    url.searchParams.set('presetFiatAmount', String(params.presetFiatAmount));
  }
  return url.toString();
}

/**
 * Opens Coinbase Onramp using the right strategy for the device.
 * Desktop: centered popup. Mobile: full-page redirect (Apple Pay / KYC need a top-level browsing context).
 */
export async function openCoinbaseOnramp(params: OpenCoinbaseOnrampParams): Promise<void> {
  const token = await fetchSessionToken(params);
  const url = buildOnrampUrl(token, params);

  openCoinbasePayUrl(url, 'coinbase-onramp', params.onPopupClosed);
}
