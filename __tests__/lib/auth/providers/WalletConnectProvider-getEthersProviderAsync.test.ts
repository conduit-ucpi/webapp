/**
 * WalletConnectProvider.getEthersProviderAsync() must return an ethers
 * provider after a session restore — not only after an explicit connect().
 *
 * The bug: cachedEthersProvider was only ever populated inside connect().
 * On a hard refresh, AppKit auto-restores the wallet session — Reown
 * reports `isConnected() === true` and exposes a wallet provider — but
 * because connect() was never called, the cache stays null. Pages like
 * /contract-pay then call useSimpleEthers().getWeb3Service(), which calls
 * getEthersProvider(), gets back null, and throws "Wallet not connected"
 * even though the wallet is plainly connected.
 *
 * The fix: when the cache is empty and Reown reports a connected session
 * with a wallet provider, build an ethers BrowserProvider from it on demand.
 */

jest.mock('@/utils/mobileLogger', () => ({
  mLog: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockReownIsConnected = jest.fn();
const mockReownGetProvider = jest.fn();
const mockReownInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/auth/reownWalletConnect', () => ({
  ReownWalletConnectProvider: jest.fn().mockImplementation(() => ({
    initialize: mockReownInitialize,
    isConnected: mockReownIsConnected,
    getProvider: mockReownGetProvider,
    onConnectionChange: jest.fn(() => () => {}),
  })),
}));

const browserProviderCtor = jest.fn();
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      BrowserProvider: jest.fn().mockImplementation(function (this: any, p: any) {
        browserProviderCtor(p);
        this.__wrapped = p;
      }),
    },
  };
});

import { WalletConnectProvider } from '@/lib/auth/providers/WalletConnectProvider';

const config = {
  chainId: 8453,
  rpcUrl: 'https://example',
  walletConnectProjectId: 'test',
} as any;

beforeEach(() => {
  mockReownIsConnected.mockReset();
  mockReownGetProvider.mockReset();
  browserProviderCtor.mockReset();
});

describe('WalletConnectProvider.getEthersProviderAsync', () => {
  it('returns null when nothing is connected', async () => {
    mockReownIsConnected.mockReturnValue(false);
    const provider = new WalletConnectProvider(config);
    await provider.initialize();

    const result = await provider.getEthersProviderAsync();

    expect(result).toBeNull();
    expect(browserProviderCtor).not.toHaveBeenCalled();
  });

  it('builds an ethers provider on-demand after a session restore (the regression)', async () => {
    // Cold-load scenario: connect() was never called, cache is empty,
    // but AppKit auto-restored the session so Reown reports connected
    // and exposes a wallet provider.
    const fakeWalletProvider = { request: jest.fn() };
    mockReownIsConnected.mockReturnValue(true);
    mockReownGetProvider.mockReturnValue(fakeWalletProvider);

    const provider = new WalletConnectProvider(config);
    await provider.initialize();

    const result = await provider.getEthersProviderAsync();

    expect(result).not.toBeNull();
    expect(browserProviderCtor).toHaveBeenCalledTimes(1);
    expect(browserProviderCtor).toHaveBeenCalledWith(fakeWalletProvider);
  });

  it('reuses the cached provider on subsequent calls (no double-construction)', async () => {
    const fakeWalletProvider = { request: jest.fn() };
    mockReownIsConnected.mockReturnValue(true);
    mockReownGetProvider.mockReturnValue(fakeWalletProvider);

    const provider = new WalletConnectProvider(config);
    await provider.initialize();

    const first = await provider.getEthersProviderAsync();
    const second = await provider.getEthersProviderAsync();
    const third = await provider.getEthersProviderAsync();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(browserProviderCtor).toHaveBeenCalledTimes(1);
  });

  it('returns null when Reown reports connected but exposes no wallet provider', async () => {
    mockReownIsConnected.mockReturnValue(true);
    mockReownGetProvider.mockReturnValue(null);

    const provider = new WalletConnectProvider(config);
    await provider.initialize();

    const result = await provider.getEthersProviderAsync();

    expect(result).toBeNull();
    expect(browserProviderCtor).not.toHaveBeenCalled();
  });

  it('returns null and does not throw if reown.getProvider() throws', async () => {
    mockReownIsConnected.mockReturnValue(true);
    mockReownGetProvider.mockImplementation(() => {
      throw new Error('AppKit not initialized');
    });

    const provider = new WalletConnectProvider(config);
    await provider.initialize();

    await expect(provider.getEthersProviderAsync()).resolves.toBeNull();
  });
});
