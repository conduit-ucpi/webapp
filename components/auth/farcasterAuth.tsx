import React, { useState, useEffect, createContext, useContext } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useSignMessage, useWalletClient } from 'wagmi';
import { WagmiProvider, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  AuthUser, 
  AuthState, 
  AuthResult, 
  IAuthProvider,
  AuthContextType,
  AuthEvent
} from './authInterface';

interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: {
    url: string;
  };
}

interface FarcasterContext {
  user: FarcasterUser;
}

/**
 * Farcaster Auth Provider implementation
 */
class FarcasterAuthProviderImpl implements IAuthProvider {
  private state: AuthState = {
    user: null,
    token: null,
    isConnected: false,
    isLoading: false,
    isInitialized: false,
    error: null,
    providerName: 'farcaster'
  };
  
  private sdk: any = null;
  private listeners = new Map<AuthEvent['type'], Set<(event: AuthEvent) => void>>();
  private visitedKey = 'farcaster_auth_visited';

  async initialize(): Promise<void> {
    console.log('🔧 Farcaster Provider: Initialize called - setting up SDK reference');
    
    // Get SDK from global storage set by React component
    this.sdk = (window as any).__farcasterSDK;
    
    if (this.sdk) {
      console.log('🔧 Farcaster Provider: SDK reference established');
      this.state.isInitialized = true;
    } else {
      console.log('🔧 Farcaster Provider: SDK not yet available, will retry');
    }
    
    this.state.isLoading = false;
  }
  
  async connect(): Promise<AuthResult> {
    // Get wallet address from current state or throw error
    const walletAddress = this.walletAddress;
    if (!walletAddress) {
      throw new Error('Wallet must be connected before calling connect()');
    }
    
    return this.connectWithAddress(walletAddress);
  }
  
  private walletAddress: string | null = null;
  
  setWalletAddress(address: string | null): void {
    this.walletAddress = address;
  }
  
  private async connectWithAddress(walletAddress: string): Promise<AuthResult> {
    try {
      this.state.isLoading = true;
      this.state.error = null;
      this.emit({ type: 'connecting' });
      
      // Re-establish SDK reference in case it wasn't available during initialize
      if (!this.sdk) {
        this.sdk = (window as any).__farcasterSDK;
      }
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }
      
      // Get Farcaster context
      const context = await this.sdk.context;
      if (!context?.user) {
        throw new Error('No Farcaster user context');
      }
      
      // Get auth token from global storage (set by React component during QuickAuth step)
      const token = (window as any).__farcasterToken;
      
      if (!token || !token.includes('.') || token.split('.').length !== 3) {
        throw new Error('Invalid JWT token from Farcaster - token should have been set during QuickAuth step');
      }
      
      // Wallet address is required for connection
      if (!walletAddress) {
        throw new Error('Wallet address required for connection');
      }
      
      // Create user object
      const user: AuthUser = {
        userId: `farcaster_${context.user.fid}`,
        walletAddress,
        fid: context.user.fid,
        username: context.user.username,
        displayName: context.user.displayName,
        profileImageUrl: context.user.pfp?.url,
        authProvider: 'farcaster'
      };
      
      // Update state
      this.state.user = user;
      this.state.token = token;
      this.state.isConnected = true;
      
      console.log('🔧 Farcaster Provider: Connection successful!', {
        fid: user.fid,
        walletAddress: user.walletAddress,
        hasToken: !!token
      });
      
      // Emit success event
      this.emit({ type: 'connected', user, token });
      
      return { user, token };
      
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Connection failed';
      this.emit({ type: 'error', error: this.state.error });
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      // Clear state
      this.state.user = null;
      this.state.token = null;
      this.state.isConnected = false;
      
      this.emit({ type: 'disconnected' });
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Disconnect failed';
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
    this.sdk = null;
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
}

// Create singleton instance
let farcasterAuthProvider: FarcasterAuthProviderImpl | null = null;

export function getFarcasterAuthProvider(config?: any): IAuthProvider {
  if (!farcasterAuthProvider) {
    farcasterAuthProvider = new FarcasterAuthProviderImpl();
  }
  return farcasterAuthProvider;
}

// Wagmi configuration for Farcaster environment
const createFarcasterWagmiConfig = (chainId: number) => {
  const chain = chainId === 8453 ? base : baseSepolia; // 8453 = Base mainnet, 84532 = Base Sepolia testnet
  
  return createConfig({
    chains: [chain],
    connectors: [], // Farcaster will provide its own connectors
    ssr: false,
  });
};

// Singleton instances to prevent multiple providers
let globalQueryClient: QueryClient | null = null;
let globalWagmiConfig: any | null = null;

// Query client for React Query (required by Wagmi) - singleton
function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: false,
        },
      },
    });
  }
  return globalQueryClient;
}

