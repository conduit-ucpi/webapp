import { useState, useEffect, createContext, useContext } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useSignMessage, useWalletClient } from 'wagmi';
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
    if (this.state.isInitialized) return;
    
    try {
      this.state.isLoading = true;
      
      // Import SDK
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
        const farcasterModule = await import('@farcaster/miniapp-sdk');
        this.sdk = farcasterModule.sdk;
        
        // Just check for context, don't auto-connect yet (need wallet address)
        const context = await this.sdk.context;
        if (context?.user) {
          console.log('Farcaster user detected:', context.user);
        }
      }
      
      this.state.isInitialized = true;
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Initialization failed';
      this.emit({ type: 'error', error: this.state.error });
    } finally {
      this.state.isLoading = false;
    }
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
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }
      
      // Get Farcaster context
      const context = await this.sdk.context;
      if (!context?.user) {
        throw new Error('No Farcaster user context');
      }
      
      // Get auth token
      const tokenResult = await this.sdk.quickAuth.getToken();
      const token = typeof tokenResult === 'string' 
        ? tokenResult 
        : (tokenResult as any)?.token;
        
      if (!token || !token.includes('.') || token.split('.').length !== 3) {
        throw new Error('Invalid JWT token from Farcaster');
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

/**
 * React Context for Farcaster Auth
 */
const FarcasterAuthContext = createContext<AuthContextType | null>(null);

/**
 * Farcaster Auth Provider React Component
 */
export function FarcasterAuthProvider({ children }: { children: React.ReactNode }) {
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
  
  // Initialize provider and auto-connect wallet if in Farcaster
  useEffect(() => {
    const init = async () => {
      await provider.initialize();
      setAuthState(provider.getState());
      
      // If we're in Farcaster and don't have a wallet connected, auto-connect
      if (provider.isReady() && !walletConnected) {
        const farcasterConnector = connectors.find((c) => 
          c.name?.toLowerCase().includes('farcaster') || 
          c.id?.includes('miniapp')
        );
        
        if (farcasterConnector) {
          console.log('Auto-connecting Farcaster wallet...');
          try {
            await connectWallet({ connector: farcasterConnector });
          } catch (error) {
            console.error('Failed to auto-connect wallet:', error);
          }
        }
      }
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
  
  // Auto-connect when we have wallet address and SDK is ready
  useEffect(() => {
    const autoConnect = async () => {
      // If we have a wallet address and provider is initialized but not connected
      if (address && authState.isInitialized && !authState.isConnected && !authState.isLoading) {
        try {
          await provider.connect();
          setAuthState(provider.getState());
        } catch (error) {
          console.error('Auto-connect failed:', error);
        }
      }
    };
    
    autoConnect();
  }, [address, authState.isInitialized, authState.isConnected, authState.isLoading]);
  
  // Update wallet address in provider when connected
  useEffect(() => {
    if (address) {
      (provider as any).setWalletAddress(address);
    }
  }, [address]);
  
  const contextValue: AuthContextType = {
    // State
    ...authState,
    
    // Methods
    connect: async () => {
      // Need to ensure wallet is connected first
      if (!address) {
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
        
        // Wait for wallet connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // The effect hook will handle calling provider.connect once address is available
        return;
      }
      
      const result = await provider.connect();
      setAuthState(provider.getState());
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
  };
  
  return (
    <FarcasterAuthContext.Provider value={contextValue}>
      {children}
    </FarcasterAuthContext.Provider>
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