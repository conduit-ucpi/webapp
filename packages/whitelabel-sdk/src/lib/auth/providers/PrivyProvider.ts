import { ethers } from 'ethers';

import { AuthConfig } from '@/lib/auth/types';
import {
  ConnectionMode,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest,
  UnifiedProvider
} from '@/lib/auth/types/unified-provider';
import { classifyAuthError, type AuthFailure } from '@/lib/auth/classifyAuthError';
import { reportAuthFailure } from '@/lib/auth/reportAuthFailure';
import { buildSiweMessage, requestAuthNonce, verifyAuthSignature } from '@/lib/auth/walletAuthClient';
import { mLog } from '@/utils/mobileLogger';
import { privyBridge, type PrivyLoginMethod, type PrivySnapshot } from './privy/privyBridge';

/**
 * Privy as a wallet provider.
 *
 * Everything Privy-specific is behind `privyBridge`: this class never imports `@privy-io/*`
 * and can be driven entirely by a fake host in tests. Backend authentication is
 * `walletAuthClient` — nonce, message, verify — with Privy contributing only the signature,
 * exactly as the Reown adapter does.
 *
 * Connection ≠ authentication, as everywhere else in this estate: `connect()` gets a wallet,
 * and the backend session is established lazily by `requestAuthentication()` on the first 401.
 */

const READY_TIMEOUT_MS = 15_000;
const WALLET_TIMEOUT_MS = 20_000;

const METHODS_FOR_MODE: Record<ConnectionMode, readonly PrivyLoginMethod[]> = {
  default: ['email', 'google', 'apple', 'wallet'],
  'wallet-only': ['wallet'],
  'social-only': ['email', 'google', 'apple']
};

