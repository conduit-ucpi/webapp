import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  AuthUser, 
  AuthState, 
  AuthResult, 
  IAuthProvider,
  AuthContextType,
  AuthEvent
} from './authInterface';
import { useConfig } from './ConfigProvider';
import { formatUnits } from 'ethers';
import { createWeb3AuthContractMethods } from '@/utils/contractTransactionFactory';

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Web3Auth No-Modal Provider implementation
 * This version embeds auth UI directly in the page instead of using popups
 */
class Web3AuthNoModalProviderImpl implements IAuthProvider {
  private state: AuthState = {
    user: null,
    token: null,
    isConnected: false,
    isLoading: false,
    isInitialized: false,
    error: null,
    providerName: 'web3auth'
  };
  
  private web3auth: any = null;
  private provider: any = null;
  private web3Service: any = null;
  private listeners = new Map<AuthEvent['type'], Set<(event: AuthEvent) => void>>();
  private visitedKey = 'web3auth_visited';
  private config: any = null;
  private cachedEthersProvider: any = null;
  private adapters: Map<string, any> = new Map();
  private chainConfig: any = null;

  constructor(config?: any) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;
    
    try {
      this.state.isLoading = true;
      console.log('🔧 Web3Auth No-Modal: Starting initialization...');
      
      // Import Web3Auth dynamically
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
        if (!this.config) {
          throw new Error('Config not provided to Web3Auth provider');
        }

        console.log('🔧 Web3Auth No-Modal: Config received:', {
          web3AuthClientId: this.config.web3AuthClientId ? 'Present' : 'Missing',
          web3AuthNetwork: this.config.web3AuthNetwork,
          chainId: this.config.chainId,
          rpcUrl: this.config.rpcUrl ? 'Present' : 'Missing',
        });

        const { Web3AuthNoModal } = await import('@web3auth/no-modal');
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import('@web3auth/base');
        const { EthereumPrivateKeyProvider } = await import('@web3auth/ethereum-provider');
        const { OpenloginAdapter } = await import('@web3auth/openlogin-adapter');
        const { MetamaskAdapter } = await import('@web3auth/metamask-adapter');
        const { WalletConnectV2Adapter } = await import('@web3auth/wallet-connect-v2-adapter');
        
        const web3AuthNetworkSetting = this.config.web3AuthNetwork === 'sapphire_mainnet' 
          ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
          : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
        
        this.chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: `0x${this.config.chainId.toString(16)}`,
          rpcTarget: this.config.rpcUrl,
          displayName: this.getChainDisplayName(),
          blockExplorerUrl: this.config.explorerBaseUrl,
          ticker: this.getChainTicker(),
          tickerName: this.getChainTickerName(),
        };

        console.log('🔧 Web3Auth No-Modal: Creating Web3Auth instance with:', {
          clientId: this.config.web3AuthClientId?.substring(0, 20) + '...',
          web3AuthNetwork: web3AuthNetworkSetting,
          chainConfig: this.chainConfig
        });

