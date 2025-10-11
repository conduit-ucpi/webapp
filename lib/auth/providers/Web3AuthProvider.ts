/**
 * Web3Auth provider implementation
 * Implements the unified provider interface for Web3Auth Modal with all adapters
 */

import { Web3Auth, WALLET_CONNECTORS } from "@web3auth/modal";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';

export class Web3AuthProvider implements UnifiedProvider {
  private web3authInstance: Web3Auth | null = null;
  private config: AuthConfig;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;
  private userInfo: { email?: string; idToken?: string; name?: string } | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
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

        // Setup interceptor AFTER initialization
        this.setupMobileMetaMaskInterceptor();
      }

      // Connect - this will show the modal with all options
      mLog.info('Web3AuthProvider', 'Opening Web3Auth modal');

      let provider;
      try {
        provider = await this.web3authInstance.connect();
      } catch (error: any) {
        // Re-throw all errors - no special handling for mobile MetaMask
        throw error;
      }

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

      // Get user info for potential future use
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

      mLog.info('Web3AuthProvider', '✅ Successfully connected');

      return {
        success: true,
        address: this.currentAddress,
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

  async signMessage(message: string): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    // Check if we should use direct MetaMask signing on mobile
    const { detectDevice } = await import('../../../utils/deviceDetection');
    const deviceInfo = detectDevice();
    const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;

    // Check if the current provider is MetaMask
    const provider = this.cachedEthersProvider.provider;
    const isMetaMask = this.isMetaMaskProvider(provider);

    if (isMobile && isMetaMask && typeof window !== 'undefined' && window.ethereum) {
      // Use MetaMask directly on mobile to bypass potential issues
      mLog.info('Web3AuthProvider', 'Using direct MetaMask signing on mobile');
      const address = await this.getAddress();
      return await this.signWithDirectMetaMask(message, address);
    } else {
      // Standard signing through ethers provider
      const signer = await this.cachedEthersProvider.getSigner();
      return await signer.signMessage(message);
    }
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


  /**
   * Setup interceptor to handle mobile MetaMask clicks
   */
  private setupMobileMetaMaskInterceptor(): void {
    if (!this.web3authInstance) return;

    // Check if we're on mobile
    const { detectDevice } = require('../../../utils/deviceDetection');
    const deviceInfo = detectDevice();
    const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;

    if (!isMobile) {
      mLog.debug('Web3AuthProvider', 'Not on mobile, skipping interceptor');
      return;
    }

    mLog.info('Web3AuthProvider', 'Mobile detected - setting up debug interceptors');

    // Listen to ALL Web3Auth events for debugging
    const events = ['connecting', 'connected', 'disconnected', 'errored', 'MODAL_VISIBILITY'];

    events.forEach(eventName => {
      this.web3authInstance!.on(eventName as any, (data: any) => {
        mLog.info('Web3AuthProvider', `Event: ${eventName}`, {
          data: JSON.stringify(data)
        });
      });
    });

    // Try to intercept window.open calls to see deep links
    const originalWindowOpen = window.open;
    window.open = function(...args: any[]) {
      mLog.info('Web3AuthProvider', 'WINDOW.OPEN INTERCEPTED', {
        url: args[0],
        target: args[1],
        features: args[2]
      });
      return originalWindowOpen.apply(window, args as any);
    };

    // Also try to intercept location changes
    const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      get: function() {
        return originalLocation?.get?.call(window);
      },
      set: function(value) {
        mLog.info('Web3AuthProvider', 'LOCATION CHANGE INTERCEPTED', {
          newLocation: value
        });
        originalLocation?.set?.call(window, value);
      }
    });
  }

}