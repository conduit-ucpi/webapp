import { detectDevice } from '@/utils/deviceDetection';

const COINBASE_ONRAMP_URL = 'https://pay.coinbase.com/buy/select-asset';
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 700;

interface OpenCoinbaseOnrampParams {
  walletAddress: string;
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
   * Where to put the user once Coinbase is done. Defaults to the page they left,
   * which is almost always what you want — they were part-way through paying.
   */
  returnPath?: string;
}

/** Message the return page posts to its opener when the popup finishes. */
export const ONRAMP_RETURN_MESSAGE = 'coinbase-onramp-return';

/**
 * Coinbase always sends the user to redirectUrl in whichever context it was
 * opened, so both routes land on /onramp-return: in a popup it closes itself and
 * tells the opener, and on mobile it forwards to the page they came from.
 * Sending them straight back to the app would leave desktop users looking at
 * StableDrop rendered inside a 500x700 popup with no way back to their payment.
 */
function buildReturnUrl(returnPath?: string): string {
  const target = returnPath ?? `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/onramp-return?return=${encodeURIComponent(target)}`;
}

interface SessionTokenResponse {
  token?: string;
  error?: string;
}

async function fetchSessionToken(params: OpenCoinbaseOnrampParams): Promise<string> {
  const response = await fetch('/api/coinbase/session-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: params.walletAddress,
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

function buildOnrampUrl(token: string, params: OpenCoinbaseOnrampParams): string {
  const url = new URL(COINBASE_ONRAMP_URL);
  url.searchParams.set('sessionToken', token);
  url.searchParams.set('defaultNetwork', params.network ?? 'base');
  url.searchParams.set('defaultAsset', params.asset ?? 'USDC');
  url.searchParams.set('redirectUrl', buildReturnUrl(params.returnPath));

  // Coinbase ignores presetFiatAmount when presetCryptoAmount is present, so
  // send one or the other rather than both.
  if (params.presetCryptoAmount) {
    url.searchParams.set('presetCryptoAmount', String(params.presetCryptoAmount));
  } else if (params.presetFiatAmount) {
    url.searchParams.set('presetFiatAmount', String(params.presetFiatAmount));
  }
  return url.toString();
}

// Test seam: redirect is overridable so jsdom-based tests can capture it without
// monkey-patching the non-configurable `window.location` property.
let redirectFn: (url: string) => void = (url) => {
  window.location.assign(url);
};

export function _setRedirectForTesting(fn: (url: string) => void): void {
  redirectFn = fn;
}

function openPopup(url: string): void {
  const left = Math.max(0, Math.round((window.screen.width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round((window.screen.height - POPUP_HEIGHT) / 2));
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const popup = window.open(url, 'coinbase-onramp', features);

  if (!popup || popup.closed) {
    // Popup blocked — fall back to a full-page navigation so the user still gets there.
    redirectFn(url);
  }
}

/**
 * Opens Coinbase Onramp using the right strategy for the device.
 * Desktop: centered popup. Mobile: full-page redirect (Apple Pay / KYC need a top-level browsing context).
 */
export async function openCoinbaseOnramp(params: OpenCoinbaseOnrampParams): Promise<void> {
  const token = await fetchSessionToken(params);
  const url = buildOnrampUrl(token, params);

  const device = detectDevice();
  if (device.isMobile) {
    redirectFn(url);
  } else {
    openPopup(url);
  }
}