        // Create Ethereum provider
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig: this.chainConfig }
        } as any);

        // Create and configure OpenLogin adapter FIRST
        console.log('🔧 Web3Auth No-Modal: Creating OpenLogin adapter...');
        const openloginAdapter = new OpenloginAdapter({
          chainConfig: this.chainConfig,
          privateKeyProvider: privateKeyProvider,
          adapterSettings: {
            uxMode: 'popup',
            // Remove custom loginConfig and let Web3Auth use its default email passwordless verifier
            // Web3Auth should have built-in support for email_passwordless
          },
        });
        
        console.log('🔧 Web3Auth No-Modal: OpenLogin adapter created');
        this.adapters.set('openlogin', openloginAdapter);

        // Create and configure MetaMask adapter
        console.log('🔧 Web3Auth No-Modal: Creating MetaMask adapter...');
        const metamaskAdapter = new MetamaskAdapter({
          chainConfig: this.chainConfig,
          sessionTime: 3600, // 1 hour
          web3AuthNetwork: web3AuthNetworkSetting,
          clientId: this.config.web3AuthClientId,
        });
        
        console.log('🔧 Web3Auth No-Modal: MetaMask adapter created');
        this.adapters.set('metamask', metamaskAdapter);

        // Configure WalletConnect V2 adapter
        console.log('🔧 Web3Auth No-Modal: Creating WalletConnect V2 adapter...');
        
        // WalletConnect adapter needs its own project ID
        const walletConnectProjectId = this.config.walletConnectProjectId || this.config.web3AuthClientId;
        console.log('🔧 Web3Auth No-Modal: Using WalletConnect Project ID:', walletConnectProjectId?.substring(0, 10) + '...');
        
        // Create a custom QR code modal implementation for WalletConnect
        const customQRCodeModal = {
          async openModal(options: { uri: string }) {
            console.log('🔧 WalletConnect QR Modal: Opening with URI:', options.uri);
            // Store the URI in a global variable that the UI can access
            if (typeof window !== 'undefined') {
              (window as any).walletConnectUri = options.uri;
              // Dispatch a custom event to notify the UI
              window.dispatchEvent(new CustomEvent('walletconnect-uri', { 
                detail: { uri: options.uri } 
              }));
            }
          },
          async closeModal() {
            console.log('🔧 WalletConnect QR Modal: Closing');
            if (typeof window !== 'undefined') {
              (window as any).walletConnectUri = null;
              // Dispatch a custom event to notify the UI to close
              window.dispatchEvent(new CustomEvent('walletconnect-close'));
            }
          }
        };
        
        const walletConnectAdapter = new WalletConnectV2Adapter({
          chainConfig: this.chainConfig,
          clientId: walletConnectProjectId,
          web3AuthNetwork: web3AuthNetworkSetting,
          sessionTime: 3600 * 24 * 7, // 1 week
          adapterSettings: {
            qrcodeModal: customQRCodeModal,
            walletConnectInitOptions: {
              projectId: walletConnectProjectId,
              metadata: {
                name: 'Conduit UCPI',
                description: 'Instant Escrow - Secure payment gateway',
                url: typeof window !== 'undefined' ? window.location.origin : 'https://conduit-ucpi.com',
                icons: ['https://conduit-ucpi.com/logo.png']
              }
            }
          }
        } as any);
        
        console.log('🔧 Web3Auth No-Modal: WalletConnect V2 adapter created');
        this.adapters.set('wallet-connect-v2', walletConnectAdapter);

        // Initialize Web3Auth No-Modal instance
        console.log('🔧 Web3Auth No-Modal: Creating Web3AuthNoModal instance...');
        this.web3auth = new Web3AuthNoModal({
          clientId: this.config.web3AuthClientId,
          web3AuthNetwork: web3AuthNetworkSetting,
          privateKeyProvider: privateKeyProvider as any,
        });
        
        console.log('🔧 Web3Auth No-Modal: Web3AuthNoModal instance created');

        // Configure adapters using configureAdapter method
        console.log('🔧 Web3Auth No-Modal: Configuring adapters...');
        this.web3auth.configureAdapter(openloginAdapter);
        console.log('🔧 Web3Auth No-Modal: OpenLogin adapter configured');
        
        this.web3auth.configureAdapter(metamaskAdapter);
        console.log('🔧 Web3Auth No-Modal: MetaMask adapter configured');
        
        this.web3auth.configureAdapter(walletConnectAdapter);
        console.log('🔧 Web3Auth No-Modal: WalletConnect V2 adapter configured');

        // Verify we have at least one adapter configured
        if (this.adapters.size === 0) {
          throw new Error('No adapters configured. At least one adapter is required for Web3Auth no-modal.');
        }
        
        console.log('🔧 Web3Auth No-Modal: Initializing with adapters...');
        console.log('🔧 Web3Auth No-Modal: Configured adapters:', Array.from(this.adapters.keys()));
        console.log('🔧 Web3Auth No-Modal: About to call web3auth.init()');
        await this.web3auth.init();
        console.log('🔧 Web3Auth No-Modal: web3auth.init() completed successfully');
        
        // Verify connectors are properly registered
        console.log('🔧 Web3Auth No-Modal: Web3Auth status:', this.web3auth.status);
        console.log('🔧 Web3Auth No-Modal: Connected connector name:', this.web3auth.connectedConnectorName);
        console.log('🔧 Web3Auth No-Modal: Available adapters from our map:', Array.from(this.adapters.keys()));
        console.log('🔧 Web3Auth No-Modal: Web3Auth connectors property:', this.web3auth.connectors);
        console.log('🔧 Web3Auth No-Modal: Available connectors:', this.web3auth.connectors ? Array.from(this.web3auth.connectors.keys()) : 'none');
        
        this.state.isInitialized = true;
        console.log('🔧 Web3Auth No-Modal: Initialization complete');
        
        // Check if already connected
        if (this.web3auth.connected) {
          console.log('🔧 Web3Auth No-Modal: Already connected, fetching user info...');
          await this.handleConnected();
        }
        
        if (this.state.user && this.state.token) {
        this.emit({ type: 'connected', user: this.state.user, token: this.state.token || '' });
      }
      } else {
        // Test environment
        this.state.isInitialized = true;
        if (this.state.user && this.state.token) {
        this.emit({ type: 'connected', user: this.state.user, token: this.state.token || '' });
      }
      }
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Initialization failed:', error);
      console.error('🔧 Web3Auth No-Modal: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorObject: error
      });
      this.state.error = error instanceof Error ? error.message : 'Failed to initialize Web3Auth';
      this.emit({ type: 'error', error: this.state.error });
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectWithAdapter(adapter: string, loginHint?: string): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    if (!this.web3auth) {
      throw new Error('Web3Auth not initialized');
    }

    try {
      this.state.isLoading = true;
      this.state.error = null;
      
      console.log(`🔧 Web3Auth No-Modal: Connecting with ${adapter}...`);
      
      // Check if adapter exists in our registered adapters or is a special case
      if (!this.adapters.has(adapter) && adapter !== 'external_wallet' && adapter !== 'walletconnect') {
        const availableAdapters = this.getAvailableAdapters();
        throw new Error(`Adapter '${adapter}' not found. Available adapters: ${availableAdapters.join(', ')}`);
      }
      
      let web3authProvider;
      
      if (adapter === 'openlogin') {
        // For social logins and email, we can pass additional params
        const extraLoginOptions: any = {};
        let loginProvider = loginHint || 'google';
        
        if (typeof loginHint === 'string' && loginHint.includes('@')) {
          // If loginHint contains an email address, use it for email_passwordless
          loginProvider = 'email_passwordless';
          extraLoginOptions.login_hint = loginHint;
        } else if (loginHint && loginHint !== 'email') {
          extraLoginOptions.login_hint = loginHint;
        }
        
        const connectOptions = {
          loginProvider: loginProvider, // Supports: 'google', 'facebook', 'email_passwordless', etc.
          extraLoginOptions,
          chainId: this.chainConfig.chainId, // Add explicit chainId
        };
        
        console.log('🔧 Web3Auth No-Modal: Connecting to openlogin with options:', connectOptions);
        console.log('🔧 Web3Auth No-Modal: Available chainConfig during connect:', this.chainConfig);
        
        // Use WALLET_ADAPTERS.AUTH for OpenLogin as per Web3Auth docs
        web3authProvider = await this.web3auth.connectTo('openlogin', connectOptions);
      } else if (adapter === 'metamask') {
        // MetaMask uses its own adapter
        console.log('🔧 Web3Auth No-Modal: Connecting to MetaMask adapter');
        web3authProvider = await this.web3auth.connectTo(adapter);
      } else if (adapter === 'walletconnect') {
        // Use our custom WalletConnect v2 provider
        console.log('🔧 Web3Auth No-Modal: Connecting to WalletConnect v2');
        return await this.handleWalletConnectV2Connection();
      } else if (adapter === 'external_wallet') {
        // Handle external wallet connection directly (not through Web3Auth)
        console.log('🔧 Web3Auth No-Modal: Handling external wallet connection');
        return await this.handleExternalWalletConnection();
      } else {
        // For other wallet adapters
        console.log(`🔧 Web3Auth No-Modal: Connecting to ${adapter} wallet adapter`);
        web3authProvider = await this.web3auth.connectTo(adapter);
      }

      if (!web3authProvider) {
        throw new Error('Failed to connect to Web3Auth');
      }

      this.provider = web3authProvider;
      await this.initializeWeb3Service();
      await this.handleConnected();
      
      return {
        success: true,
        user: this.state.user || {},
        token: this.state.token || '' || ''
      };
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Connection failed:', error);
      console.error('🔧 Web3Auth No-Modal: Connection error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorObject: error,
        adapterRequested: adapter,
        loginHint
      });
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.state.error = errorMessage;
      this.emit({ type: 'error', error: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      this.state.isLoading = false;
    }
  }

  async connect(): Promise<{ user: any; token: string }> {
    // Default to Google login
    const result = await this.connectWithAdapter('openlogin', 'google');
    if (result.success && result.user) {
      return { user: result.user, token: result.token || '' };
    }
    throw new Error(result.error || 'Connection failed');
  }

  async disconnect(): Promise<void> {
    
    if (!this.web3auth) return;
    
    try {
      this.state.isLoading = true;
      await this.web3auth.logout();
      this.provider = null;
      this.cachedEthersProvider = null;
      this.state.user = null;
      this.state.token = null;
      this.state.isConnected = false;
      
      // Clear session storage
      localStorage.removeItem(this.visitedKey);
      
      this.emit({ type: 'disconnected' });
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Disconnect failed:', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to disconnect';
      this.emit({ type: 'error', error: this.state.error });
    } finally {
      this.state.isLoading = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No provider available');
    }

    try {
      const { ethers } = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      return await signer.signMessage(message);
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Sign message failed:', error);
      throw error;
    }
  }

  getEthersProvider(): any {
    
    if (!this.provider) {
      throw new Error('No provider available');
    }

    if (!this.cachedEthersProvider) {
      const { ethers } = require('ethers');
      this.cachedEthersProvider = new ethers.BrowserProvider(this.provider);
    }

    return this.cachedEthersProvider;
  }

  // Get the actual underlying provider for contract operations
  getActualProvider(): any {
    
    // Otherwise return this wrapper (for Web3Auth, external wallets, etc.)
    console.log('🔧 Web3Auth No-Modal: Returning wrapper for contract operations');
    return this;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  isReady(): boolean {
    return this.state.isInitialized;
  }

  on(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: AuthEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  private async handleConnected(): Promise<void> {
    if (!this.web3auth || !this.web3auth.connected) return;

    try {
      this.provider = this.web3auth.provider;
      
      // Get user info
      const userInfo = await this.web3auth.getUserInfo();
      console.log('🔧 Web3Auth No-Modal: User info:', userInfo);

      // For external wallets, try to get the idToken using getIdentityToken()
      // This should provide a proper JWT token even for MetaMask connections
      let idToken = userInfo.idToken;
      
      console.log('🔧 Web3Auth No-Modal: Token debugging:', {
        userInfoIdToken: userInfo.idToken,
        hasGetIdentityTokenMethod: !!this.web3auth.getIdentityToken,
        web3authMethods: Object.keys(this.web3auth || {}),
        connectedConnectorName: this.web3auth?.connectedConnectorName
      });
      
      if (!idToken) {
        if (this.web3auth.getIdentityToken) {
          try {
            console.log('🔧 Web3Auth No-Modal: No idToken from getUserInfo, trying getIdentityToken...');
            const authUser = await this.web3auth.getIdentityToken();
            console.log('🔧 Web3Auth No-Modal: getIdentityToken result:', authUser);
            if (authUser?.idToken) {
              idToken = authUser.idToken;
              console.log('🔧 Web3Auth No-Modal: Got idToken from getIdentityToken!');
            } else {
              console.warn('🔧 Web3Auth No-Modal: getIdentityToken returned no idToken:', authUser);
            }
          } catch (error) {
            console.error('🔧 Web3Auth No-Modal: getIdentityToken failed:', error);
          }
        } else {
          console.error('🔧 Web3Auth No-Modal: getIdentityToken method not available!');
        }
        
        // Final attempt: check if web3auth has any token properties
        console.log('🔧 Web3Auth No-Modal: Web3Auth instance properties:', {
          sessionId: this.web3auth.sessionId,
          state: this.web3auth.state,
          status: this.web3auth.status,
          privKey: this.web3auth.privKey ? 'present' : 'missing'
        });
        
      }

      // Get wallet address
      const { ethers } = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      // If we still don't have an idToken, this might be an external wallet
      // where Web3Auth doesn't provide idTokens. In this case, we need to
      // generate a signature-based authentication token.
      if (!idToken) {
        console.log('🔧 Web3Auth No-Modal: No idToken available, generating signature-based token...');
        try {
          idToken = await this.generateSignatureToken(address);
          console.log('🔧 Web3Auth No-Modal: Generated signature token for Web3Auth external wallet connection');
        } catch (sigError) {
          console.error('🔧 Web3Auth No-Modal: Signature token generation failed:', sigError);
          console.error('🔧 Web3Auth No-Modal: This connection cannot be authenticated without a token');
        }
      }

      // Get USDC balance
      let usdcBalance = '0';
      try {
        if (this.config?.usdcContractAddress) {
          const usdcContract = new ethers.Contract(
            this.config.usdcContractAddress,
            ERC20_ABI,
            ethersProvider
          );
          const balance = await usdcContract.balanceOf(address);
          usdcBalance = formatUnits(balance, 6);
        }
      } catch (error) {
        console.warn('Failed to fetch USDC balance:', error);
      }

      // Create user object
      this.state.user = {
        userId: userInfo.verifierId || address,
        email: userInfo.email || '',
        displayName: userInfo.name || '',
        profileImageUrl: userInfo.profileImage || '',
        walletAddress: address,
        authProvider: userInfo.typeOfLogin || 'web3auth'
      };

      this.state.isConnected = true;
      this.state.token = idToken || null;
      
      // Mark as visited
      localStorage.setItem(this.visitedKey, 'true');
      
      // Emit connected event only if we have both user and a valid token
      // This ensures proper backend authentication for all wallet types
      // Token can be either:
      // 1. Web3Auth idToken (for social logins) - JWT signed by Web3Auth
      // 2. Signature token (for external wallets) - Base64 encoded signature data
      console.log('🔧 Web3Auth No-Modal: Connection result', {
        hasUser: !!this.state.user,
        hasToken: !!this.state.token,
        authProvider: this.state.user?.authProvider,
        tokenLength: this.state.token?.length,
        tokenType: this.state.token?.startsWith('ey') ? 'JWT' : 'Signature'
      });
      
      if (this.state.user && this.state.token) {
        this.emit({ type: 'connected', user: this.state.user, token: this.state.token || '' });
      } else {
        const missingItems = [];
        if (!this.state.user) missingItems.push('user');
        if (!this.state.token) missingItems.push('token');
        
        this.state.error = `Authentication incomplete: missing ${missingItems.join(' and ')}`;
        this.emit({ type: 'error', error: this.state.error });
        console.error('🔧 Web3Auth No-Modal: Authentication incomplete', { missingItems });
      }
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Failed to handle connection:', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to get user info';
      this.emit({ type: 'error', error: this.state.error });
    }
  }

  private getChainDisplayName(): string {
    switch (this.config?.chainId) {
      case 8453: return 'Base';
      case 84532: return 'Base Sepolia';
      default: return 'Unknown Chain';
    }
  }

  private getChainTicker(): string {
    return 'ETH';
  }

  private getChainTickerName(): string {
    return 'Ethereum';
  }

  // Required interface methods
  dispose(): void {
    // Cleanup resources
    if (this.cachedEthersProvider) {
      this.cachedEthersProvider = null;
    }
    this.listeners.clear();
  }

  getToken(): string | null {
    return this.state.token;
  }

  hasVisitedBefore(): boolean {
    return localStorage.getItem(this.visitedKey) === 'true';
  }

  markAsVisited(): void {
    localStorage.setItem(this.visitedKey, 'true');
  }

  async getUSDCBalance(userAddress?: string): Promise<string> {
    const address = userAddress || this.state.user?.walletAddress;
    if (!address || !this.config?.usdcContractAddress) {
      return '0';
    }

    try {
      const ethersProvider = this.getEthersProvider();
      const { ethers } = await import('ethers');
      const usdcContract = new ethers.Contract(
        this.config.usdcContractAddress,
        ERC20_ABI,
        ethersProvider
      );
      const balance = await usdcContract.balanceOf(address);
      return ethers.formatUnits(balance, 6);
    } catch (error) {
      console.warn('Failed to fetch USDC balance:', error);
      return '0';
    }
  }

  /**
   * Initialize Web3Service for fundAndSendTransaction functionality
   */
  private async initializeWeb3Service(): Promise<void> {
    if (!this.provider || !this.config) {
      console.warn('🔧 Web3Auth No-Modal: Cannot initialize Web3Service - provider or config missing');
      return;
    }

    try {
      const { Web3Service } = await import('@/lib/web3');
      this.web3Service = new Web3Service(this.config);
      
      // Create a compatible wallet provider for Web3Service
      const walletProvider = {
        getAddress: async () => {
          const accounts = await this.provider.request({ method: 'eth_accounts', params: [] });
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts available');
          }
          return accounts[0];
        },
        signTransaction: async (params: any) => {
          // For Web3Auth, we can use the provider's request method
          const txRequest = {
            from: params.from,
            to: params.to,
            data: params.data,
            value: params.value || '0x0',
            gasLimit: params.gasLimit,
            gasPrice: params.gasPrice,
            nonce: params.nonce
          };
          return await this.provider.request({ method: 'eth_signTransaction', params: [txRequest] });
        },
        signMessage: async (message: string) => {
          const accounts = await this.provider.request({ method: 'eth_accounts', params: [] });
          const address = accounts[0];
          return await this.provider.request({ method: 'personal_sign', params: [message, address] });
        },
        request: async ({ method, params }: { method: string; params: any[] }) => {
          return await this.provider.request({ method, params });
        },
        isConnected: () => {
          return this.state.isConnected;
        },
        getProviderName: () => {
          return 'web3auth-nomodal';
        },
        getEthersProvider: () => this.getEthersProvider()
      };
      
      await this.web3Service.initializeProvider(walletProvider);
      console.log('🔧 Web3Auth No-Modal: Web3Service initialized successfully');
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Failed to initialize Web3Service:', error);
    }
  }

  // Web3Auth provider only handles low-level transaction operations
  // High-level contract logic is in shared services

  // Supporting methods for Web3Auth contract operations
  async fundAndSendTransaction(txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }): Promise<string> {
    if (!this.web3Service) {
      console.warn('🔧 Web3Auth No-Modal: Web3Service not initialized, attempting to initialize...');
      await this.initializeWeb3Service();
      
      if (!this.web3Service) {
        throw new Error('Web3Service not initialized - call initializeWeb3Service first');
      }
    }
    
    return await this.web3Service.fundAndSendTransaction(txParams);
  }

  async signContractTransaction(params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
  }): Promise<string> {
    console.log(`🚨 SECURITY DEBUG - signContractTransaction called with:`, {
      contractAddress: params.contractAddress,
      functionName: params.functionName,
      functionArgs: params.functionArgs,
      debugLabel: params.debugLabel,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack
    });
    
    if (!this.provider) {
      throw new Error('No provider available');
    }

    try {
      const ethersProvider = this.getEthersProvider();
      const signer = await ethersProvider.getSigner();
      
      // Create contract instance with the EXACT address passed in
      const { Contract } = require('ethers');
      const contract = new Contract(params.contractAddress, params.abi, signer);
      
      console.log(`🚨 SECURITY DEBUG - Contract instance created:`, {
        contractAddress: contract.target || contract.address,
        functionToCall: params.functionName,
        inputAddress: params.contractAddress,
        addressMatch: (contract.target || contract.address) === params.contractAddress
      });
      
      // Build the transaction
      const txRequest = await contract[params.functionName].populateTransaction(...params.functionArgs);
      
      console.log(`🚨 SECURITY DEBUG - Transaction request populated:`, {
        to: txRequest.to,
        data: txRequest.data,
        inputContractAddress: params.contractAddress,
        populatedTo: txRequest.to,
        addressesMatch: txRequest.to === params.contractAddress,
        functionName: params.functionName,
        debugLabel: params.debugLabel
      });
      
      // Sign the transaction
      const signedTx = await signer.signTransaction(txRequest);
      
      console.log(`🚨 SECURITY DEBUG - Transaction signed:`, {
        signedTxLength: signedTx.length,
        debugLabel: params.debugLabel,
        originalContractAddress: params.contractAddress,
        transactionTo: txRequest.to
      });
      
      return signedTx;
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Sign contract transaction failed:', error);
      console.error('🚨 SECURITY DEBUG - Sign transaction error details:', {
        error: error,
        contractAddress: params.contractAddress,
        functionName: params.functionName,
        debugLabel: params.debugLabel
      });
      throw error;
    }
  }




  /**
   * Generate a signature-based authentication token for external wallets
   * This provides secure authentication when Web3Auth doesn't provide idTokens
   */
  private async generateSignatureToken(walletAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No provider available for signature generation');
    }

    try {
      // Create a message to sign that includes timestamp and wallet address
      // This prevents replay attacks and proves wallet ownership
      const timestamp = Date.now();
      const nonce = Math.random().toString(36).substring(2, 15);
      const message = `Authenticate wallet ${walletAddress} at ${timestamp} with nonce ${nonce}`;

      console.log('🔧 Web3Auth No-Modal: Generating signature for message:', message);

      // Sign the message with the user's wallet
      const signature = await this.signMessage(message);

      // Create a custom JWT-like token (not a real JWT, but structured for compatibility)
      // The backend should verify this signature matches the wallet address
      const signatureToken = btoa(JSON.stringify({
        type: 'signature_auth',
        walletAddress,
        message,
        signature,
        timestamp,
        nonce,
        issuer: 'web3auth_external_wallet',
        // Add a simple header/payload structure for compatibility
        header: { alg: 'ECDSA', typ: 'SIG' },
        payload: { 
          sub: walletAddress, 
          iat: Math.floor(timestamp / 1000),
          iss: 'web3auth_external_wallet',
          wallet_type: 'external'
        }
      }));

      console.log('🔧 Web3Auth No-Modal: Generated signature token length:', signatureToken.length);
      return signatureToken;

    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: Failed to generate signature token:', error);
      throw new Error(`Signature authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Handle external wallet connection (MetaMask, etc.) using signature authentication
   * This bypasses Web3Auth entirely and connects directly to external wallets
   */
  private async handleExternalWalletConnection(): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    try {
      // Check if external wallet is available
      const { ExternalWalletProvider } = await import('@/lib/wallet/external-wallet-provider');
      if (!ExternalWalletProvider.isAvailable()) {
        throw new Error('No external wallet found. Please install MetaMask or another compatible wallet.');
      }

      // Create external wallet auth provider
      const { ExternalWalletAuthProvider } = await import('@/lib/auth/external-wallet-provider');
      const externalAuthProvider = new ExternalWalletAuthProvider();
      
      await externalAuthProvider.initialize();
      
      // Connect and get signature token
      const authResult = await externalAuthProvider.connect();
      
      // Set the raw ethereum provider (not the ethers provider) for subsequent operations
      // The Web3Auth methods expect this.provider to be the raw provider
      this.provider = (window as any).ethereum;
      
      // Create user object
      this.state.user = {
        userId: authResult.walletAddress,
        email: authResult.walletAddress,
        displayName: 'External Wallet User',
        profileImageUrl: '',
        walletAddress: authResult.walletAddress,
        authProvider: 'external_wallet'
      };

      this.state.isConnected = true;
      this.state.token = authResult.idToken;
      
      // Emit connected event
      this.emit({ type: 'connected', user: this.state.user, token: this.state.token || '' });
      
      return {
        success: true,
        user: this.state.user,
        token: this.state.token || ''
      };
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: External wallet connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'External wallet connection failed';
      this.state.error = errorMessage;
      this.emit({ type: 'error', error: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async handleWalletConnectV2Connection(): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    try {
      console.log('🔧 Web3Auth No-Modal: Connecting to WalletConnect v2 via Web3Auth adapter...');
      
      // Use Web3Auth's WalletConnect adapter
      if (!this.web3auth) {
        throw new Error('Web3Auth not initialized');
      }
      
      // Connect through Web3Auth's WalletConnect adapter
      const web3authProvider = await this.web3auth.connectTo('wallet-connect-v2');
      
      if (!web3authProvider) {
        throw new Error('Failed to connect to WalletConnect via Web3Auth');
      }
      
      this.provider = web3authProvider;
      
      // Initialize Web3 service
      await this.initializeWeb3Service();
      
      // Handle the connected state
      await this.handleConnected();
      
      // Clear any cached provider since we have a new connection
      this.cachedEthersProvider = null;
      
      console.log('🔧 Web3Auth No-Modal: WalletConnect connected successfully via Web3Auth adapter');
      console.log('🔧 Web3Auth No-Modal: Provider type:', this.provider?.constructor?.name);
      
      // The user state will be handled by handleConnected()
      // which was already called above
      
      return {
        success: true,
        user: this.state.user || {},
        token: this.state.token || ''
      };
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: WalletConnect v2 connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'WalletConnect connection failed';
      this.state.error = errorMessage;
      this.emit({ type: 'error', error: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Additional helper methods for the no-modal SDK
  getAvailableAdapters(): string[] {
    const adapters = Array.from(this.adapters.keys());
    // Add external wallet and walletconnect as available options
    adapters.push('external_wallet');
    adapters.push('walletconnect');
    return adapters;
  }

  isAdapterReady(adapter: string): boolean {
    if (adapter === 'external_wallet') {
      const { ExternalWalletProvider } = require('@/lib/wallet/external-wallet-provider');
      return ExternalWalletProvider.isAvailable();
    }
    if (adapter === 'walletconnect') {
      // WalletConnect is always available as we use our custom provider
      return true;
    }
    return this.adapters.has(adapter) && this.web3auth?.status === 'ready';
  }
}

// Create provider instance
let providerInstance: Web3AuthNoModalProviderImpl | null = null;

export function getWeb3AuthNoModalProvider(config?: any): IAuthProvider {
  if (!providerInstance) {
    providerInstance = new Web3AuthNoModalProviderImpl(config);
  }
  return providerInstance;
}

// Extend window interface for WalletConnect URI handler
declare global {
  interface Window {
    web3authWalletConnectUri?: (uri: string) => void;
  }
}