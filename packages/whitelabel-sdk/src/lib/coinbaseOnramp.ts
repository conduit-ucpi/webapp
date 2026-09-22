import { apiFetch } from '@/lib/apiFetch';
import { detectUserCurrency } from '@/utils/currencyDetection';
import {
  buildCoinbaseReturnUrl,
  openCoinbasePayUrl,
  _setRedirectForTesting,
} from '@/lib/coinbasePayWindow';

/**
 * WHERE WE SEND A BUYER, AND WHY IT IS THIS EXACT URL.
 *
 * `pay.coinbase.com/buy` is the front door. Coinbase then decides which of two
 * flows to put the person in, and it decides from the URL:
 *
 *   • the ordinary flow  — /buy/select-asset → /landing, where the buyer signs
 *     in to Coinbase and pays by card, Coinbase balance or fiat wallet. Works
 *     in every country Coinbase serves, the UK included.
 *   • GUEST CHECKOUT     — /v3/onramp/guest/card-details, the no-account debit
 *     card flow. It is US-only, so everyone else is met with
 *     "not available in your country" and can go no further.
 *
 * ⚠️ COINBASE ROUTES US INTO GUEST CHECKOUT WHEN THE URL FULLY SPECIFIES THE
 *    PURCHASE — an amount together with the asset and network. Measured against
 *    the live service on 2026-09-21 by following the redirects: adding
 *    `defaultAsset` and `defaultNetwork` beside a preset amount turned
 *    /buy into /v3/onramp/guest/card-details every time, and removing them left
 *    it on /landing every time. Entering at /buy/select-asset was worse still:
 *    a preset amount alone was enough to divert it.
 *
 * SO: the asset and the network are pinned in the SESSION TOKEN, where they
 * belong (see fetchSessionToken — Coinbase only lets the buyer send USDC on
 * base to the address we named), and they are deliberately NOT repeated as URL
 * parameters. Nothing is lost: the destination, the asset and the chain are all
 * already fixed. Putting them back reopens a UK-wide outage that reads like a
 * Coinbase country restriction and is nothing of the kind.
 */
const COINBASE_ONRAMP_URL = 'https://pay.coinbase.com/buy';
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
  // NO defaultAsset / defaultNetwork here — see COINBASE_ONRAMP_URL above. The
  // session token already pins both, and naming them again diverts UK buyers
  // into the US-only guest checkout.
  const currency = onrampFiatCurrency(params.fiatCurrency);
  url.searchParams.set('fiatCurrency', currency);
  url.searchParams.set('redirectUrl', buildCoinbaseReturnUrl(ONRAMP_RETURN_ROUTE, params.returnPath));

  /*
   * The amount, preset so the buyer does not have to retype what they already owe.
   *
   * ⚠️ IT IS SAFE HERE ONLY BECAUSE THE ASSET AND NETWORK ARE NOT IN THE URL. Naming all three
   *    tells Coinbase the purchase needs no further input, and it answers by routing the buyer
   *    to one-click checkout, which is its guest flow — and guest checkout is allowlisted to a
   *    single country, the United States (`"guestCheckoutCountryAllowlist":["US"]` in its own
   *    page config). Measured against the live service, twice, on 2026-09-21 and again on
   *    2026-09-22: with the asset and network present the redirect chain ends at
   *    /v3/onramp/guest/card-details, and without them it ends at /landing, the ordinary flow.
   *
   *    An earlier fix over-corrected and sent the amount only for US dollar buyers, which cost
   *    every other buyer the prefill for no benefit — the preset alone never triggered the guest
   *    flow. Keep the asset and network out of the URL (they are pinned in the session token)
   *    and the amount is free to stay.
   *
   * Coinbase ignores presetFiatAmount when presetCryptoAmount is present, so send one or the
   * other rather than both.
   */
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