// Wagmi config singleton
function getWagmiConfig(chainId: number) {
  if (!globalWagmiConfig) {
    globalWagmiConfig = createFarcasterWagmiConfig(chainId);
  }
  return globalWagmiConfig;
}

// Singleton flags to prevent duplicate SDK initialization in React Strict Mode
let isSDKInitialized = false;
let isQuickAuthInitialized = false;
let quickAuthPromise: Promise<any> | null = null;

// Track inner component instances
let innerComponentCount = 0;

// Track if main provider has been rendered to prevent duplicates
let mainProviderInstanceCount = 0;

/**
 * React Context for Farcaster Auth
 */
const FarcasterAuthContext = createContext<AuthContextType | null>(null);

/**
 * Inner Farcaster Auth Provider React Component (with Wagmi hooks)
 */
function FarcasterAuthProviderInner({ children, AuthContext }: { 
  children: React.ReactNode;
  AuthContext?: React.Context<any>;
}) {
  // Track this instance
  const innerInstanceId = React.useRef(Math.random().toString(36).substr(2, 9));
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  React.useEffect(() => {
    innerComponentCount++;
    console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: MOUNTED (total inner instances: ${innerComponentCount})`);
    
    return () => {
      innerComponentCount--;
      console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: UNMOUNTED (remaining inner instances: ${innerComponentCount})`);
    };
  }, []);
  
  console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: RENDER #${renderCount.current}`);
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'farcaster'
  });
  
  const provider = getFarcasterAuthProvider();
  const { address, isConnected: walletConnected } = useAccount();
  const { connect: connectWallet, connectors } = useConnect();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  
  // Step 1: Initialize Farcaster SDK (singleton to prevent React Strict Mode duplicates)
  useEffect(() => {
    const initSDK = async () => {
      if (isSDKInitialized || (window as any).__farcasterSDK) {
        return;
      }
      
      console.log(`🔧 Farcaster [${innerInstanceId.current}]: Step 1 - SDK init`);
      isSDKInitialized = true;
      
      try {
        const farcasterModule = await import('@farcaster/miniapp-sdk');
        (window as any).__farcasterSDK = farcasterModule.sdk;
        console.log('🔧 Farcaster: Step 1 ✅');
      } catch (error) {
        console.error('🔧 Farcaster: SDK init failed:', error);
        isSDKInitialized = false;
      }
    };
    
    initSDK();
  }, []);

  // Step 2: QuickAuth - Get JWT token from Farcaster (singleton to prevent duplicates)
  useEffect(() => {
    const quickAuth = async () => {
      const sdk = (window as any).__farcasterSDK;
      if (!sdk) {
        return;
      }
      
      if (isQuickAuthInitialized || (window as any).__farcasterToken) {
        return;
      }
      
      console.log(`🔧 Farcaster [${innerInstanceId.current}]: Step 2 - QuickAuth`);
      isQuickAuthInitialized = true;
      
      try {
        const context = await sdk.context;
        if (context?.user) {
          // Wait longer for full context to load and Farcaster environment to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get JWT token with longer timeout - use singleton promise to prevent multiple calls
          if (!quickAuthPromise) {
            quickAuthPromise = Promise.race([
              sdk.quickAuth.getToken(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('QuickAuth timeout after 15 seconds')), 15000)
              )
            ]);
          }
          
          const authResponse = await quickAuthPromise;
          
          // Handle token response (can be string or object with token property)
          let token: string;
          if (typeof authResponse === 'string') {
            token = authResponse;
          } else if (authResponse && typeof authResponse === 'object' && 'token' in authResponse) {
            token = String((authResponse as any).token);
          } else {
            console.warn('🔧 Farcaster: QuickAuth - Invalid token format received:', authResponse);
            return;
          }
          
          // Validate JWT format
          if (!token || typeof token !== 'string' || !token.includes('.') || token.split('.').length !== 3) {
            console.warn('🔧 Farcaster: Invalid JWT token format');
            return;
          }
          
          (window as any).__farcasterToken = token;
          console.log('🔧 Farcaster: Step 2 ✅ - Token received');
        } else {
          console.log('🔧 Farcaster: Step 2 - No user context');
        }
      } catch (error) {
        console.error('🔧 Farcaster: Step 2 failed:', error);
        // Don't reset on timeout - might still succeed later
        if (!error.message?.includes('timeout')) {
          isQuickAuthInitialized = false;
        }
      }
    };
    
    // Check immediately and then periodically until SDK is available - but stop once successful
    quickAuth();
    
    let interval: NodeJS.Timeout;
    let cleanup: NodeJS.Timeout;
    
    const checkForSDK = () => {
      const sdk = (window as any).__farcasterSDK;
      if (sdk && !isQuickAuthInitialized) {
        quickAuth();
        clearInterval(interval);
        clearTimeout(cleanup);
      }
    };
    
    interval = setInterval(checkForSDK, 100);
    
    // Cleanup after 5 seconds if still not found
    cleanup = setTimeout(() => {
      clearInterval(interval);
      console.log('🔧 Farcaster: Stopped checking for SDK after 5 seconds');
    }, 5000);
    
    return () => {
      if (interval) clearInterval(interval);
      if (cleanup) clearTimeout(cleanup);
    };
  }, []);

  // Step 3: Wagmi wallet connection
  useEffect(() => {
    const connectWagmi = async () => {
      if (!connectors.length) return;
      
      // If we don't have a wallet connected, auto-connect
      if (!walletConnected && connectors.length > 0) {
        const farcasterConnector = connectors.find((c) => 
          c.name?.toLowerCase().includes('farcaster') || 
          c.id?.includes('miniapp')
        );
        
        if (farcasterConnector) {
          console.log(`🔧 Farcaster [${innerInstanceId.current}]: Step 3 - Wallet`);
          try {
            await connectWallet({ connector: farcasterConnector });
            console.log('🔧 Farcaster: Step 3 ✅');
          } catch (error) {
            console.error('🔧 Farcaster: Step 3 failed:', error);
          }
        }
      }
    };
    
    connectWagmi();
  }, [connectors, walletConnected, connectWallet]);

  // Step 4: Initialize provider AFTER wallet is connected
  useEffect(() => {
    if (!address || !walletConnected) {
      return;
    }

    const initProvider = async () => {
      console.log('🔧 Farcaster: Step 4 - Provider init');
      
      // Now initialize the provider with wallet address available
      await provider.initialize();
      setAuthState(provider.getState());
      console.log('🔧 Farcaster: Step 4 ✅');
    };
    
    initProvider();
  }, [address, walletConnected]);

  // Step 5: Final 'connect' step
  useEffect(() => {
    if (!provider.isReady() || !address || authState.isConnected || authState.isLoading) return;
    
    const finalConnect = async () => {
      const farcasterToken = (window as any).__farcasterToken;
      const farcasterSDK = (window as any).__farcasterSDK;
      
      console.log('🔧 Farcaster: Step 5 - Connect');
      
      if (farcasterToken && address && farcasterSDK) {
        try {
          // Set wallet address in provider first
          (provider as any).setWalletAddress(address);
          
          // Now perform the actual connection
          await provider.connect();
          
          // Update local auth state
          setAuthState(provider.getState());
          
          console.log('🔧 Farcaster: Step 5 ✅ - Connected!');
        } catch (error) {
          console.error('🔧 Farcaster: Step 5 failed:', error);
          setAuthState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Connection failed',
            isLoading: false
          }));
        }
      } else {
        console.warn('🔧 Farcaster: Missing prerequisites for final connect:', {
          token: !!farcasterToken,
          address: !!address,
          sdk: !!farcasterSDK
        });
      }
    };
    
    finalConnect();
    
    // Poll for token in case QuickAuth takes longer than expected - but stop once connected
    let pollInterval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    
    const startPolling = () => {
      pollInterval = setInterval(() => {
        const token = (window as any).__farcasterToken;
        if (token && !authState.isConnected) {
          console.log('🔧 Farcaster: Token now available, retrying connect...');
          finalConnect();
          // Stop polling after successful attempt
          clearInterval(pollInterval);
          clearTimeout(timeout);
        }
      }, 2000);
      
      // Stop polling after 30 seconds
      timeout = setTimeout(() => {
        clearInterval(pollInterval);
        console.log('🔧 Farcaster: Stopped polling for token after 30 seconds');
      }, 30000);
    };
    
    // Only start polling if we don't already have a token
    if (!(window as any).__farcasterToken) {
      startPolling();
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeout) clearTimeout(timeout);
    };
  }, [provider, address, authState.isConnected, authState.isLoading]);

  // Update auth state when wagmi wallet connects
  useEffect(() => {
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
  }, [walletConnected, connectWallet, connectors]);
  
  // Update ENS name when available
  useEffect(() => {
    if (ensName && authState.user) {
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, ensName } : null
      }));
    }
  }, [ensName, authState.user]);
  
  // Auto-connect logic is now handled by Step 5 - removing redundant effect
  
  // Update wallet address in provider when connected
  useEffect(() => {
    if (address) {
      (provider as any).setWalletAddress(address);
    }
  }, [address]);
  
  // If AuthContext is provided, we're inside the unified wrapper - just render children
  if (AuthContext) {
    return <>{children}</>;
  }

  // Only create our own context for standalone usage - memoize to prevent re-renders
  const contextValue: AuthContextType = React.useMemo(() => ({
    // State
    ...authState,
    
    // Methods for standalone usage
    connect: async () => {
      console.log('🔧 Farcaster: Manual connect() called');
      
      // If already connected, return early
      if (authState.isConnected) {
        console.log('🔧 Farcaster: Already connected, skipping');
        return;
      }
      
      // If the 5-step auto-connect sequence is complete, just call provider connect
      const farcasterToken = (window as any).__farcasterToken;
      const farcasterSDK = (window as any).__farcasterSDK;
      
      if (address && farcasterToken && farcasterSDK && provider.isReady()) {
        console.log('🔧 Farcaster: All prerequisites ready, connecting directly');
        (provider as any).setWalletAddress(address);
        const result = await provider.connect();
        setAuthState(provider.getState());
        return;
      }
      
      // Need to ensure wallet is connected first
      if (!address) {
        console.log('🔧 Farcaster: No wallet address, connecting wallet first');
        // Find and connect Farcaster wallet
        const farcasterConnector = connectors.find((c) => 
          c.name?.toLowerCase().includes('farcaster') || 
          c.id?.includes('miniapp')
        );
        
        if (farcasterConnector) {
          await connectWallet({ connector: farcasterConnector });
        } else if (connectors.length > 0) {
          await connectWallet({ connector: connectors[0] });
        }
        
        // Wait for wallet connection and let the 5-step sequence complete
        console.log('🔧 Farcaster: Wallet connection initiated, 5-step sequence will complete authentication');
        return;
      }
      
      console.log('🔧 Farcaster: Prerequisites not ready, waiting for 5-step sequence');
    },
    
    disconnect: async () => {
      await provider.disconnect();
      await disconnectWallet();
      setAuthState(provider.getState());
    },
    
    getToken: provider.getToken.bind(provider),
    hasVisitedBefore: provider.hasVisitedBefore.bind(provider),
    markAsVisited: provider.markAsVisited.bind(provider),
    
    // Wallet operations (only available in Farcaster context with wagmi)
    signMessage: async (message: string) => {
      if (!signMessageAsync) {
        throw new Error('Sign message not available');
      }
      const signature = await signMessageAsync({ message });
      return signature;
    },
    
    getEthersProvider: () => {
      // For Farcaster/Wagmi, create ethers provider from wagmi's wallet client
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }
      
      // Convert wagmi wallet client to ethers provider
      return {
        // Return the wallet client directly - SDKs should handle wagmi clients
        walletClient,
        // Some SDKs expect ethers-like interface
        getSigner: async () => ({
          getAddress: async () => address || '',
          signMessage: async (message: string) => {
            const signature = await signMessageAsync({ message });
            return signature;
          }
        })
      };
    },
  }), [authState, address, signMessageAsync, walletClient, provider, connectors, connectWallet]);
  
  return (
    <FarcasterAuthContext.Provider value={contextValue}>
      {children}
    </FarcasterAuthContext.Provider>
  );
}

