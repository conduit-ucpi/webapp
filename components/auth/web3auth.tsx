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
 * Web3Auth Provider implementation
 */
class Web3AuthProviderImpl implements IAuthProvider {
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

  constructor(config?: any) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;
    
    try {
      this.state.isLoading = true;
      console.log('🔧 Web3Auth: Starting initialization...');
      
      // Import Web3Auth dynamically
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
        if (!this.config) {
          throw new Error('Config not provided to Web3Auth provider');
        }

        console.log('🔧 Web3Auth: Config received:', {
          web3AuthClientId: this.config.web3AuthClientId ? 'Present' : 'Missing',
          web3AuthNetwork: this.config.web3AuthNetwork,
          chainId: this.config.chainId,
          rpcUrl: this.config.rpcUrl ? 'Present' : 'Missing',
        });

        const { Web3Auth } = await import('@web3auth/modal');
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import('@web3auth/base');
        
        const web3AuthNetworkSetting = this.config.web3AuthNetwork === 'sapphire_mainnet' 
          ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET 
          : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
        
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: `0x${this.config.chainId.toString(16)}`,
          rpcTarget: this.config.rpcUrl,
          displayName: this.getChainDisplayName(),
          blockExplorerUrl: this.config.explorerBaseUrl,
          ticker: this.getChainTicker(),
          tickerName: this.getChainTickerName(),
        };

        console.log('🔧 Web3Auth: Creating Web3Auth instance with:', {
          clientId: this.config.web3AuthClientId?.substring(0, 20) + '...',
          web3AuthNetwork: web3AuthNetworkSetting,
          chainConfig
        });

        // Note: Removing MetaMask disabling logic as it's causing connection issues
        // Web3Auth Modal can handle MetaMask coexistence properly without manual intervention

        this.web3auth = new Web3Auth({
          clientId: this.config.web3AuthClientId,
          web3AuthNetwork: web3AuthNetworkSetting,
          uiConfig: {
            appName: "Conduit UCPI",
            theme: {
              primary: "#0364ff",
            },
            mode: "auto",
            logoLight: "https://web3auth.io/images/web3authlog.png",
            logoDark: "https://web3auth.io/images/web3authlogodark.png",
            defaultLanguage: "en",
            loginGridCol: 3,
            primaryButton: "externalLogin",
          },
        });
        
