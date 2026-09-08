import { detectDevice } from '@/utils/deviceDetection';

/**
 * How we put a user in front of pay.coinbase.com, and get them back.
 *
 * Shared by the onramp (buy) and the offramp (cash out) because the constraint is
 * the same in both directions: Apple Pay and KYC need a top-level browsing
 * context, so mobile gets the whole tab and only desktop gets a popup. Two copies
 * of this drift, and the drift is invisible until a real user on a real phone
 * cannot complete a payment.
 */

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 700;
const POPUP_POLL_MS = 500;

/**
 * Coinbase always sends the user to redirectUrl in whichever context it was
 * opened, so both routes land on a return page: in a popup it closes itself and
 * tells the opener, and on mobile it forwards to the page they came from.
 * Sending them straight back to the app would leave desktop users looking at
 * StableDrop rendered inside a 500x700 popup with no way back.
 */
export function buildCoinbaseReturnUrl(returnRoute: string, returnPath?: string): string {
  const target = returnPath ?? `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}${returnRoute}?return=${encodeURIComponent(target)}`;
}

// Test seam: redirect is overridable so jsdom-based tests can capture it without
// monkey-patching the non-configurable `window.location` property.
let redirectFn: (url: string) => void = (url) => {
  window.location.assign(url);
};

export function _setRedirectForTesting(fn: (url: string) => void): void {
  redirectFn = fn;
}

function openPopup(url: string, windowName: string, onClosed?: () => void): void {
  const left = Math.max(0, Math.round((window.screen.width - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round((window.screen.height - POPUP_HEIGHT) / 2));
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const popup = window.open(url, windowName, features);

  if (!popup || popup.closed) {
    // Popup blocked — fall back to a full-page navigation so the user still gets there.
    redirectFn(url);
    return;
  }

  if (!onClosed) return;

  const poll = window.setInterval(() => {
    if (!popup.closed) return;
    window.clearInterval(poll);
    onClosed();
  }, POPUP_POLL_MS);
}

/**
 * Opens a Coinbase Pay URL using the right strategy for the device.
 * Desktop: centered popup. Mobile: full-page redirect.
 *
 * `onClosed` fires when the desktop popup closes, however it closed — completed,
 * cancelled, or dismissed. This is the reliable signal, not redirectUrl: that only
 * fires on a successful completion, needs the domain allowlisted in the CDP
 * portal, and never fires at all if the user closes the window by hand. Polling
 * `closed` is cross-origin safe — it is the one property readable on a foreign
 * window. It is never called on mobile, where the whole tab navigates away and
 * there is no opener left to run it.
 */
export function openCoinbasePayUrl(url: string, windowName: string, onClosed?: () => void): void {
  const device = detectDevice();
  if (device.isMobile) {
    redirectFn(url);
  } else {
    openPopup(url, windowName, onClosed);
  }
}
