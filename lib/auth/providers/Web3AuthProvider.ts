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

        // Initialize Web3Auth Modal (WalletConnect adapter should be auto-included)
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
    const events = [
      'connecting', 'connected', 'disconnected', 'errored', 'MODAL_VISIBILITY',
      'adapter_connecting', 'adapter_connected', 'adapter_errored',
      'wallet_adapter_connected', 'wallet_adapter_connecting'
    ];

    events.forEach(eventName => {
      this.web3authInstance!.on(eventName as any, (data: any) => {
        mLog.info('Web3AuthProvider', `Event: ${eventName}`, {
          data: JSON.stringify(data)
        });

        // Force flush for all events to see them immediately
        mLog.forceFlush();

        // Special handling for MetaMask selection
        if (eventName === 'connecting' && data && data.connector === 'metamask') {
          mLog.info('Web3AuthProvider', 'METAMASK SELECTED - About to open deep link', {
            timestamp: Date.now(),
            data: JSON.stringify(data)
          });
          mLog.forceFlush();
        }
      });
    });

    // Focus on the specific events that matter most for debugging MetaMask connection

    // Intercept ALL possible navigation methods

    // Method 1: window.open
    const originalWindowOpen = window.open;
    window.open = function(...args: any[]) {
      mLog.info('Web3AuthProvider', 'WINDOW.OPEN INTERCEPTED', {
        url: args[0],
        target: args[1],
        features: args[2]
      });
      mLog.forceFlush();
      return originalWindowOpen.apply(window, args as any);
    };

    // Method 2: window.location assignment
    const originalLocationAssign = window.location.assign;
    window.location.assign = function(url: string) {
      mLog.info('Web3AuthProvider', 'LOCATION.ASSIGN INTERCEPTED', { url });
      mLog.forceFlush();
      return originalLocationAssign.call(window.location, url);
    };

    // Method 3: window.location.href assignment
    let originalHref = window.location.href;
    Object.defineProperty(window.location, 'href', {
      get: function() { return originalHref; },
      set: function(url: string) {
        mLog.info('Web3AuthProvider', 'LOCATION.HREF SET INTERCEPTED', { url });
        mLog.forceFlush();
        originalHref = url;
        window.location.assign(url);
      }
    });

    // Method 4: Monitor postMessage events instead of overriding (safer)
    window.addEventListener('message', (event) => {
      mLog.info('Web3AuthProvider', 'MESSAGE EVENT INTERCEPTED', {
        origin: event.origin,
        dataType: typeof event.data,
        data: JSON.stringify(event.data).substring(0, 200) // Truncate for safety
      });
      mLog.forceFlush();
    });

    // Intercept click events on the entire document to catch deep links
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') {
        const link = target as HTMLAnchorElement;
        mLog.info('Web3AuthProvider', 'ANCHOR CLICK INTERCEPTED', {
          href: link.href,
          text: link.textContent,
          target: link.target
        });
        mLog.forceFlush(); // Force flush immediately
      }
    }, true); // Use capture phase

    // Intercept all navigations
    const originalPushState = history.pushState;
    history.pushState = function(data: any, unused: string, url?: string | URL | null) {
      mLog.info('Web3AuthProvider', 'PUSHSTATE INTERCEPTED', {
        url: url
      });
      return originalPushState.call(history, data, unused, url);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function(data: any, unused: string, url?: string | URL | null) {
      mLog.info('Web3AuthProvider', 'REPLACESTATE INTERCEPTED', {
        url: url
      });
      return originalReplaceState.call(history, data, unused, url);
    };

    // Monitor all URL changes via MutationObserver - Enhanced for any deep link
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              // Log ANY new anchor element being added
              if (element.tagName === 'A') {
                const link = element as HTMLAnchorElement;
                mLog.info('Web3AuthProvider', 'ANY LINK ADDED TO DOM', {
                  href: link.href,
                  id: link.id,
                  className: link.className,
                  text: link.textContent?.trim()
                });
                mLog.forceFlush();

                // Special logging for MetaMask or deep links
                if (link.href && (link.href.startsWith('metamask://') ||
                                 link.href.includes('metamask') ||
                                 link.href.includes('://') && !link.href.startsWith('http'))) {
                  mLog.info('Web3AuthProvider', 'POTENTIAL DEEP LINK ADDED TO DOM', {
                    href: link.href,
                    id: link.id,
                    className: link.className
                  });
                  mLog.forceFlush();
                }
              }

              // Check for any child links too
              const allLinks = element.querySelectorAll('a');
              allLinks.forEach((link) => {
                mLog.info('Web3AuthProvider', 'CHILD LINK FOUND IN ADDED ELEMENT', {
                  href: (link as HTMLAnchorElement).href,
                  text: link.textContent?.trim()
                });
                mLog.forceFlush();
              });
            }
          });
        }

        // Also monitor attribute changes that might set href
        if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
          const element = mutation.target as HTMLAnchorElement;
          mLog.info('Web3AuthProvider', 'HREF ATTRIBUTE CHANGED', {
            href: element.href,
            element: element.tagName
          });
          mLog.forceFlush();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href']
    });

    // Also monitor for iframe src changes
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(document, tagName);
      if (tagName.toLowerCase() === 'iframe') {
        const iframe = element as HTMLIFrameElement;
        Object.defineProperty(iframe, 'src', {
          get: function() {
            return this.getAttribute('src');
          },
          set: function(value: string) {
            if (value && (value.includes('metamask') || value.startsWith('metamask://'))) {
              mLog.info('Web3AuthProvider', 'IFRAME SRC SET TO METAMASK URL', {
                src: value
              });
            }
            this.setAttribute('src', value);
          }
        });
      }
      return element;
    };

    // Monitor for any navigation attempts via document.location
    const originalDocumentLocation = document.location;
    try {
      Object.defineProperty(document, 'location', {
        get: function() {
          return originalDocumentLocation;
        },
        set: function(value) {
          mLog.info('Web3AuthProvider', 'DOCUMENT.LOCATION SET', {
            newLocation: value
          });
          originalDocumentLocation.href = value;
        }
      });
    } catch (e) {
      // Already defined
    }
  }

}