        console.log('🔧 Web3Auth: Calling init()...');
        try {
          // Add timeout to prevent hanging
          const initPromise = this.web3auth.init();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Web3Auth initialization timeout after 10 seconds')), 10000);
          });
          
          await Promise.race([initPromise, timeoutPromise]);
          console.log('🔧 Web3Auth: Modal initialized successfully');
          
          // Check if already connected
          if (this.web3auth.connected) {
            console.log('🔧 Web3Auth: Already connected, updating user data');
            this.provider = this.web3auth.provider;
            await this.initializeWeb3Service();
            await this.updateUserFromProvider();
          }
        } catch (initError) {
          console.error('🔧 Web3Auth: Modal initialization failed:', initError);
          console.error('🔧 Web3Auth: This might be due to invalid clientId, network issues, or unsupported chain');
          
          // Store the error but continue - Web3Auth might still work
          this.state.error = `Web3Auth initialization warning: ${(initError as any).message}`;
          
          // Don't re-throw - let the app continue and try to use Web3Auth anyway
          console.warn('🔧 Web3Auth: Continuing despite initialization error');
        }
        
        // Mark as initialized even if there was an error - we have a web3auth instance
        this.state.isInitialized = true;
      } else {
        // Mark as initialized even if we're in test environment or server-side
        this.state.isInitialized = true;
      }
      
      console.log('🔧 Web3Auth: Initialization completed, isInitialized:', this.state.isInitialized);
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Initialization failed';
      this.emit({ type: 'error', error: this.state.error });
    } finally {
      this.state.isLoading = false;
    }
  }
  
  private getChainDisplayName(): string {
    const chainMappings: Record<number, string> = {
      1: 'Ethereum Mainnet',
      11155111: 'Sepolia Testnet',
      43114: 'Avalanche C-Chain',
      43113: 'Avalanche Fuji Testnet',
      137: 'Polygon Mainnet',
      80001: 'Mumbai Testnet',
      8453: 'Base Mainnet',
      84532: 'Base Sepolia',
    };
    return chainMappings[this.config.chainId] || `Network ${this.config.chainId}`;
  }

  private getChainTicker(): string {
    const tickerMappings: Record<number, string> = {
      1: 'ETH',
      11155111: 'ETH',
      43114: 'AVAX',
      43113: 'AVAX',
      137: 'MATIC',
      80001: 'MATIC',
      8453: 'ETH',
      84532: 'ETH',
    };
    return tickerMappings[this.config.chainId] || 'ETH';
  }

  private getChainTickerName(): string {
    const tickerNameMappings: Record<number, string> = {
      1: 'Ethereum',
      11155111: 'Sepolia ETH',
      43114: 'Avalanche',
      43113: 'Avalanche',
      137: 'Polygon',
      80001: 'Mumbai MATIC',
      8453: 'Base ETH',
      84532: 'Base Sepolia ETH',
    };
    return tickerNameMappings[this.config.chainId] || 'Native Token';
  }

  async connect(): Promise<AuthResult> {
    try {
      this.state.isLoading = true;
      
      console.log('🔧 Web3Auth: Connect called, checking initialization...');
      
      // If not initialized, try to initialize now
      if (!this.state.isInitialized) {
        console.log('🔧 Web3Auth: Not initialized yet, attempting initialization...');
        await this.initialize();
      }
      
      // Check if we have a web3auth instance
      if (!this.web3auth) {
        throw new Error('Web3Auth service is not available. Please refresh the page and try again.');
      }
      
      // Clear any previous errors and emit connecting event
      this.state.error = null;
      this.emit({ type: 'connecting' });
      console.log('🔧 Web3Auth: Web3Auth instance ready, attempting connection...');
      
      // Connect if not already connected
      if (!this.web3auth.connected) {
        console.log('🔧 Web3Auth: Calling web3auth.connect()...');
        this.provider = await this.web3auth.connect();
        console.log('🔧 Web3Auth: Connect returned:', !!this.provider);
      } else {
        console.log('🔧 Web3Auth: Already connected, using existing provider');
        this.provider = this.web3auth.provider;
      }
      
      // Initialize Web3Service for fundAndSendTransaction functionality
      await this.initializeWeb3Service();
      
      console.log('🔧 Web3Auth: Final provider check:', {
        provider: !!this.provider,
        web3authConnected: this.web3auth.connected,
        web3authProvider: !!this.web3auth.provider
      });
      
      if (!this.provider) {
        throw new Error('No provider after connection');
      }
      
      await this.updateUserFromProvider();
      
      // For external wallets like MetaMask, we may not have a token but should have user data
      if (!this.state.user) {
        throw new Error('Failed to get user data');
      }
      
      console.log('🔧 Web3Auth: Connection successful', {
        hasUser: !!this.state.user,
        hasToken: !!this.state.token,
        userId: this.state.user?.userId,
        walletAddress: this.state.user?.walletAddress
      });
      
      this.state.isConnected = true;
      this.emit({ type: 'connected', user: this.state.user, token: this.state.token || '' });
      
      return { user: this.state.user, token: this.state.token || '' };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      console.error('🔧 Web3Auth: Connection error:', errorMessage);
      
      // Check if this was a user cancellation
      if (errorMessage.includes('User closed') || 
          errorMessage.includes('cancelled') || 
          errorMessage.includes('User cancelled') ||
          errorMessage.includes('popup_closed')) {
        console.log('🔧 Web3Auth: User cancelled login');
        this.state.error = 'Login cancelled by user';
      } else {
        this.state.error = errorMessage;
      }
      
      this.emit({ type: 'error', error: this.state.error });
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      if (this.web3auth && this.web3auth.connected) {
        await this.web3auth.logout();
      }
      
      // Clear state
      this.state.user = null;
      this.state.token = null;
      this.state.isConnected = false;
      this.provider = null;
      
      this.emit({ type: 'disconnected' });
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Disconnect failed';
      throw error;
    }
  }
  
  private async updateUserFromProvider(): Promise<void> {
    if (!this.web3auth || !this.provider) {
      console.log('🔧 Web3Auth: Missing web3auth or provider in updateUserFromProvider');
      return;
    }
    
    try {
      console.log('🔧 Web3Auth: Getting user info...');
      // Get user info
      const userInfo = await this.web3auth.getUserInfo();
      console.log('🔧 Web3Auth: User info received:', {
        verifierId: userInfo?.verifierId,
        email: userInfo?.email,
        name: userInfo?.name,
        hasIdToken: !!userInfo?.idToken
      });
      
      console.log('🔧 Web3Auth: Getting wallet address...');
      // Get wallet address
      const ethers = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const walletAddress = await signer.getAddress();
      console.log('🔧 Web3Auth: Wallet address obtained:', walletAddress);
      
      // Get ID token if available
      const idToken = userInfo?.idToken || '';
      
      // Create user object
      const user: AuthUser = {
        userId: userInfo?.verifierId || `web3auth_${Date.now()}`,
        walletAddress,
        email: userInfo?.email,
        web3authUserId: userInfo?.verifierId,
        displayName: userInfo?.name,
        profileImageUrl: userInfo?.profileImage,
        authProvider: 'web3auth'
      };
      
      console.log('🔧 Web3Auth: Setting user state:', { userId: user.userId, walletAddress: user.walletAddress });
      this.state.user = user;
      this.state.token = idToken;
      
    } catch (error) {
      console.error('🔧 Web3Auth: Failed to update user from provider:', error);
      console.error('🔧 Web3Auth: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      throw error;
    }
  }
  
  getState(): AuthState {
    return { ...this.state };
  }
  
  isReady(): boolean {
    return this.state.isInitialized && !this.state.isLoading;
  }
  
  dispose(): void {
    this.listeners.clear();
    this.web3auth = null;
    this.provider = null;
  }
  
  // Event handling
  on(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
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
  
  // Helper methods for AuthContextType
  getToken(): string | null {
    return this.state.token;
  }
  
  hasVisitedBefore(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.visitedKey) === 'true';
    }
    return false;
  }
  
  markAsVisited(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.visitedKey, 'true');
    }
  }
  
  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    
    try {
      const ethers = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getEthersProvider(): any {
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    
    // Create and cache ethers provider synchronously
    if (!this.cachedEthersProvider) {
      // Import ethers synchronously (it should be available since we used it before)
      const ethers = require('ethers');
      this.cachedEthersProvider = new ethers.BrowserProvider(this.provider);
    }
    
    return this.cachedEthersProvider;
  }
  
  async signContractTransaction(params: {
    contractAddress: string;
    abi: any[];
    functionName: string;
    functionArgs: any[];
    debugLabel?: string;
  }): Promise<string> {
    console.log(`🔧 Web3Auth: Signing ${params.debugLabel || 'contract'} transaction`);
    
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    
    const ethersProvider = this.getEthersProvider();
    const signer = await ethersProvider.getSigner();
    
    // Create contract instance
    const { Contract } = require('ethers');
    const contract = new Contract(params.contractAddress, params.abi, signer);
    
    // Build the transaction
    const txRequest = await contract[params.functionName].populateTransaction(...params.functionArgs);
    
    // Sign the transaction
    const signedTx = await signer.signTransaction(txRequest);
    console.log(`🔧 Web3Auth: ${params.debugLabel || 'Contract'} transaction signed`);
    
    return signedTx;
  }
  
  async waitForTransaction(transactionHash: string, maxWaitTime: number = 30000): Promise<void> {
    console.log(`🔧 Web3Auth: Waiting for transaction confirmation: ${transactionHash}`);
    
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    
    const ethersProvider = this.getEthersProvider();
    
    try {
      // Wait for the transaction to be mined with a timeout
      const receipt = await Promise.race([
        ethersProvider.waitForTransaction(transactionHash, 1), // Wait for 1 confirmation
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), maxWaitTime)
        )
      ]);
      
      if (receipt?.status === 1) {
        console.log(`🔧 Web3Auth: Transaction confirmed: ${transactionHash}`);
      } else {
        throw new Error(`Transaction failed: ${transactionHash}`);
      }
    } catch (error) {
      console.warn(`🔧 Web3Auth: Transaction confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw - let the transaction continue as the backend may have processed it
    }
  }
  
  async getUSDCBalance(userAddress?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    
    if (!this.config?.usdcContractAddress) {
      console.warn('USDC contract address not configured');
      return '0';
    }
    
    const ethersProvider = this.getEthersProvider();
    const signer = await ethersProvider.getSigner();
    const address = userAddress || await signer.getAddress();
    
    // Create contract instance
    const { Contract } = require('ethers');
    const usdcContract = new Contract(this.config.usdcContractAddress, ERC20_ABI, ethersProvider);
    
    // Get balance
    const balance = await usdcContract.balanceOf(address);
    
    // Convert from smallest unit (6 decimals for USDC) to string
    return formatUnits(balance, 6);
  }

  /**
   * Initialize Web3Service for fundAndSendTransaction functionality
   */
  private async initializeWeb3Service(): Promise<void> {
    if (!this.provider || !this.config) {
      console.warn('🔧 Web3Auth: Cannot initialize Web3Service - provider or config missing');
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
          return 'web3auth';
        },
        getEthersProvider: () => this.getEthersProvider()
      };
      
      await this.web3Service.initializeProvider(walletProvider);
      console.log('🔧 Web3Auth: Web3Service initialized successfully');
    } catch (error) {
      console.error('🔧 Web3Auth: Failed to initialize Web3Service:', error);
    }
  }

  /**
   * Fund and send transaction using Web3Service
   */
  async fundAndSendTransaction(txParams: { to: string; data: string; value?: string; gasLimit?: bigint; gasPrice?: bigint; }): Promise<string> {
    if (!this.web3Service) {
      throw new Error('Web3Service not initialized - call initializeWeb3Service first');
    }
    
    return await this.web3Service.fundAndSendTransaction(txParams);
  }

  /**
   * Get contract methods helper
   */
  private getContractMethods(authenticatedFetch?: any) {
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    return createWeb3AuthContractMethods(
      async (txParams: any) => {
        return await this.signContractTransaction(txParams);
      },
      authenticatedFetch || (async (url: string, options?: RequestInit) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options?.headers,
          }
        });
      }),
      async (txParams: any) => {
        return await this.fundAndSendTransaction(txParams);
      }
    );
  }

  /**
   * Fund contract - complete flow: create, approve, deposit
   */
  async fundContract(params: any, authenticatedFetch?: any): Promise<any> {
    console.log('🔧 Web3AuthProvider: fundContract called');
    
    if (!this.provider) {
      throw new Error('Provider not available');
    }

    // Create the contract transaction methods
    const { createWeb3AuthContractMethods } = await import('@/utils/contractTransactionFactory');
    
    const contractMethods = createWeb3AuthContractMethods(
      async (txParams: any) => {
        return await this.signContractTransaction(txParams);
      },
      authenticatedFetch || (async (url: string, options?: RequestInit) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options?.headers,
          }
        });
      }),
      async (txParams: any) => {
        return await this.fundAndSendTransaction(txParams);
      }
    );

    return await contractMethods.fundContract(params);
  }

  async raiseDispute(params: {
    contractAddress: string;
    userAddress: string;
    reason: string;
    refundPercent: number;
    contract?: { id: string; };
  }): Promise<any> {
    console.log('🔧 Web3AuthProvider: raiseDispute called, delegating to contract methods');
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    const contractMethods = this.getContractMethods();
    return await contractMethods.raiseDispute(params);
  }

  async claimFunds(contractAddress: string, userAddress: string): Promise<any> {
    console.log('🔧 Web3AuthProvider: claimFunds called, delegating to contract methods');
    if (!this.provider) {
      throw new Error('Provider not available');
    }
    const contractMethods = this.getContractMethods();
    return await contractMethods.claimFunds(contractAddress, userAddress);
  }
}

// Create singleton instance
let web3authProvider: Web3AuthProviderImpl | null = null;

export function getWeb3AuthProvider(config?: any): IAuthProvider {
  if (!web3authProvider) {
    console.log('🔧 Web3Auth: Creating new provider instance');
    web3authProvider = new Web3AuthProviderImpl(config);
  } else {
    console.log('🔧 Web3Auth: Reusing existing provider instance');
    // Update config if it's changed
    if (config && !web3authProvider['config']) {
      (web3authProvider as any).config = config;
    }
  }
  return web3authProvider;
}

/**
 * React Context for Web3Auth
 */
const Web3AuthContext = createContext<AuthContextType | null>(null);

/**
 * Web3Auth Provider React Component
 */
export function Web3AuthProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'web3auth'
  });
  
  const [provider, setProvider] = useState<IAuthProvider | null>(null);
  
  // Create provider when config is available
  useEffect(() => {
    if (config) {
      const authProvider = getWeb3AuthProvider(config);
      setProvider(authProvider);
    }
  }, [config]);
  
  // Initialize provider when it's created
  useEffect(() => {
    if (!provider) return;
    
    const init = async () => {
      await provider.initialize();
      setAuthState(provider.getState());
    };
    
    init();
    
    // Subscribe to events
    const handleEvent = (event: AuthEvent) => {
      setAuthState(provider.getState());
    };
    
    provider.on?.('connecting', handleEvent);
    provider.on?.('connected', handleEvent);
    provider.on?.('disconnected', handleEvent);
    provider.on?.('error', handleEvent);
    
    return () => {
      provider.off?.('connecting', handleEvent);
      provider.off?.('connected', handleEvent);
      provider.off?.('disconnected', handleEvent);
      provider.off?.('error', handleEvent);
    };
  }, [provider]);
  
  // Create contract transaction methods for Web3Auth
  const contractMethods = useMemo(() => {
    if (!provider) return {};

    return createWeb3AuthContractMethods(
      async (params: any) => {
        if (!provider) throw new Error('Provider not initialized');
        return await provider.signContractTransaction(params);
      },
      async (url: string, options?: RequestInit) => {
        // Web3Auth authenticated fetch - add any Web3Auth-specific headers
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options?.headers,
          }
        });
      },
      async (txParams: any) => {
        if (!provider) throw new Error('Provider not initialized');
        if (!provider.fundAndSendTransaction) throw new Error('fundAndSendTransaction not available on provider');
        return await provider.fundAndSendTransaction(txParams);
      }
    );
  }, [provider]);

  const contextValue: AuthContextType = {
    // State
    ...authState,
    
    // Methods
    connect: async () => {
      if (!provider) throw new Error('Provider not initialized');
      await provider.connect();
      setAuthState(provider.getState());
    },
    
    disconnect: async () => {
      if (!provider) throw new Error('Provider not initialized');
      await provider.disconnect();
      setAuthState(provider.getState());
    },
    
    getToken: () => provider?.getToken?.() || null,
    hasVisitedBefore: () => provider?.hasVisitedBefore?.() || false,
    markAsVisited: () => provider?.markAsVisited?.(),
    
    // Wallet operations
    signMessage: async (message: string) => {
      if (!provider) {
        throw new Error('Provider not initialized');
      }
      return await provider.signMessage(message);
    },
    
    getEthersProvider: () => provider?.getEthersProvider?.() || null,
    
    getUSDCBalance: async (userAddress?: string) => {
      if (!provider) {
        throw new Error('Provider not initialized');
      }
      return await provider.getUSDCBalance(userAddress);
    },
    
    signContractTransaction: async (params: any) => {
      if (!provider) {
        throw new Error('Provider not initialized');
      }
      return await provider.signContractTransaction(params);
    },

    waitForTransaction: async (transactionHash: string, maxWaitTime?: number) => {
      if (!provider) {
        throw new Error('Provider not initialized');
      }
      if (!provider.waitForTransaction) {
        throw new Error('Transaction waiting not supported by this provider');
      }
      return await provider.waitForTransaction(transactionHash, maxWaitTime);
    },

    // High-level contract transaction methods (Web3Auth-specific implementations)
    ...contractMethods,

    // Authenticated fetch
    authenticatedFetch: async (url: string, options?: RequestInit) => {
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options?.headers,
        }
      });
    },
  };
  
  return (
    <Web3AuthContext.Provider value={contextValue}>
      {children}
    </Web3AuthContext.Provider>
  );
}

/**
 * Hook to use Web3Auth context
 */
export function useWeb3Auth(): AuthContextType {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth must be used within Web3AuthProvider');
  }
  return context;
}

/**
 * Component that displays Web3Auth authentication data
 * Useful for debugging and testing
 */
export function Web3AuthDebug() {
  const auth = useWeb3Auth();

  if (auth.isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-center mt-2">Loading Web3Auth...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="p-4 border border-red-300 rounded bg-red-50">
        <p className="text-red-600">Error: {auth.error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded bg-white space-y-2">
      <h3 className="font-bold">Web3Auth Data:</h3>
      <div className="text-sm space-y-1">
        <p><strong>Wallet:</strong> {auth.user?.walletAddress || 'Not connected'}</p>
        <p><strong>Email:</strong> {auth.user?.email || 'N/A'}</p>
        <p><strong>Display Name:</strong> {auth.user?.displayName || 'N/A'}</p>
        <p><strong>Profile Image:</strong> {auth.user?.profileImageUrl ? '✓' : '✗'}</p>
        <p><strong>Auth Token:</strong> {auth.token ? '✓ Available' : '✗ No token'}</p>
        <p><strong>Provider:</strong> {auth.providerName}</p>
      </div>
    </div>
  );
}