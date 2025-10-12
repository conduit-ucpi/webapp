/**
 * Dynamic.xyz provider implementation
 * A modern, reliable wallet connection solution that handles mobile properly
 */

import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';

export class DynamicProvider implements UnifiedProvider {
  private config: AuthConfig;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;
  private dynamicInstance: any = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  getProviderName(): string {
    return 'dynamic';
  }

  async initialize(): Promise<void> {
    mLog.info('DynamicProvider', 'Initialize called');
    // Dynamic initialization happens via React context, not here
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Connect called - opening Dynamic modal');

    try {
      // Dynamic SDK is handled through React hooks, so we need to trigger the modal
      // This will be coordinated with the React component
      if (typeof window !== 'undefined' && (window as any).dynamicLogin) {
        mLog.info('DynamicProvider', 'Calling dynamicLogin function...');
        const result = await (window as any).dynamicLogin();

        mLog.info('DynamicProvider', 'Dynamic login result received', {
          hasResult: !!result,
          hasAddress: !!(result?.address),
          hasProvider: !!(result?.provider)
        });

        if (result && result.address) {
          this.currentAddress = result.address;

          // Create ethers provider from Dynamic's provider
          if (result.provider) {
            this.cachedEthersProvider = new ethers.BrowserProvider(result.provider);
            mLog.info('DynamicProvider', 'Ethers provider created successfully');
          } else {
            mLog.warn('DynamicProvider', 'No provider in result, using fallback');
          }

          const connectionResult = {
            success: true,
            address: result.address,
            capabilities: this.getCapabilities()
          };

          mLog.info('DynamicProvider', 'Connection successful', connectionResult);
          return connectionResult;
        } else {
          mLog.error('DynamicProvider', 'Invalid result from dynamicLogin', { result });
        }
      } else {
        mLog.error('DynamicProvider', 'dynamicLogin function not available on window');
      }

      return {
        success: false,
        error: 'Dynamic login not available or failed',
        capabilities: this.getCapabilities()
      };

    } catch (error) {
      mLog.error('DynamicProvider', 'Connection failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: this.getCapabilities()
      };
    }
  }

  async disconnect(): Promise<void> {
    mLog.info('DynamicProvider', 'Disconnecting');

    if (typeof window !== 'undefined' && (window as any).dynamicLogout) {
      await (window as any).dynamicLogout();
    }

    this.cachedEthersProvider = null;
    this.currentAddress = null;
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Switching wallet');
    
    // First disconnect
    await this.disconnect();
    
    // Then reconnect
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    return await signer.signMessage(message);
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    const signer = await this.cachedEthersProvider.getSigner();

    const tx = {
      to: params.to,
      data: params.data,
      value: params.value ? BigInt(params.value) : undefined,
      gasLimit: params.gasLimit ? BigInt(params.gasLimit.toString()) : undefined,
      gasPrice: params.gasPrice ? BigInt(params.gasPrice.toString()) : undefined,
      nonce: typeof params.nonce === 'string' ? parseInt(params.nonce) : params.nonce,
      chainId: params.chainId
    };

    const signedTx = await signer.signTransaction(tx);
    return signedTx;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    return this.cachedEthersProvider;
  }

  async getAddress(): Promise<string> {
    if (this.currentAddress) {
      return this.currentAddress;
    }

    if (!this.cachedEthersProvider) {
      throw new Error('No provider connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    this.currentAddress = await signer.getAddress();
    return this.currentAddress;
  }

  isConnected(): boolean {
    return !!this.cachedEthersProvider && !!this.currentAddress;
  }

  getUserInfo(): { email?: string; idToken?: string; name?: string } | null {
    // Dynamic provides user info through its React context
    if (typeof window !== 'undefined' && (window as any).dynamicUser) {
      return (window as any).dynamicUser;
    }
    return null;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    };
  }
}