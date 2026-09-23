/**
 * Test: lib/coinbaseOnramp.ts
 *
 * Verifies the desktop-popup / mobile-redirect strategy and the popup-blocked
 * fallback. Coinbase requires a top-level browsing context for Apple Pay and
 * KYC, so getting this branching right matters more than the URL format.
 */

import { openCoinbaseOnramp, _setRedirectForTesting } from '@/lib/coinbaseOnramp';
import { detectDevice } from '@/utils/deviceDetection';

jest.mock('@/utils/deviceDetection', () => ({
  detectDevice: jest.fn(),
}));

const mockDetectDevice = detectDevice as jest.MockedFunction<typeof detectDevice>;

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const desktopDevice = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  hasMetaMask: false,
  hasWallet: false,
  isWalletBrowser: false,
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isChrome: true,
  isFirefox: false,
};

const mobileDevice = { ...desktopDevice, isMobile: true, isDesktop: false };

describe('openCoinbaseOnramp', () => {
  let openSpy: jest.SpyInstance;
  const assignSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    assignSpy.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'cb-session-xyz' }),
    });

    _setRedirectForTesting(assignSpy);
    openSpy = jest.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('fetches a session token from the backend with credentials', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/coinbase/session-token');
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].credentials).toBe('include');
    expect(JSON.parse(fetchCall[1].body)).toEqual({
      address: VALID_ADDRESS,
      asset: 'USDC',
      blockchain: 'base',
    });
  });

  it('opens a popup on desktop with the sessionToken in the URL', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain('https://pay.coinbase.com/buy?');
    expect(url).toContain('sessionToken=cb-session-xyz');
    expect(target).toBe('coinbase-onramp');
    expect(features).toContain('width=500');
    expect(features).toContain('height=700');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('redirects (not popup) on mobile to satisfy Apple Pay / KYC top-level context requirement', async () => {
    mockDetectDevice.mockReturnValue(mobileDevice);
    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS });

    expect(openSpy).not.toHaveBeenCalled();
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const redirectUrl = assignSpy.mock.calls[0][0];
    expect(redirectUrl).toContain('https://pay.coinbase.com/buy?');
    expect(redirectUrl).toContain('sessionToken=cb-session-xyz');
  });

  it('falls back to redirect when popup is blocked on desktop', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    openSpy.mockReturnValue(null); // simulate blocked popup

    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy.mock.calls[0][0]).toContain('https://pay.coinbase.com/buy?');
  });

  it('throws when the session-token endpoint returns an error', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid session' }),
    });

    await expect(openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS })).rejects.toThrow('Invalid session');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('throws when the response has no token field', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await expect(openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS })).rejects.toThrow();
  });

  it('appends presetFiatAmount when provided', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS, presetFiatAmount: 50 });

    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('presetFiatAmount=50');
  });

  it('sends the user back to StableDrop via the return page, not straight to the app', async () => {
    await openCoinbaseOnramp({ destinationAddress: '0xabc' });

    const url = new URL(openSpy.mock.calls[0][0]);
    const redirect = new URL(url.searchParams.get('redirectUrl') as string);

    // Landing directly on an app page would leave desktop users looking at
    // StableDrop inside a 500x700 popup with no way back to their payment.
    expect(redirect.pathname).toBe('/onramp-return');
    expect(redirect.origin).toBe(window.location.origin);
  });

  it('carries the page the user left so they are returned to their payment', async () => {
    await openCoinbaseOnramp({ destinationAddress: '0xabc', returnPath: '/contract-pay?id=42' });

    const url = new URL(openSpy.mock.calls[0][0]);
    const redirect = new URL(url.searchParams.get('redirectUrl') as string);

    expect(redirect.searchParams.get('return')).toBe('/contract-pay?id=42');
  });

  it('asks for the crypto amount received, not the fiat spent', async () => {
    await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 42.5 });

    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get('presetCryptoAmount')).toBe('42.5');
    // Coinbase's fee comes out of a fiat sum, so presetting fiat delivers less
    // crypto than asked for — and the escrow gate is a >= on the token balance.
    expect(url.searchParams.get('presetFiatAmount')).toBeNull();
  });

  it('sends only one preset amount when both are supplied', async () => {
    // Coinbase ignores presetFiatAmount when presetCryptoAmount is present;
    // sending both invites a mismatch between what we asked and what we show.
    await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10, presetFiatAmount: 99 });

    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get('presetCryptoAmount')).toBe('10');
    expect(url.searchParams.get('presetFiatAmount')).toBeNull();
  });

  it('still supports a fiat amount when no crypto amount is given', async () => {
    await openCoinbaseOnramp({ destinationAddress: '0xabc', presetFiatAmount: 25 });

    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get('presetFiatAmount')).toBe('25');
  });

  /**
   * THE UK OUTAGE, PINNED.
   *
   * Coinbase reads the URL to decide which flow the buyer gets. An amount
   * together with the asset and the network reads as "nothing left to choose",
   * and it hands the buyer to guest checkout — the no-account debit card flow,
   * which is US-only and answers everyone else with "not available in your
   * country". Measured against the live service on 2026-09-21: with
   * defaultAsset and defaultNetwork present the redirect chain ended at
   * /v3/onramp/guest/card-details every time, and without them at /landing,
   * which is the ordinary flow the UK can use.
   *
   * The asset and the network are not lost — they are pinned in the session
   * token, which is the only thing that actually constrains where the money can
   * go. This test exists so nobody helpfully adds them back to the URL.
   */
  it('does not name the asset or network in the URL, which would divert non-US buyers into guest checkout', async () => {
    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS, presetCryptoAmount: 10 });

    const url = new URL(openSpy.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe('https://pay.coinbase.com/buy');
    expect(url.searchParams.get('defaultAsset')).toBeNull();
    expect(url.searchParams.get('defaultNetwork')).toBeNull();

    // They belong here instead: the session token is what Coinbase enforces.
    const body = JSON.parse(((global.fetch as jest.Mock).mock.calls[0][1] as { body: string }).body);
    expect(body).toMatchObject({ asset: 'USDC', blockchain: 'base' });
  });

  it('reports the popup closing so the caller can move the user on', async () => {
    jest.useFakeTimers();
    const fakePopup = { closed: false } as Window;
    openSpy.mockReturnValue(fakePopup);
    const onPopupClosed = jest.fn();

    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS, onPopupClosed });
    expect(onPopupClosed).not.toHaveBeenCalled();

    // However it closed — completed, cancelled, or dismissed — the money may
    // have landed, so the caller needs to know.
    (fakePopup as { closed: boolean }).closed = true;
    jest.advanceTimersByTime(600);

    expect(onPopupClosed).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('does not report a close while the popup is still open', async () => {
    jest.useFakeTimers();
    openSpy.mockReturnValue({ closed: false } as Window);
    const onPopupClosed = jest.fn();

    await openCoinbaseOnramp({ destinationAddress: VALID_ADDRESS, onPopupClosed });
    jest.advanceTimersByTime(5000);

    expect(onPopupClosed).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  describe('fiatCurrency', () => {
    const withLocale = (language: string) =>
      Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });

    afterEach(() => withLocale('en-US'));

    it('quotes a UK user in GBP, from the browser locale', async () => {
      withLocale('en-GB');
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10 });
      const url = new URL((openSpy.mock.calls[0][0] as string));
      expect(url.searchParams.get('fiatCurrency')).toBe('GBP');
    });

    /**
     * ⚠️ THE AMOUNT IS SENT TO EVERYONE, AND WHAT MAKES THAT SAFE IS ELSEWHERE.
     *
     * Naming the amount together with the asset and the network tells Coinbase nothing is left
     * to choose, and it routes the buyer to guest checkout, which its own page config
     * allowlists to one country: `"guestCheckoutCountryAllowlist":["US"]`. The preset alone
     * does not do that — measured against the live service twice, on 2026-09-21 and again on
     * 2026-09-22.
     *
     * A first attempt at this fix sent the amount only to dollar buyers, which cost every other
     * buyer their prefill and bought nothing. The asset and network staying out of the URL is
     * the whole protection; see the sibling test below.
     */
    it('presets the amount for a sterling buyer, not only a dollar one', async () => {
      withLocale('en-GB');
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10 });

      const url = new URL(openSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get('fiatCurrency')).toBe('GBP');
      expect(url.searchParams.get('presetCryptoAmount')).toBe('10');
      expect(url.searchParams.get('defaultAsset')).toBeNull();
      expect(url.searchParams.get('defaultNetwork')).toBeNull();
    });

    /**
     * ⚠️ REFUSING GUEST CHECKOUT, BY THEIR OWN CONDITION.
     *
     * Coinbase offers the guest flow when defaultPaymentMethod is "CARD" or is absent. We were
     * sending nothing, so signed-out buyers were offered it — and guest checkout serves one
     * country, the United States. A signed-out buyer on a Dutch address got a blank white screen
     * (2026-09-22). Naming any other method makes that condition false and lands them on the
     * ordinary sign-in page instead.
     */
    it('refuses guest checkout for a sterling buyer by naming a payment method', async () => {
      withLocale('en-GB');
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10 });

      const url = new URL(openSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get('defaultPaymentMethod')).toBe('FIAT_WALLET');
      // Still a default, not a restriction: the buyer can choose card once signed in.
      expect(url.searchParams.get('presetCryptoAmount')).toBe('10');
    });

    it('leaves guest checkout available to dollar buyers, the one market it serves', async () => {
      withLocale('en-US');
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10 });

      const url = new URL(openSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get('defaultPaymentMethod')).toBeNull();
    });

    it('lets the caller choose the currency', async () => {
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10, fiatCurrency: 'eur' });
      expect(new URL((openSpy.mock.calls[0][0] as string)).searchParams.get('fiatCurrency')).toBe('EUR');
    });

    it('falls back to USD for a currency Coinbase does not document', async () => {
      withLocale('en-NZ');
      await openCoinbaseOnramp({ destinationAddress: '0xabc', presetCryptoAmount: 10 });
      expect(new URL((openSpy.mock.calls[0][0] as string)).searchParams.get('fiatCurrency')).toBe('USD');
    });
  });
});
