import { detectDevice } from '@/utils/deviceDetection';

const COINBASE_ONRAMP_URL = 'https://pay.coinbase.com/buy/select-asset';
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 700;

interface OpenCoinbaseOnrampParams {
  walletAddress: string;
  asset?: string;
  network?: string;
  presetFiatAmount?: number;
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
  if (params.presetFiatAmount) {
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