/**
 * Farcaster Auth Provider React Component (with Wagmi setup)
 */
export function FarcasterAuthProvider({ children, AuthContext }: { 
  children: React.ReactNode;
  AuthContext?: React.Context<any>;
}) {
  // Get chain ID from config - default to Base Sepolia testnet for Farcaster
  const chainId = 84532; // Base Sepolia - Farcaster typically uses Base network
  
  // Track instances for debugging
  const instanceId = React.useRef(Math.random().toString(36).substr(2, 9));
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  React.useEffect(() => {
    mainProviderInstanceCount++;
    console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: MOUNTED (total instances: ${mainProviderInstanceCount})`);
    
    return () => {
      mainProviderInstanceCount--;
      console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: UNMOUNTED (remaining instances: ${mainProviderInstanceCount})`);
    };
  }, []);
  
  console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: RENDER #${renderCount.current} (chainId: ${chainId})`);
  
  // Use singleton instances to prevent multiple providers but allow proper React re-rendering
  const queryClient = getQueryClient();
  const wagmiConfig = getWagmiConfig(chainId);
  
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <FarcasterAuthProviderInner AuthContext={AuthContext}>
          {children}
        </FarcasterAuthProviderInner>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

/**
 * Hook to use Farcaster auth context
 */
export function useFarcasterAuth(): AuthContextType {
  const context = useContext(FarcasterAuthContext);
  if (!context) {
    throw new Error('useFarcasterAuth must be used within FarcasterAuthProvider');
  }
  return context;
}

/**
 * Component that displays Farcaster authentication data
 * Useful for debugging and testing
 */
export function FarcasterAuthDebug() {
  const auth = useFarcasterAuth();

  if (auth.isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-center mt-2">Loading Farcaster auth...</p>
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
      <h3 className="font-bold">Farcaster Auth Data:</h3>
      <div className="text-sm space-y-1">
        <p><strong>Wallet:</strong> {auth.user?.walletAddress || 'Not connected'}</p>
        <p><strong>FID:</strong> {auth.user?.fid || 'N/A'}</p>
        <p><strong>Username:</strong> @{auth.user?.username || 'N/A'}</p>
        <p><strong>Display Name:</strong> {auth.user?.displayName || 'N/A'}</p>
        <p><strong>ENS Name:</strong> {auth.user?.ensName || 'None'}</p>
        <p><strong>Profile Image:</strong> {auth.user?.profileImageUrl ? '✓' : '✗'}</p>
        <p><strong>Auth Token:</strong> {auth.token ? '✓ Valid JWT' : '✗ No token'}</p>
      </div>
    </div>
  );
}