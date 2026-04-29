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
    await openCoinbaseOnramp({ walletAddress: VALID_ADDRESS });

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
    await openCoinbaseOnramp({ walletAddress: VALID_ADDRESS });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain('https://pay.coinbase.com/buy/select-asset');
    expect(url).toContain('sessionToken=cb-session-xyz');
    expect(url).toContain('defaultNetwork=base');
    expect(url).toContain('defaultAsset=USDC');
    expect(target).toBe('coinbase-onramp');
    expect(features).toContain('width=500');
    expect(features).toContain('height=700');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('redirects (not popup) on mobile to satisfy Apple Pay / KYC top-level context requirement', async () => {
    mockDetectDevice.mockReturnValue(mobileDevice);
    await openCoinbaseOnramp({ walletAddress: VALID_ADDRESS });

    expect(openSpy).not.toHaveBeenCalled();
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const redirectUrl = assignSpy.mock.calls[0][0];
    expect(redirectUrl).toContain('https://pay.coinbase.com/buy/select-asset');
    expect(redirectUrl).toContain('sessionToken=cb-session-xyz');
  });

  it('falls back to redirect when popup is blocked on desktop', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    openSpy.mockReturnValue(null); // simulate blocked popup

    await openCoinbaseOnramp({ walletAddress: VALID_ADDRESS });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy.mock.calls[0][0]).toContain('https://pay.coinbase.com/buy/select-asset');
  });

  it('throws when the session-token endpoint returns an error', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid session' }),
    });

    await expect(openCoinbaseOnramp({ walletAddress: VALID_ADDRESS })).rejects.toThrow('Invalid session');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('throws when the response has no token field', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await expect(openCoinbaseOnramp({ walletAddress: VALID_ADDRESS })).rejects.toThrow();
  });

  it('appends presetFiatAmount when provided', async () => {
    mockDetectDevice.mockReturnValue(desktopDevice);
    await openCoinbaseOnramp({ walletAddress: VALID_ADDRESS, presetFiatAmount: 50 });

    const url = openSpy.mock.calls[0][0];
    expect(url).toContain('presetFiatAmount=50');
  });
});