export class PrivyProvider implements UnifiedProvider {
  private readonly config: AuthConfig;
  private connectionMode: ConnectionMode = 'default';
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private cachedFor: string | null = null;
  private lastAuthFailure: AuthFailure | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
    mLog.info('PrivyProvider', 'Initializing Privy provider');
  }

  getProviderName(): string {
    return 'privy';
  }

  /**
   * Nothing to await: the host mounts on its own schedule through `ProviderHosts`. Blocking
   * here on it would make initialisation depend on render order, which is the one thing a
   * provider must not do.
   */
  async initialize(): Promise<void> {
    mLog.info('PrivyProvider', 'Initialize called');
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    this.connectionMode = mode;
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('PrivyProvider', 'Connect called', { mode: this.connectionMode });

    try {
      const ready = await privyBridge.waitFor((s) => s.ready, READY_TIMEOUT_MS, 'the Privy host');

      if (ready.authenticated && ready.address) {
        // Session restored by Privy itself (cold load, or a second connect click).
        mLog.info('PrivyProvider', 'Already authenticated with Privy', { address: ready.address });
        return this.connected(ready.address);
      }

      const api = privyBridge.getApi();
      if (!api) {
        throw new Error('Privy host is ready but registered no API');
      }

      // Outcome first, modal second, so the callback cannot fire before anyone is listening.
      const outcome = privyBridge.nextLoginOutcome();
      api.login({ loginMethods: METHODS_FOR_MODE[this.connectionMode] });
      const result = await outcome;

      if (!result.ok) {
        const cancelled = /exit|cancel/i.test(result.code);
        mLog.info('PrivyProvider', cancelled ? 'Login cancelled by user' : 'Login failed', {
          code: result.code
        });
        return {
          success: false,
          cancelled,
          error: cancelled ? undefined : `Privy login failed: ${result.code}`,
          capabilities: this.getCapabilities()
        };
      }

      // The embedded wallet can arrive a tick after onComplete; wait for the address itself.
      const withWallet = await privyBridge.waitFor(
        (s) => s.authenticated && Boolean(s.address),
        WALLET_TIMEOUT_MS,
        'a wallet after login'
      );

      await this.ensureAppChain(api);

      mLog.info('PrivyProvider', 'Connection successful', { address: withWallet.address });
      return this.connected(withWallet.address as string);
    } catch (error) {
      mLog.error('PrivyProvider', 'Connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: this.getCapabilities()
      };
    }
  }

  async disconnect(): Promise<void> {
    mLog.info('PrivyProvider', 'Disconnecting');
    this.cachedEthersProvider = null;
    this.cachedFor = null;
    await privyBridge.getApi()?.logout();
  }

  async switchWallet(): Promise<ConnectionResult> {
    await this.disconnect();
    return this.connect();
  }

  isConnected(): boolean {
    const s = privyBridge.getSnapshot();
    return s.authenticated && Boolean(s.address);
  }

  async getAddress(): Promise<string> {
    const { address } = privyBridge.getSnapshot();
    if (!address) throw new Error('No address available - not connected');
    return address;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    return this.cachedEthersProvider;
  }

  async getEthersProviderAsync(): Promise<ethers.BrowserProvider | null> {
    const { address } = privyBridge.getSnapshot();
    if (!this.isConnected() || !address) return null;
    if (this.cachedEthersProvider && this.cachedFor === address) return this.cachedEthersProvider;

    const eip1193 = await privyBridge.getApi()?.getEthereumProvider();
    if (!eip1193) {
      mLog.warn('PrivyProvider', 'Connected but the host returned no EIP-1193 provider');
      return null;
    }
    this.cachedEthersProvider = new ethers.BrowserProvider(eip1193);
    this.cachedFor = address;
    return this.cachedEthersProvider;
  }

  /**
   * `personal_sign` over the raw EIP-1193 provider, hex-encoded, as the Reown adapter does.
   * Not `signer.signMessage()`: that goes via `eth_requestAccounts`, which embedded wallets
   * handle differently, and the backend recovers from EIP-191 either way.
   */
  async signMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    const eip1193 = await privyBridge.getApi()?.getEthereumProvider();
    if (!eip1193) throw new Error('No provider available - not connected');

    const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');
    const signature = await eip1193.request({ method: 'personal_sign', params: [hexMessage, address] });
    return signature as string;
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    const signer = await this.signer();
    return signer.signTransaction({
      to: params.to,
      value: params.value,
      data: params.data,
      gasLimit: params.gasLimit
    });
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    const signer = await this.signer();
    const response = await signer.sendTransaction({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      gasLimit: tx.gasLimit
    });
    return response.hash;
  }

  getCapabilities(): ProviderCapabilities {
    return { canSign: true, canTransact: true, canSwitchWallets: true, isAuthOnly: false };
  }

  onConnectionChange(
    callback: (info: { isConnected: boolean; address: string | null }) => void
  ): () => void {
    let last = this.connectionInfo(privyBridge.getSnapshot());
    return privyBridge.subscribe((s) => {
      const next = this.connectionInfo(s);
      if (next.isConnected === last.isConnected && next.address === last.address) return;
      last = next;
      callback(next);
    });
  }

  getUserInfo(): Record<string, unknown> | null {
    const { user } = privyBridge.getSnapshot();
    return user ? { ...user } : null;
  }

  /** Establish the backend session: nonce → message → sign → verify. */
  async requestAuthentication(): Promise<boolean> {
    this.lastAuthFailure = null;
    try {
      if (!this.isConnected()) {
        mLog.error('PrivyProvider', 'Not connected - cannot request authentication');
        return false;
      }
      const address = await this.getAddress();
      const nonce = await requestAuthNonce();
      const message = buildSiweMessage({ address, chainId: this.config.chainId, nonce });
      const signature = await this.signMessage(message);
      const verified = await verifyAuthSignature(message, signature);
      if (!verified) {
        mLog.error('PrivyProvider', 'Backend verification refused the signature');
      }
      return verified;
    } catch (error) {
      this.lastAuthFailure = classifyAuthError(error);
      reportAuthFailure(this.lastAuthFailure.kind, 'request-authentication', this.lastAuthFailure.message);
      mLog.error('PrivyProvider', 'Authentication failed', { error: this.lastAuthFailure.message });
      return false;
    }
  }

  getLastAuthFailure(): AuthFailure | null {
    return this.lastAuthFailure;
  }

  private connectionInfo(s: PrivySnapshot) {
    const isConnected = s.authenticated && Boolean(s.address);
    return { isConnected, address: isConnected ? s.address : null };
  }

  private connected(address: string): ConnectionResult {
    return { success: true, address, capabilities: this.getCapabilities() };
  }

  /**
   * Best effort. An embedded wallet is already on the configured chain; an external one may
   * not be, and refusing to switch is the user's call — signing then fails loudly later.
   */
  private async ensureAppChain(api: NonNullable<ReturnType<typeof privyBridge.getApi>>): Promise<void> {
    try {
      await api.switchChain(this.config.chainId);
    } catch (error) {
      mLog.warn('PrivyProvider', 'Could not switch wallet to the app chain', {
        chainId: this.config.chainId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async signer(): Promise<ethers.JsonRpcSigner> {
    const provider = await this.getEthersProviderAsync();
    if (!provider) throw new Error('No provider available - not connected');
    return provider.getSigner();
  }
}
