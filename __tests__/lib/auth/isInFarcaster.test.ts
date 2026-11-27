/**
 * Farcaster detection decides which wallet a user gets, and the Farcaster provider outranks
 * everything. Getting it wrong in the "yes" direction is silent and total: the stub provider
 * "connects" a placeholder address, Privy is never asked, and sign-in simply does nothing.
 *
 * That is what happened to every partner embed (escrow-me.com, WordPress, Shopify) while the
 * check treated any iframe as Farcaster.
 */

import { PROVIDERS, isInFarcaster } from '@/lib/auth/core/providerManifest';
import type { AuthConfig } from '@/lib/auth/types';

const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

function inFrame() {
  // A cross-origin parent is just "some other window" from here.
  Object.defineProperty(window, 'parent', { value: {}, configurable: true });
}

function userAgent(ua: string) {
  jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
}

/** The provider the registry would pick: highest priority among those that apply. */
function chosenProvider(config: Partial<AuthConfig>) {
  return PROVIDERS
    .filter((p) => p.applies(config as AuthConfig) && !p.legacy?.(config as AuthConfig))
    .sort((a, b) => b.priority - a.priority)[0]?.type;
}

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

afterEach(() => {
  if (realParent) Object.defineProperty(window, 'parent', realParent);
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  delete (window as unknown as { __farcaster__?: unknown }).__farcaster__;
});

describe('isInFarcaster', () => {
  it('is false at the top level', () => {
    userAgent(CHROME);
    expect(isInFarcaster()).toBe(false);
  });

  it('is false in an ordinary iframe on a partner site', () => {
    inFrame();
    userAgent(CHROME);
    expect(isInFarcaster()).toBe(false);
  });

  it('is true in a frame whose client identifies as Farcaster or Warpcast', () => {
    inFrame();
    userAgent(`${CHROME} Warpcast/1.0`);
    expect(isInFarcaster()).toBe(true);
  });

  it('is true in a frame carrying the Farcaster frame parameter', () => {
    inFrame();
    userAgent(CHROME);
    window.history.replaceState(null, '', '/create?fc_frame=1');
    expect(isInFarcaster()).toBe(true);
  });

  it('is true in a frame where the Farcaster SDK is present', () => {
    inFrame();
    userAgent(CHROME);
    (window as unknown as { __farcaster__?: unknown }).__farcaster__ = {};
    expect(isInFarcaster()).toBe(true);
  });

  it('ignores Farcaster signals outside a frame', () => {
    userAgent(`${CHROME} Warpcast/1.0`);
    expect(isInFarcaster()).toBe(false);
  });
});

describe('wallet choice inside a partner iframe', () => {
  it('is Privy, not the Farcaster stub', () => {
    inFrame();
    userAgent(CHROME);
    expect(chosenProvider({ privyAppId: 'app', walletConnectProjectId: 'wc' })).toBe('privy');
  });
});
