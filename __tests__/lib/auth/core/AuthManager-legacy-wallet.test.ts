/**
 * connect({ legacyWallet: true }) reaches the provider the app moved away from — and only then.
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

const mockGetAllProviders = jest.fn(() => []);
const mockGetBestProvider = jest.fn();
const mockGetProvider = jest.fn();
const mockGetLegacyProvider = jest.fn();
const mockHasLegacyProvider = jest.fn(() => true);
const mockRegistryInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/auth/core/ProviderRegistry', () => ({
  ProviderRegistry: jest.fn().mockImplementation(() => ({
    initialize: mockRegistryInitialize,
    getAllProviders: mockGetAllProviders,
    getBestProvider: mockGetBestProvider,
    getProvider: mockGetProvider,
    getLegacyProvider: mockGetLegacyProvider,
    hasLegacyProvider: mockHasLegacyProvider,
  })),
}));

jest.mock('@/lib/auth/core/TokenManager', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  })),
}));

import { AuthManager } from '@/lib/auth/core/AuthManager';

const config = { chainId: 8453, rpcUrl: 'x', explorerBaseUrl: 'x', walletConnectProjectId: 'p', privyAppId: 'a' } as any;

function provider(name: string) {
  return {
    getProviderName: () => name,
    isConnected: jest.fn(() => false),
    getAddress: jest.fn(async () => '0xabc'),
    getCapabilities: jest.fn(() => ({})),
    setConnectionMode: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(async () => ({ success: true, address: '0xabc', capabilities: {} })),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

async function manager() {
  // @ts-expect-error -- private static, reset between tests.
  AuthManager.instance = undefined;
  const m = AuthManager.getInstance();
  await m.initialize(config);
  return m;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

it('uses the legacy provider when asked, and the best one otherwise', async () => {
  const best = provider('new');
  const legacy = provider('old');
  mockGetBestProvider.mockReturnValue(best);
  mockGetLegacyProvider.mockResolvedValue(legacy);
  const m = await manager();

  await m.connect(undefined, { legacyWallet: true });
  expect(legacy.connect).toHaveBeenCalledTimes(1);
  expect(best.connect).not.toHaveBeenCalled();

  await m.disconnect();
  await m.connect();
  expect(best.connect).toHaveBeenCalledTimes(1);
  expect(legacy.connect).toHaveBeenCalledTimes(1);
});

it('delivers the mode the card chose to the legacy provider it was not there to receive', async () => {
  // The card sets social-only before the legacy provider exists; it must still get it.
  const best = provider('new');
  const legacy = provider('old');
  mockGetBestProvider.mockReturnValue(best);
  mockGetLegacyProvider.mockResolvedValue(legacy);
  const m = await manager();

  await m.setConnectionMode('social-only');
  await m.connect(undefined, { legacyWallet: true });

  expect(legacy.setConnectionMode).toHaveBeenCalledWith('social-only');
});

it('remembers the route so the next boot starts the legacy provider, and forgets it on sign-out', async () => {
  mockGetBestProvider.mockReturnValue(provider('new'));
  mockGetLegacyProvider.mockResolvedValue(provider('old'));
  const m = await manager();
  expect(mockRegistryInitialize).toHaveBeenLastCalledWith(config, { includeLegacy: false });

  await m.connect(undefined, { legacyWallet: true });
  await manager();
  expect(mockRegistryInitialize).toHaveBeenLastCalledWith(config, { includeLegacy: true });

  await (await manager()).disconnect();
  await manager();
  expect(mockRegistryInitialize).toHaveBeenLastCalledWith(config, { includeLegacy: false });
});

it('an ordinary connect never records the legacy route', async () => {
  mockGetBestProvider.mockReturnValue(provider('new'));
  const m = await manager();

  await m.connect();
  await manager();

  expect(mockRegistryInitialize).toHaveBeenLastCalledWith(config, { includeLegacy: false });
});

it('says so when there is no legacy provider to reach', async () => {
  mockGetBestProvider.mockReturnValue(provider('new'));
  mockGetLegacyProvider.mockResolvedValue(null);
  const m = await manager();

  const result = await m.connect(undefined, { legacyWallet: true });

  expect(result.success).toBe(false);
  expect(result.error).toMatch(/legacy wallet/i);
});

it('exposes whether the route exists, for the tick box', async () => {
  mockHasLegacyProvider.mockReturnValue(false);
  expect((await manager()).canConnectLegacyWallet()).toBe(false);
  mockHasLegacyProvider.mockReturnValue(true);
  expect((await manager()).canConnectLegacyWallet()).toBe(true);
});
