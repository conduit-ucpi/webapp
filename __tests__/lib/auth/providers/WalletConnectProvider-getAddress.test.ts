/**
 * WalletConnectProvider.getAddress() must work after a session restore,
 * not only after an explicit connect().
 *
 * The bug: getAddress() reads `this.currentAddress`, which is only set
 * inside connect(). On a hard refresh / cold load, AppKit auto-restores
 * its persisted session — provider.isConnected() correctly returns true —
 * but currentAddress is still null because connect() was never called.
 * AuthManager.restoreSession() then catches the thrown error, sets
 * `address: null`, and downstream pages that gate on `!address` render
 * the "Connect your wallet" prompt despite the wallet actually being
 * connected.
 *
 * The fix: when currentAddress is null, fall back to the underlying Reown
 * provider's getAddress(), which reads AppKit's CAIP address directly.
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
const mockReownGetAddress = jest.fn();
const mockReownInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/auth/reownWalletConnect', () => ({
  ReownWalletConnectProvider: jest.fn().mockImplementation(() => ({
    initialize: mockReownInitialize,
    isConnected: mockReownIsConnected,
    getAddress: mockReownGetAddress,
    onConnectionChange: jest.fn(() => () => {}),
  })),
}));

import { WalletConnectProvider } from '@/lib/auth/providers/WalletConnectProvider';

const config = {
  chainId: 8453,
  rpcUrl: 'https://example',
  walletConnectProjectId: 'test',
} as any;

beforeEach(() => {
  mockReownIsConnected.mockReset();
  mockReownGetAddress.mockReset();
});

describe('WalletConnectProvider.getAddress fallback to Reown CAIP address', () => {
  it('returns the address from the underlying Reown provider after a session restore (currentAddress not set)', async () => {
    mockReownIsConnected.mockReturnValue(true);
    mockReownGetAddress.mockReturnValue('0xb9c90dbede265181083f1a7159a6ca20d06ce699');

    const provider = new WalletConnectProvider(config);

    // currentAddress is null because connect() was never called — only
    // possible on a hard refresh / cold load via AppKit auto-restore.
    const address = await provider.getAddress();

    expect(address).toBe('0xb9c90dbede265181083f1a7159a6ca20d06ce699');
  });

  it('throws when both the cached address and the Reown CAIP address are unavailable', async () => {
    mockReownIsConnected.mockReturnValue(false);
    mockReownGetAddress.mockReturnValue(null);

    const provider = new WalletConnectProvider(config);

    await expect(provider.getAddress()).rejects.toThrow();
  });

  it('throws when the Reown provider returns null (genuinely disconnected)', async () => {
    mockReownIsConnected.mockReturnValue(false);
    mockReownGetAddress.mockReturnValue(null);

    const provider = new WalletConnectProvider(config);
    await expect(provider.getAddress()).rejects.toThrow(/not connected/i);
  });
});
