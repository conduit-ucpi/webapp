/**
 * Test: lib/coinbaseOfframp.ts
 *
 * Same device branching as the onramp (Apple Pay and KYC need a top-level
 * browsing context), plus the thing that is specific to cashing out: every
 * parameter Coinbase is told about the chain and the token must come from the
 * caller. A default baked in here would send a user's real tokens on whichever
 * chain this file happened to guess.
 */

import { openCoinbaseOfframp, OFFRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOfframp';
import { _setRedirectForTesting } from '@/lib/coinbasePayWindow';
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

const baseParams = {
  walletAddress: VALID_ADDRESS,
  asset: 'USDC',
  network: 'base',
};

describe('openCoinbaseOfframp', () => {
  let openSpy: jest.SpyInstance;
  const assignSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    assignSpy.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'cb-sell-token', partnerUserRef: 'user-123' }),
    });

    _setRedirectForTesting(assignSpy);
    openSpy = jest.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  /** The URL the user was actually sent to, however they were sent. */
  function openedUrl(): URL {
    const fromPopup = openSpy.mock.calls[0]?.[0];
    const fromRedirect = assignSpy.mock.calls[0]?.[0];
    return new URL(fromPopup ?? fromRedirect);
  }

  it('asks the backend for a session bound to the wallet, with credentials', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp(baseParams);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/coinbase/offramp/session',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ address: VALID_ADDRESS, asset: 'USDC', network: 'base' });
  });

  it('opens the sell widget with the session token and partner ref', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp(baseParams);

    const url = openedUrl();
    expect(url.origin + url.pathname).toBe('https://pay.coinbase.com/v3/sell/input');
    expect(url.searchParams.get('sessionToken')).toBe('cb-sell-token');
    expect(url.searchParams.get('partnerUserRef')).toBe('user-123');
  });

  it('takes the chain and token from the caller rather than defaulting them', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp({
      ...baseParams,
      asset: 'USDT',
      network: 'ethereum',
    });

    const url = openedUrl();
    expect(url.searchParams.get('defaultNetwork')).toBe('ethereum');
    expect(url.searchParams.get('defaultAsset')).toBe('USDT');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.network).toBe('ethereum');
    expect(body.asset).toBe('USDT');
  });

  it('prefills the amount so the user confirms rather than types', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp({ ...baseParams, presetCryptoAmount: 25.5 });

    expect(openedUrl().searchParams.get('presetCryptoAmount')).toBe('25.5');
  });

  it('leaves the cashout method unset so Coinbase can offer to add a bank account', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp(baseParams);

    expect(openedUrl().searchParams.has('defaultCashoutMethod')).toBe(false);
  });

  it('returns the user through the offramp return page, not straight to the app', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);

    await openCoinbaseOfframp({ ...baseParams, returnPath: '/wallet?cashout=return' });

    const redirectUrl = new URL(openedUrl().searchParams.get('redirectUrl')!);
    expect(redirectUrl.pathname).toBe('/offramp-return');
    expect(redirectUrl.searchParams.get('return')).toBe('/wallet?cashout=return');
  });

  it('redirects (not popup) on mobile to satisfy the top-level context requirement', async () => {
    mockDetectDevice.mockReturnValue(mobileDevice);

    await openCoinbaseOfframp(baseParams);

    expect(openSpy).not.toHaveBeenCalled();
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to a redirect when the popup is blocked on desktop', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    openSpy.mockReturnValue(null);

    await openCoinbaseOfframp(baseParams);

    expect(assignSpy).toHaveBeenCalledTimes(1);
  });

  it('reports the popup closing so the caller can look for the order', async () => {
    jest.useFakeTimers();
    mockDetectDevice.mockReturnValue(desktopDevice);
    const popup = { closed: false } as Window;
    openSpy.mockReturnValue(popup);
    const onPopupClosed = jest.fn();

    await openCoinbaseOfframp({ ...baseParams, onPopupClosed });

    (popup as any).closed = true;
    jest.advanceTimersByTime(600);

    expect(onPopupClosed).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('throws when the session endpoint fails, so the panel can say so', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Address does not match the signed-in wallet' }),
    });

    await expect(openCoinbaseOfframp(baseParams)).rejects.toThrow(
      'Address does not match the signed-in wallet'
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('throws when the session response has no partner ref to file the order under', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'cb-sell-token' }),
    });

    await expect(openCoinbaseOfframp(baseParams)).rejects.toThrow();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('names a return message distinct from the onramp so the panels do not cross-trigger', () => {
    expect(OFFRAMP_RETURN_MESSAGE).toBe('coinbase-offramp-return');
  });
});
