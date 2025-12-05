/**
 * WalletConnect provider implementation using Reown AppKit
 * Direct WalletConnect integration for wallets that work better without Dynamic abstraction
 */

import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ReownWalletConnectProvider } from '../../../components/auth/reownWalletConnect';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';

export class WalletConnectProvider implements UnifiedProvider {
  private reownProvider: ReownWalletConnectProvider;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;

  constructor(config: AuthConfig) {
    mLog.info('WalletConnectProvider', 'Initializing WalletConnect provider');
    this.reownProvider = new ReownWalletConnectProvider({
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      walletConnectProjectId: config.walletConnectProjectId,
    });
  }

  getProviderName(): string {
    return 'walletconnect';
  }

  async initialize(): Promise<void> {
    mLog.info('WalletConnectProvider', 'Initialize called');
    await this.reownProvider.initialize();
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('WalletConnectProvider', 'Connect called - opening WalletConnect modal');

    try {
      const result = await this.reownProvider.connect();

      if (result.success && result.user?.walletAddress) {
        this.currentAddress = result.user.walletAddress;

        // Create ethers provider from the wallet provider
        if (result.provider) {
          this.cachedEthersProvider = new ethers.BrowserProvider(result.provider);
        }

        mLog.info('WalletConnectProvider', 'Connection successful', {
          address: this.currentAddress
        });

        return {
          success: true,
          address: this.currentAddress || undefined,
          capabilities: this.getCapabilities()
        };
      }

      return {
        success: false,
        error: result.error || 'Connection failed',
        capabilities: this.getCapabilities()
      };
    } catch (error) {
      mLog.error('WalletConnectProvider', 'Connection failed', {
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
    mLog.info('WalletConnectProvider', 'Disconnecting');
    await this.reownProvider.disconnect();
    this.cachedEthersProvider = null;
    this.currentAddress = null;
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('WalletConnectProvider', 'Switch wallet called - disconnecting and reconnecting');
    await this.disconnect();
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    mLog.info('WalletConnectProvider', 'Sign message requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    // For embedded wallets (social login), we can't use getSigner() as it calls eth_requestAccounts
    // Instead, use personal_sign directly via the provider
    try {
      const walletProvider = this.reownProvider.getProvider();
      const address = await this.getAddress();

      mLog.info('WalletConnectProvider', 'Signing with personal_sign (works with embedded wallets)', {
        address,
        messageLength: message.length
      });

      // Use personal_sign directly - works with both regular wallets and embedded wallets
      const signature = await walletProvider.request({
        method: 'personal_sign',
        params: [message, address]
      });

      return signature;
    } catch (error) {
      mLog.error('WalletConnectProvider', 'Failed to sign message', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    mLog.info('WalletConnectProvider', 'Sign transaction requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    const signedTx = await signer.signTransaction({
      to: params.to,
      value: params.value,
      data: params.data,
      gasLimit: params.gasLimit,
    });

    return signedTx;
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    mLog.info('WalletConnectProvider', 'Send transaction requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    const response = await signer.sendTransaction({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      gasLimit: tx.gasLimit,
    });

    return response.hash;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    return this.cachedEthersProvider;
  }

  async getEthersProviderAsync(): Promise<ethers.BrowserProvider | null> {
    mLog.info('WalletConnectProvider', 'Get ethers provider requested (async)');
    return this.cachedEthersProvider;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    };
  }

  isConnected(): boolean {
    return this.reownProvider.isConnected();
  }

  async getAddress(): Promise<string> {
    if (!this.currentAddress) {
      throw new Error('No address available - not connected');
    }
    return this.currentAddress;
  }

  async getChainId(): Promise<number> {
    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const network = await this.cachedEthersProvider.getNetwork();
    return Number(network.chainId);
  }
}
