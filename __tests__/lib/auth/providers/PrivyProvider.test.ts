/**
 * PrivyProvider driven by a fake host through privyBridge — no Privy involved.
 *
 * The bridge is the whole reason the class is testable: everything Privy's hooks would publish,
 * these tests publish by hand, and every action the class would take through Privy lands in a
 * jest.fn(). If a change to the class needs Privy to test, the seam has leaked.
 */

jest.mock('@/utils/mobileLogger', () => ({
  mLog: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const requestAuthNonce = jest.fn();
const buildSiweMessage = jest.fn();
const verifyAuthSignature = jest.fn();
jest.mock('@/lib/auth/walletAuthClient', () => ({
  requestAuthNonce: (...a: unknown[]) => requestAuthNonce(...a),
  buildSiweMessage: (...a: unknown[]) => buildSiweMessage(...a),
  verifyAuthSignature: (...a: unknown[]) => verifyAuthSignature(...a)
}));

const reportAuthFailure = jest.fn();
jest.mock('@/lib/auth/reportAuthFailure', () => ({
  reportAuthFailure: (...a: unknown[]) => reportAuthFailure(...a)
}));

import { PrivyProvider } from '@/lib/auth/providers/PrivyProvider';
import { privyBridge, type PrivyBridgeApi } from '@/lib/auth/providers/privy/privyBridge';
import type { AuthConfig } from '@/lib/auth/types';

const ADDRESS = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
const config: AuthConfig = {
  chainId: 8453,
  rpcUrl: 'https://rpc.example',
  explorerBaseUrl: 'https://explorer.example',
  privyAppId: 'app_123'
};

function fakeApi(overrides: Partial<PrivyBridgeApi> = {}) {
  const request = jest.fn().mockResolvedValue('0xsig');
  const api: PrivyBridgeApi = {
    login: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    getEthereumProvider: jest.fn().mockResolvedValue({ request }),
    switchChain: jest.fn().mockResolvedValue(undefined),
    fundWallet: jest.fn().mockResolvedValue({ status: 'completed', transactionHash: '0xtx' }),
    ...overrides
  };
  privyBridge.registerApi(api);
  return { api, request };
}

const ready = (extra: Partial<ReturnType<typeof privyBridge.getSnapshot>> = {}) =>
  privyBridge.publish({ ready: true, authenticated: false, address: null, user: null, ...extra });

/**
 * The modal is open — i.e. the class has called `login` and is now listening for an outcome.
 *
 * ⚠️ NOT A DETAIL. `connect()` awaits the ready snapshot before registering for the outcome,
 *    and that continuation is a microtask. Firing `loginCompleted()` synchronously after
 *    calling `connect()` lands before the listener exists and the test hangs. A real user
 *    cannot act before the modal opens; neither should the test.
 */
const modalOpen = (login: jest.Mock) =>
  new Promise<void>((resolve) => {
    const tick = (): void => {
      if (login.mock.calls.length > 0) resolve();
      else setTimeout(tick, 0);
    };
    tick();
  });

beforeEach(() => {
  privyBridge._reset();
  jest.clearAllMocks();
});

describe('connect', () => {
  it('returns the restored session without opening the modal', async () => {
    const { api } = fakeApi();
    ready({ authenticated: true, address: ADDRESS });

    const result = await new PrivyProvider(config).connect();

    expect(result).toMatchObject({ success: true, address: ADDRESS });
    expect(api.login).not.toHaveBeenCalled();
  });

  it('opens the modal with the methods for the connection mode, then waits for a wallet', async () => {
    const { api } = fakeApi();
    ready();
    const provider = new PrivyProvider(config);
    await provider.setConnectionMode('social-only');

    const pending = provider.connect();
    await modalOpen(api.login as jest.Mock);
    // The host reports completion, and the embedded wallet lands a tick later.
    privyBridge.loginCompleted();
    ready({ authenticated: true, address: null });
    ready({ authenticated: true, address: ADDRESS });

    const result = await pending;
    expect(api.login).toHaveBeenCalledWith({ loginMethods: ['email', 'google', 'apple'] });
    expect(api.switchChain).toHaveBeenCalledWith(8453);
    expect(result).toMatchObject({ success: true, address: ADDRESS });
  });

  it('reports the user closing the modal as cancelled, not as an error', async () => {
    const { api } = fakeApi();
    ready();
    const pending = new PrivyProvider(config).connect();
    await modalOpen(api.login as jest.Mock);
    privyBridge.loginFailed('exited_auth_flow');

    expect(await pending).toMatchObject({ success: false, cancelled: true });
  });

  it('fails rather than hanging when the host never mounts', async () => {
    // Nothing published: no PRIVY_APP_ID, host not rendered, or Privy still loading forever.
    jest.useFakeTimers();
    const pending = new PrivyProvider(config).connect();
    jest.advanceTimersByTime(15_001);
    const result = await pending;
    jest.useRealTimers();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out/);
  });
});

describe('signing', () => {
  it('signs with personal_sign over the hex-encoded message, as the Reown adapter does', async () => {
    const { request } = fakeApi();
    ready({ authenticated: true, address: ADDRESS });

    const signature = await new PrivyProvider(config).signMessage('hello');

    expect(signature).toBe('0xsig');
    expect(request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['0x68656c6c6f', ADDRESS]
    });
  });
});

describe('requestAuthentication', () => {
  it('runs nonce → message → sign → verify through the auth contract', async () => {
    fakeApi();
    ready({ authenticated: true, address: ADDRESS });
    requestAuthNonce.mockResolvedValue('n0nce');
    buildSiweMessage.mockReturnValue('the message');
    verifyAuthSignature.mockResolvedValue(true);

    expect(await new PrivyProvider(config).requestAuthentication()).toBe(true);
    expect(buildSiweMessage).toHaveBeenCalledWith({ address: ADDRESS, chainId: 8453, nonce: 'n0nce' });
    expect(verifyAuthSignature).toHaveBeenCalledWith('the message', '0xsig');
    expect(reportAuthFailure).not.toHaveBeenCalled();
  });

  it('a refused signature is false with no failure recorded', async () => {
    fakeApi();
    ready({ authenticated: true, address: ADDRESS });
    requestAuthNonce.mockResolvedValue('n');
    buildSiweMessage.mockReturnValue('m');
    verifyAuthSignature.mockResolvedValue(false);
    const provider = new PrivyProvider(config);

    expect(await provider.requestAuthentication()).toBe(false);
    expect(provider.getLastAuthFailure()).toBeNull();
    expect(reportAuthFailure).not.toHaveBeenCalled();
  });

  it('a thrown error is classified and reported, like every other provider', async () => {
    fakeApi();
    ready({ authenticated: true, address: ADDRESS });
    requestAuthNonce.mockRejectedValue(new Error('nonce endpoint down'));
    const provider = new PrivyProvider(config);

    expect(await provider.requestAuthentication()).toBe(false);
    expect(provider.getLastAuthFailure()).not.toBeNull();
    expect(reportAuthFailure).toHaveBeenCalledWith(expect.any(String), 'request-authentication', expect.any(String));
  });
});

describe('state', () => {
  it('reports connection changes once per change', () => {
    fakeApi();
    const seen: unknown[] = [];
    new PrivyProvider(config).onConnectionChange((info) => seen.push(info));

    ready();
    ready({ authenticated: true, address: null }); // authenticated but no wallet yet: not connected
    ready({ authenticated: true, address: ADDRESS });
    ready({ authenticated: true, address: ADDRESS, user: { email: 'a@b.c' } }); // user only: no change
    privyBridge.publish({ ready: true, authenticated: false, address: null, user: null });

    expect(seen).toEqual([
      { isConnected: true, address: ADDRESS },
      { isConnected: false, address: null }
    ]);
  });

  it('exposes what Privy verified about the person, and nothing for a plain wallet', () => {
    fakeApi();
    const provider = new PrivyProvider(config);
    ready({ authenticated: true, address: ADDRESS });
    expect(provider.getUserInfo()).toBeNull();

    ready({ authenticated: true, address: ADDRESS, user: { email: 'a@b.c', authProvider: 'google' } });
    expect(provider.getUserInfo()).toEqual({ email: 'a@b.c', authProvider: 'google' });
  });

  it('drops the cached ethers provider when the wallet changes', async () => {
    fakeApi();
    ready({ authenticated: true, address: ADDRESS });
    const provider = new PrivyProvider(config);
    const first = await provider.getEthersProviderAsync();

    ready({ authenticated: true, address: '0x0000000000000000000000000000000000000001' });
    const second = await provider.getEthersProviderAsync();

    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });
});

describe('fundWallet', () => {
  it('opens the host funding flow for the connected wallet', async () => {
    const { api } = fakeApi();
    ready({ authenticated: true, address: ADDRESS });

    const result = await new PrivyProvider(config).fundWallet({ amount: '15.00', asset: 'USDC', chainId: 8453 });

    expect(api.fundWallet).toHaveBeenCalledWith(ADDRESS, { amount: '15.00', asset: 'USDC', chainId: 8453 });
    expect(result).toEqual({ status: 'completed', transactionHash: '0xtx' });
  });

  it('refuses a chain other than the app chain rather than funding the wrong network', async () => {
    const { api } = fakeApi();
    ready({ authenticated: true, address: ADDRESS });

    await expect(new PrivyProvider(config).fundWallet({ amount: '1', asset: 'USDC', chainId: 1 })).rejects.toThrow(/app chain/);
    expect(api.fundWallet).not.toHaveBeenCalled();
  });

  it('needs a connected wallet', async () => {
    fakeApi();
    ready();

    await expect(new PrivyProvider(config).fundWallet({ amount: '1', asset: 'USDC', chainId: 8453 })).rejects.toThrow(/not connected/);
  });
});
