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
import { toHexString } from '@/utils/hexUtils';
import { ReownWalletConnectProvider } from './reownWalletConnect';

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
    console.log('🚨🚨🚨 CONSTRUCTOR CALLED - config.chainId:', config?.chainId, 'type:', typeof config?.chainId);
    console.log('🚨🚨🚨 CONSTRUCTOR FULL CONFIG:', JSON.stringify(config, null, 2));
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('🚨🚨🚨 INITIALIZE CALLED - this.config.chainId:', this.config?.chainId);
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
        // WalletConnect is now handled directly via Reown AppKit, no adapter needed
        
        const web3AuthNetworkSetting = this.config.web3AuthNetwork === 'sapphire_mainnet' 
          ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
          : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
        
        // Ensure chainId is properly formatted as hex for Web3Auth/WalletConnect
        // Handle both decimal and hex input formats to avoid double-prefixing
        let hexChainId: string;
        if (typeof this.config.chainId === 'string' && this.config.chainId.startsWith('0x')) {
          // Already in hex format, use as-is
          hexChainId = this.config.chainId;
        } else {
          // Convert decimal to hex
          const decimalChainId = typeof this.config.chainId === 'string' 
            ? parseInt(this.config.chainId, 10) 
            : this.config.chainId;
          hexChainId = '0x' + decimalChainId.toString(16);
        }
        
        // Create a completely clean RPC URL to bypass any issues
        const sanitizedRpcUrl = this.config.rpcUrl
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .trim()
          .replace(/\s+/g, ''); // Remove any internal whitespace
        
        this.chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: hexChainId,
          rpcTarget: sanitizedRpcUrl,
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
        
        console.log('🔧 DEBUG: Chain config details:', {
          chainId: this.chainConfig.chainId,
          rpcTarget: this.chainConfig.rpcTarget,
          rpcTargetType: typeof this.chainConfig.rpcTarget,
          configRpcUrl: this.config.rpcUrl,
          configRpcUrlType: typeof this.config.rpcUrl,
          rpcTargetIsValidUrl: this.chainConfig.rpcTarget ? (() => {
            try {
              new URL(this.chainConfig.rpcTarget);
              return 'valid';
            } catch {
              return 'invalid';
            }
          })() : 'null'
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
        
        // Import and create WalletConnect's own modal
        const { WalletConnectModal } = await import('@walletconnect/modal');
        
        console.log('🔧 DEBUG: About to create WalletConnect Modal with chainId:', {
          configChainId: this.config.chainId,
          typeOfChainId: typeof this.config.chainId,
          eip155Format: `eip155:${this.config.chainId}`,
          shouldBeDecimal8453: 'eip155:8453',
          currentlyGetting: `eip155:${this.config.chainId}`
        });
        
        // Ensure chainId is decimal format for CAIP-2 compliance
        const decimalChainId = typeof this.config.chainId === 'string' ? 
          parseInt(this.config.chainId, 10) : this.config.chainId;
        
        console.log('🔧 DEBUG: WalletConnect Modal chainId conversion:', {
          original: this.config.chainId,
          decimal: decimalChainId,
          caip2Format: `eip155:${decimalChainId}`
        });
        
        const walletConnectModal = new WalletConnectModal({
          projectId: walletConnectProjectId,
          chains: [`eip155:${decimalChainId}`],
          themeMode: 'light',
          themeVariables: {
            '--wcm-z-index': '99999',
          }
        });
        
        console.log('🔧 DEBUG: WalletConnect complete configuration:', {
          chainConfig: this.chainConfig,
          modalChains: [`eip155:${decimalChainId}`],
          adapterChains: [decimalChainId],
          originalConfigChainId: this.config.chainId,
          decimalChainId: decimalChainId,
          typeOfDecimal: typeof decimalChainId,
          expectedCAIP2: 'eip155:8453',
          actualCAIP2: `eip155:${decimalChainId}`,
          originalRpcUrl: this.config.rpcUrl,
          sanitizedRpcUrl: sanitizedRpcUrl,
          rpcUrlsMatch: this.config.rpcUrl === sanitizedRpcUrl
        });
        
        // WalletConnect V2 is now handled directly via Reown AppKit
        // No Web3Auth adapter configuration needed

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
        
        // WalletConnect V2 adapter removed - using direct Reown AppKit integration

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
        
        // Check if already connected, but only if we haven't recently disconnected
        if (this.web3auth.connected) {
          console.log('🔧 Web3Auth No-Modal: Web3Auth reports connected status');
          console.log('🔧 Web3Auth No-Modal: Checking if this is a valid session...');
          
          try {
            // Try to get user info to verify the connection is valid
            const userInfo = await this.web3auth.getUserInfo();
            console.log('🔧 Web3Auth No-Modal: User info check:', userInfo);
            
            // Only proceed if we have a provider and valid user info
            if (this.web3auth.provider && (userInfo.email || userInfo.name || userInfo.verifierId)) {
              console.log('🔧 Web3Auth No-Modal: Valid session found, auto-connecting...');
              await this.handleConnected();
            } else {
              console.log('🔧 Web3Auth No-Modal: Invalid session detected, clearing...');
              // Clear invalid session
              try {
                await this.web3auth.logout();
              } catch (e) {
                console.warn('Error clearing invalid session:', e);
              }
            }
          } catch (error) {
            console.log('🔧 Web3Auth No-Modal: Session verification failed, clearing session:', error);
            // If we can't get user info, the session is invalid
            try {
              await this.web3auth.logout();
            } catch (e) {
              console.warn('Error clearing invalid session:', e);
            }
          }
        } else {
          console.log('🔧 Web3Auth No-Modal: No existing connection found');
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
    
    // Clear any existing WalletConnect sessions to avoid chain mismatch
    if (adapter === 'walletconnect') {
      console.log('🔧 Web3Auth No-Modal: Clearing WalletConnect localStorage to avoid chain conflicts...');
      // Clear WalletConnect v2 storage
      const wcKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('wc@2') || 
        key.startsWith('walletconnect') ||
        key.includes('WalletConnect')
      );
      wcKeys.forEach(key => {
        console.log(`🔧 Removing WalletConnect key: ${key}`);
        localStorage.removeItem(key);
      });
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
        // Use direct Reown AppKit WalletConnect integration
        console.log('🔧 Web3Auth No-Modal: Connecting to WalletConnect via Reown AppKit');
        return await this.handleReownWalletConnectConnection();
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
      
      console.log('🔧 Web3Auth No-Modal: Starting disconnect process...');
      console.log('🔧 Web3Auth No-Modal: Web3Auth status before logout:', this.web3auth.status);
      console.log('🔧 Web3Auth No-Modal: Web3Auth connected before logout:', this.web3auth.connected);
      
      // Logout from Web3Auth
      await this.web3auth.logout();
      
      console.log('🔧 Web3Auth No-Modal: Web3Auth status after logout:', this.web3auth.status);
      console.log('🔧 Web3Auth No-Modal: Web3Auth connected after logout:', this.web3auth.connected);
      
      // Clear all local state
      this.provider = null;
      this.cachedEthersProvider = null;
      this.state.user = null;
      this.state.token = null;
      this.state.isConnected = false;
      
      // Clear session storage
      localStorage.removeItem(this.visitedKey);
      
      // Clear any Web3Auth related storage that might persist
      // These are common Web3Auth storage keys that might persist session state
      const keysToRemove = [
        'Web3Auth-cachedAdapter',
        'openlogin_store',
        'Web3Auth-wallet-connect',
        'walletconnect',
        'wc@2:client:0.3',
        'wc@2:core:0.3'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          // Ignore errors when clearing storage
        }
      });
      
      // Clear any Web3Auth storage with wildcard patterns
      if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('web3auth') || 
                key.includes('openlogin') || 
                key.includes('walletconnect') ||
                key.includes('wc@2:')) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(sessionStorage).forEach(key => {
            if (key.includes('web3auth') || 
                key.includes('openlogin') || 
                key.includes('walletconnect') ||
                key.includes('wc@2:')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {
          console.warn('Error clearing Web3Auth storage:', e);
        }
      }
      
      console.log('🔧 Web3Auth No-Modal: Disconnect completed successfully');
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
      console.log('🔧 DEBUG: Creating ethers BrowserProvider from Web3Auth provider');
      
      // Debug: Check what the raw provider returns for chainId
      if (this.provider.request) {
        this.provider.request({ method: 'eth_chainId' })
          .then((rawChainId: any) => {
            console.log('🔧 DEBUG: Raw provider eth_chainId response:', {
              rawChainId,
              typeOfRawChainId: typeof rawChainId,
              isHex: typeof rawChainId === 'string' && rawChainId.startsWith('0x'),
              hasDoublePrefix: typeof rawChainId === 'string' && rawChainId.startsWith('0x0x')
            });
          })
          .catch((err: any) => {
            console.log('🔧 DEBUG: Could not get eth_chainId from raw provider:', err);
          });
      }
      
      const { ethers } = require('ethers');
      
      // Create a custom provider that completely bypasses WalletConnect's RPC handling for problematic methods
      const originalProvider = this.provider;
      const wrappedProvider = {
        ...originalProvider,
        request: async (args: any) => {
          console.log('🔧 DEBUG: Provider request:', args.method, 'with params:', args.params);
          
          // For READ-ONLY RPC methods that are failing, make direct RPC calls to bypass WalletConnect
          // NEVER bypass wallet-specific methods that require private keys!
          const readOnlyMethods = [
            'eth_blockNumber', 
            'eth_getBalance', 
            'eth_call', 
            'eth_estimateGas',
            'eth_getBlockByNumber',
            'eth_gasPrice',
            'eth_maxPriorityFeePerGas',
            'eth_getTransactionReceipt',
            'eth_getTransactionCount',
            'eth_getCode',
            'eth_getLogs'
          ];
          
          if (readOnlyMethods.includes(args.method)) {
            console.log('🔧 DEBUG: Bypassing WalletConnect for method:', args.method);
            try {
              const response = await fetch(this.chainConfig.rpcTarget, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: Date.now(),
                  method: args.method,
                  params: args.params || []
                })
              });
              const result = await response.json();
              if (result.error) throw new Error(result.error.message);
              return result.result;
            } catch (directRpcError) {
              console.error('🔧 DEBUG: Direct RPC call failed:', directRpcError);
              // Fall back to original provider
            }
          }
          
          // Special handling for eth_sendTransaction to fix chainId parameter
          if (args.method === 'eth_sendTransaction' && args.params && args.params[0]) {
            const txParams = args.params[0];
            console.log('🔧 DEBUG: Original transaction params:', txParams);
            
            // Get the correct chainId from the provider
            let correctChainId;
            try {
              correctChainId = await originalProvider.request({ method: 'eth_chainId', params: [] });
              console.log('🔧 DEBUG: Got chainId from provider:', correctChainId);
              
              // Fix double-prefixed chainId if detected
              if (typeof correctChainId === 'string' && correctChainId.startsWith('0x0x')) {
                correctChainId = correctChainId.slice(2);
                console.log('🔧 DEBUG: Fixed double-prefixed chainId:', correctChainId);
              }
            } catch (chainIdError) {
              console.error('🔧 DEBUG: Failed to get chainId:', chainIdError);
              // Use the configured chainId as fallback
              correctChainId = '0x' + parseInt(this.config.chainId.toString()).toString(16);
              console.log('🔧 DEBUG: Using fallback chainId:', correctChainId);
            }
            
            // Convert hex chainId to decimal for CAIP-2 format (eip155:chainId)
            const decimalChainId = parseInt(correctChainId, 16);
            console.log('🔧 DEBUG: Converting chainId for WalletConnect - hex:', correctChainId, 'decimal:', decimalChainId);
            
            // WalletConnect v2 expects chainId at request level, NOT in transaction params
            // Remove any existing chainId from transaction params
            const {chainId: _, ...cleanTxParams} = txParams;
            
            console.log('🔧 DEBUG: Clean transaction params (no chainId):', cleanTxParams);
            
            // Set chainId at the request level in CAIP-2 format (eip155:chainId)
            const fixedArgs = {
              ...args,
              params: [cleanTxParams], // Transaction params without chainId
              chainId: `eip155:${decimalChainId}` // ChainId at request level
            };
            
            console.log('🔧 DEBUG: Final request args being sent to WalletConnect:', fixedArgs);
            
            try {
              const result = await originalProvider.request(fixedArgs);
              console.log('🔧 DEBUG: Transaction successful with fixed chainId:', result);
              return result;
            } catch (error) {
              console.error('🔧 DEBUG: Transaction failed even with fixed chainId:', error);
              throw error;
            }
          }
          
          try {
            const result = await originalProvider.request(args);
            
            // Fix chainId responses to ensure ethers gets the correct value
            if (args.method === 'eth_chainId') {
              let fixedChainId = result;
              
              // Fix double-prefixed chainId if detected
              if (typeof result === 'string' && result.startsWith('0x0x')) {
                fixedChainId = result.slice(2); // Remove the extra "0x"
                console.log('🔧 DEBUG: Fixed double-prefixed chainId:', result, '->', fixedChainId);
              }
              
              // Ensure chainId is proper hex format for ethers
              if (typeof fixedChainId === 'string' && !fixedChainId.startsWith('0x')) {
                fixedChainId = '0x' + fixedChainId;
              }
              
              // Convert to decimal for ethers (ethers expects number, not hex string for chainId)
              const decimalChainId = parseInt(fixedChainId, 16);
              console.log('🔧 DEBUG: Converting chainId for ethers - hex:', fixedChainId, 'decimal:', decimalChainId);
              
              // Return decimal chainId that ethers expects
              return decimalChainId;
            }
            
            return result;
          } catch (error) {
            console.error('🔧 DEBUG: Provider request failed for', args.method, ':', error);
            
            // Try to extract more details about URL construction errors
            if (error instanceof Error && error.message.includes('Failed to construct \'URL\'')) {
              console.error('🔧 DEBUG: URL construction error details:', {
                method: args.method,
                params: args.params,
                errorMessage: error.message,
                chainConfig: this.chainConfig,
                configRpcUrl: this.config?.rpcUrl
              });
            }
            
            throw error;
          }
        }
      };
      
      this.cachedEthersProvider = new ethers.BrowserProvider(wrappedProvider);
      
      // Try to get network info to debug
      this.cachedEthersProvider.getNetwork().then((network: any) => {
        console.log('🔧 DEBUG: Ethers provider network after wrapping:', {
          chainId: network.chainId,
          name: network.name,
          ensAddress: network.ensAddress
        });
      }).catch((error: any) => {
        console.error('🔧 DEBUG: Failed to get network from ethers provider:', error);
      });
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
      // where Web3Auth doesn't provide idTokens. In this case, generate a signature token
      if (!idToken) {
        console.log('🔧 Web3Auth No-Modal: No idToken available, generating signature-based authentication token...');
        try {
          idToken = await this.generateSignatureToken(address);
          console.log('🔧 Web3Auth No-Modal: ✅ Signature token generated successfully');
        } catch (error) {
          console.error('🔧 Web3Auth No-Modal: ❌ Failed to generate signature token:', error);
          throw error;
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

  getWeb3Service(): any {
    return this.web3Service;
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
          
          console.log('🔧 DEBUG: signMessage - personal_sign does not use chainId parameter');
          
          return await this.provider.request({ 
            method: 'personal_sign', 
            params: [message, address]
          });
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

  private async handleReownWalletConnectConnection(): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    try {
      console.log('🔧 Web3Auth No-Modal: Connecting via Reown AppKit WalletConnect...');
      
      // Create Reown WalletConnect provider
      const reownProvider = new ReownWalletConnectProvider(this.config);
      
      // Connect to WalletConnect
      const connectionResult = await reownProvider.connect();
      
      if (!connectionResult.success) {
        throw new Error(connectionResult.error || 'Failed to connect to WalletConnect');
      }
      
      // Get the EIP-1193 provider
      const eip1193Provider = reownProvider.createEIP1193Provider();
      this.provider = eip1193Provider;
      
      // Get wallet address
      const walletAddress = reownProvider.getAddress();
      if (!walletAddress) {
        throw new Error('No wallet address available after connection');
      }
      
      console.log('🔧 Web3Auth No-Modal: ✅ Reown WalletConnect connected:', walletAddress);
      
      // Generate signature-based auth token
      let authToken: string;
      try {
        authToken = await reownProvider.generateSignatureAuthToken();
        console.log('🔧 Web3Auth No-Modal: ✅ Reown auth token generated successfully');
      } catch (error) {
        console.error('🔧 Web3Auth No-Modal: ❌ Failed to generate Reown auth token:', error);
        throw error;
      }
      
      // Initialize Web3Service with the EIP-1193 provider
      await this.initializeWeb3Service();
      
      return {
        success: true,
        user: {
          walletAddress,
          provider: 'reown_walletconnect'
        },
        token: authToken
      };
      
    } catch (error) {
      console.error('🔧 Web3Auth No-Modal: ❌ Reown WalletConnect connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Reown WalletConnect error'
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
      
      // Get wallet address
      const { ethers } = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const walletAddress = await signer.getAddress();
      
      // Get the idToken from Web3Auth for WalletConnect
      let idToken: string;
      try {
        const userInfo = await this.web3auth.getUserInfo();
        idToken = userInfo.idToken;
        
        if (!idToken) {
          // Try alternative method for getting token
          if (this.web3auth.getIdentityToken) {
            const authUser = await this.web3auth.getIdentityToken();
            idToken = authUser?.idToken;
          }
          
          // Generate signature token if no idToken available
          if (!idToken) {
            console.log('🔧 Web3Auth No-Modal: No idToken from WalletConnect, generating signature token...');
            try {
              idToken = await this.generateSignatureToken(walletAddress);
              console.log('🔧 Web3Auth No-Modal: ✅ WalletConnect signature token generated successfully');
            } catch (error) {
              console.error('🔧 Web3Auth No-Modal: ❌ Failed to generate WalletConnect signature token:', error);
              throw error;
            }
          }
        }
      } catch (error) {
        console.error('🔧 Web3Auth No-Modal: External wallet connection error:', error);
        // Try signature authentication as fallback
        try {
          const accounts = await this.provider.request({ method: 'eth_accounts', params: [] });
          if (accounts && accounts.length > 0) {
            console.log('🔧 Web3Auth No-Modal: Attempting signature authentication fallback...');
            idToken = await this.generateSignatureToken(accounts[0]);
            console.log('🔧 Web3Auth No-Modal: ✅ Fallback signature token generated');
          } else {
            throw new Error('No wallet accounts available for signature authentication');
          }
        } catch (signatureError) {
          console.error('🔧 Web3Auth No-Modal: ❌ Signature authentication fallback failed:', signatureError);
          throw signatureError;
        }
      }
      
      // Create basic user object - AuthProvider will handle backend auth and merging
      this.state.user = {
        userId: walletAddress, // Use wallet address as initial userId
        email: '', // Will be filled by backend auth
        walletAddress,
        authProvider: 'walletconnect'
      };
      this.state.token = idToken;
      this.state.isConnected = true;
      
      // Initialize Web3 service
      await this.initializeWeb3Service();
      
      // Clear any cached provider since we have a new connection
      this.cachedEthersProvider = null;
      
      console.log('🔧 Web3Auth No-Modal: WalletConnect connected successfully');
      console.log('🔧 Web3Auth No-Modal: Provider user data (before backend auth):', {
        userId: this.state.user?.userId,
        walletAddress: this.state.user?.walletAddress,
        authProvider: this.state.user?.authProvider
      });
      
      return {
        success: true,
        user: this.state.user,
        token: this.state.token
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