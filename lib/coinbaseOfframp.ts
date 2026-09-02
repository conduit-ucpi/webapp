import { buildCoinbaseReturnUrl, openCoinbasePayUrl } from '@/lib/coinbasePayWindow';

const COINBASE_OFFRAMP_URL = 'https://pay.coinbase.com/v3/sell/input';
const OFFRAMP_RETURN_ROUTE = '/offramp-return';

/** Message the return page posts to its opener when the popup finishes. */
export const OFFRAMP_RETURN_MESSAGE = 'coinbase-offramp-return';

interface OpenCoinbaseOfframpParams {
  /**
   * The wallet the tokens will leave. Coinbase records it as the sell address and
   * expects the eventual transfer to come from it, so it must be the connected
   * wallet — the server rejects anything else.
   */
  walletAddress: string;
  /** Token symbol, from config. Never defaulted here: see the note on `network`. */
  asset: string;
  /**
   * Coinbase's slug for the chain, from COINBASE_NETWORK. Required rather than
   * defaulted, because a wrong guess here means a user sends real tokens on a
   * chain Coinbase is not watching for this order.
   */
  network: string;
  /** Amount of crypto to sell, pre-filled into the widget. */
  presetCryptoAmount?: number;
  /** Where to put the user when Coinbase is done. Defaults to the page they left. */
  returnPath?: string;
  /**
   * Called when the desktop popup closes, however it closed. Never fires on
   * mobile — see openCoinbasePayUrl.
   */
  onPopupClosed?: () => void;
}

interface OfframpSessionResponse {
  token?: string;
  partnerUserRef?: string;
  error?: string;
}

async function fetchOfframpSession(
  params: OpenCoinbaseOfframpParams
): Promise<{ token: string; partnerUserRef: string }> {
  const response = await fetch('/api/coinbase/offramp/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: params.walletAddress,
      asset: params.asset,
      network: params.network,
    }),
  });

  const data: OfframpSessionResponse = await response.json().catch(() => ({}));

  if (!response.ok || !data.token || !data.partnerUserRef) {
    throw new Error(data.error || `Failed to start a Coinbase cash-out (HTTP ${response.status})`);
  }

  return { token: data.token, partnerUserRef: data.partnerUserRef };
}

function buildOfframpUrl(
  session: { token: string; partnerUserRef: string },
  params: OpenCoinbaseOfframpParams
): string {
  const url = new URL(COINBASE_OFFRAMP_URL);
  url.searchParams.set('sessionToken', session.token);
  // Coinbase files the sell order under this ref, and it is how we read the order
  // back afterwards to learn where to send the tokens.
  url.searchParams.set('partnerUserRef', session.partnerUserRef);
  url.searchParams.set('redirectUrl', buildCoinbaseReturnUrl(OFFRAMP_RETURN_ROUTE, params.returnPath));
  url.searchParams.set('defaultNetwork', params.network);
  url.searchParams.set('defaultAsset', params.asset);

  if (params.presetCryptoAmount) {
    url.searchParams.set('presetCryptoAmount', String(params.presetCryptoAmount));
  }

  // defaultCashoutMethod is deliberately left unset. Presetting it would pick a
  // payout route for the user, and hide the "add a bank account" path from anyone
  // who has not configured one yet — which is most first-time cashers-out.
  return url.toString();
}

/**
 * Opens Coinbase's cash-out widget with everything we already know filled in.
 *
 * The user only confirms: the source wallet rides in on the session token, and
 * the token, chain and amount are all preset. What they still do on Coinbase's
 * side is choose or add a bank account and pass KYC, which is the whole reason
 * this is a hosted flow rather than one of our screens.
 *
 * Note what this does NOT do: move any money. Coinbase creates a sell order and
 * hands back an address, and the app has to send the tokens itself afterwards —
 * see CashOutPanel and /api/coinbase/offramp/pending.
 */
export async function openCoinbaseOfframp(params: OpenCoinbaseOfframpParams): Promise<void> {
  const session = await fetchOfframpSession(params);
  const url = buildOfframpUrl(session, params);

  openCoinbasePayUrl(url, 'coinbase-offramp', params.onPopupClosed);
}
