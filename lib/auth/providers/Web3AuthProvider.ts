/**
 * Web3Auth provider implementation
 * Implements the unified provider interface for Web3Auth Modal with all adapters
 */

import { Web3Auth } from "@web3auth/modal";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { TokenManager } from '../core/TokenManager';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';
import { detectDevice } from '../../../utils/deviceDetection';

export class Web3AuthProvider implements UnifiedProvider {
  private web3authInstance: Web3Auth | null = null;
  private config: AuthConfig;
  private tokenManager: TokenManager;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;
  private userInfo: { email?: string; idToken?: string; name?: string } | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenManager = TokenManager.getInstance();
  }

  getProviderName(): string {
    return 'web3auth';
  }

  async initialize(): Promise<void> {
    mLog.info('Web3AuthProvider', 'Initialize called');
    // Don't pre-initialize to save resources - lazy load when needed
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('Web3AuthProvider', 'Connect called - initializing Web3Auth modal with all adapters');

    try {
      // Initialize Web3Auth if not already done
      if (!this.web3authInstance) {
        mLog.info('Web3AuthProvider', 'Creating Web3Auth instance');
        const web3authConfig = createWeb3AuthConfig({
          ...this.config,
          walletConnectProjectId: this.config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
        });

        this.web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);

        // Initialize Web3Auth Modal
        mLog.info('Web3AuthProvider', 'Initializing Web3Auth');
        await this.web3authInstance.init();
        mLog.info('Web3AuthProvider', 'Web3Auth initialized successfully');
      }

      // Connect - this will show the modal with all options
      mLog.info('Web3AuthProvider', 'Opening Web3Auth modal');
      const provider = await this.web3authInstance.connect();

      // Continue with normal flow - mobile MetaMask signing will be handled directly

      mLog.debug('Web3AuthProvider', 'Provider received', {
        type: typeof provider,
        constructor: provider?.constructor?.name,
        hasRequest: typeof provider?.request === 'function',
        hasSend: typeof provider?.send === 'function',
        hasOn: typeof provider?.on === 'function',
        providerKeys: provider ? Object.keys(provider) : []
      });

      if (!provider) {
        return {
          success: false,
          error: 'No provider returned from Web3Auth',
          capabilities: this.getCapabilities()
        };
      }

      mLog.info('Web3AuthProvider', 'Connected, getting user info');

      // Get user info and determine auth method
      this.userInfo = await this.web3authInstance.getUserInfo();

      // Create and cache the ethers provider (SINGLE INSTANCE)
      mLog.info('Web3AuthProvider', 'Creating ethers.BrowserProvider...');
      this.cachedEthersProvider = new ethers.BrowserProvider(provider);
      mLog.info('Web3AuthProvider', 'Created and cached single ethers provider instance');

      mLog.info('Web3AuthProvider', 'Getting signer...');
      const signer = await this.cachedEthersProvider.getSigner();
      mLog.debug('Web3AuthProvider', 'Signer obtained', {
        signerType: typeof signer,
        hasSignMessage: typeof signer.signMessage === 'function'
      });

      mLog.info('Web3AuthProvider', 'Getting address...');
      this.currentAddress = await signer.getAddress();
      mLog.info('Web3AuthProvider', 'Address obtained', { address: this.currentAddress });

      let authToken: string;

      // Check if this is a social login (has email) or wallet connection
      if (this.userInfo.email || this.userInfo.idToken) {
        // Social login - use the idToken
        mLog.info('Web3AuthProvider', 'Social login detected, using idToken');
        authToken = this.userInfo.idToken || `social:${this.currentAddress}`;
      } else {
        // External wallet - need signature for authentication
        mLog.info('Web3AuthProvider', 'External wallet detected, generating signature');

        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substring(2, 15);
        const message = `Authenticate wallet ${this.currentAddress} at ${timestamp} with nonce ${nonce}`;

        let signature: string;

        // Check if this is MetaMask and if we should use direct signing
        const deviceInfo = detectDevice();
        const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;
        const isMetaMask = this.isMetaMaskProvider(provider);

        if (isMobile && isMetaMask && typeof window !== 'undefined' && window.ethereum) {
          // Use MetaMask directly, bypassing Web3Auth's broken provider wrapper
          mLog.info('Web3AuthProvider', 'CRITICAL: Using direct MetaMask signing on mobile to bypass Web3Auth provider wrapper');
          await mLog.forceFlush();
          signature = await this.signWithDirectMetaMask(message, this.currentAddress);
        } else {
          // Use Web3Auth's provider wrapper (works for desktop and non-MetaMask)
          mLog.info('Web3AuthProvider', 'Using Web3Auth provider for signing', { isMobile, isMetaMask, hasWindowEthereum: !!(typeof window !== 'undefined' && window.ethereum) });
          await mLog.forceFlush();
          signature = await signer.signMessage(message);
        }

        authToken = btoa(JSON.stringify({
          type: 'signature_auth',
          walletAddress: this.currentAddress,
          message,
          signature,
          timestamp,
          nonce,
          issuer: 'web3auth_unified',
          header: {
            alg: 'ECDSA',
            typ: 'SIG'
          },
          payload: {
            sub: this.currentAddress,
            iat: Math.floor(timestamp / 1000),
            iss: 'web3auth_unified',
            wallet_type: 'external'
          }
        }));
      }

      // Store token
      this.tokenManager.setToken(authToken);

      mLog.info('Web3AuthProvider', '✅ Successfully connected and authenticated');

      return {
        success: true,
        address: this.currentAddress,
        token: authToken,
        capabilities: this.getCapabilities()
      };

    } catch (error) {
      mLog.error('Web3AuthProvider', 'Connection failed', {
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
    console.log('🔧 Web3AuthProvider: Disconnecting');

    if (this.web3authInstance) {
      await this.web3authInstance.logout();
      this.web3authInstance = null;
    }

    // Clear the cached ethers provider and address
    this.cachedEthersProvider = null;
    this.currentAddress = null;
    this.userInfo = null;

    console.log('🔧 Web3AuthProvider: Cleared cached ethers provider');

    this.tokenManager.clearToken();
  }

  async switchWallet(): Promise<ConnectionResult> {
    console.log('🔧 Web3AuthProvider: Switching wallet - clearing cache and showing modal');

    // Initialize Web3Auth if not already done
    if (!this.web3authInstance) {
      console.log('🔧 Web3AuthProvider: Creating Web3Auth instance for wallet switch');
      const web3authConfig = createWeb3AuthConfig({
        ...this.config,
        walletConnectProjectId: this.config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
      });

      this.web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);
      await this.web3authInstance.init();
    }

    // Clear any cached connection to force modal selection
    if (this.web3authInstance.connected) {
      console.log('🔧 Web3AuthProvider: Clearing existing connection to force modal');
      await this.web3authInstance.logout();
    }

    // Now connect which will show the modal with all options
    return this.connect();
  }

  getAuthToken(): string | null {
    return this.tokenManager.getToken();
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

    // Convert to ethers transaction format
    const tx = {
      to: params.to,
      data: params.data,
      value: params.value ? BigInt(params.value) : undefined,
      gasLimit: params.gasLimit ? BigInt(params.gasLimit.toString()) : undefined,
      gasPrice: params.gasPrice ? BigInt(params.gasPrice.toString()) : undefined,
      nonce: typeof params.nonce === 'string' ? parseInt(params.nonce) : params.nonce,
      chainId: params.chainId
    };

    // Sign the transaction
    const signedTx = await signer.signTransaction(tx);
    return signedTx;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    // Return the cached ethers provider (SINGLE INSTANCE)
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
    return !!this.web3authInstance?.connected && !!this.cachedEthersProvider;
  }

  getUserInfo(): { email?: string; idToken?: string; name?: string } | null {
    return this.userInfo;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    };
  }

  /**
   * Check if the provider is from MetaMask
   */
  private isMetaMaskProvider(provider: any): boolean {
    if (!provider) return false;

    // Check various MetaMask identifiers
    const isMetaMask = provider.isMetaMask === true ||
                      provider._metamask !== undefined ||
                      provider.constructor?.name?.toLowerCase().includes('metamask') ||
                      (provider.connection && provider.connection.url?.includes('metamask'));

    mLog.debug('Web3AuthProvider', 'MetaMask detection', {
      isMetaMask,
      hasIsMetaMaskFlag: provider.isMetaMask === true,
      hasMetamaskProperty: provider._metamask !== undefined,
      constructorName: provider.constructor?.name,
      connectionUrl: provider.connection?.url
    });

    return isMetaMask;
  }

  /**
   * Sign message directly with MetaMask, bypassing Web3Auth's provider wrapper
   */
  private async signWithDirectMetaMask(message: string, address: string): Promise<string> {
    const ethereum = (window as any).ethereum;

    if (!ethereum || !ethereum.isMetaMask) {
      throw new Error('MetaMask not available');
    }

    // Use personal_sign directly with MetaMask
    const msgHex = ethers.hexlify(ethers.toUtf8Bytes(message));

    try {
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [msgHex, address]
      });

      if (!signature) {
        throw new Error('No signature returned from MetaMask');
      }

      mLog.info('Web3AuthProvider', 'CRITICAL: Direct MetaMask signing SUCCESS');
      await mLog.forceFlush();
      return signature;
    } catch (error) {
      mLog.error('Web3AuthProvider', 'Direct MetaMask signing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

}