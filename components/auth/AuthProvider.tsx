import React, { useState, useEffect } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useConfig } from './ConfigProvider';
import { AuthContextType, AuthState, IAuthProvider, AuthUser } from './authInterface';
import { BackendAuth } from './backendAuth';

// The unified context that the rest of the app uses
const AuthContext = React.createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isInFarcaster, isLoading: envDetectionLoading } = useFarcaster();
  const { config, isLoading: configLoading } = useConfig();
  const [provider, setProvider] = useState<IAuthProvider | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'loading'
  });
  
  // Get backend auth instance
  const backendAuth = BackendAuth.getInstance();
  
  // Track AuthProvider renders
  const authProviderId = React.useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔧 AuthProvider [${authProviderId.current}]: Render - Farcaster: ${isInFarcaster}`);
  
  // Load the appropriate provider based on environment
  useEffect(() => {
    if (!isInFarcaster && (configLoading || !config)) return;

    const loadProvider = async () => {
      try {
        if (isInFarcaster) {
          // Load Farcaster provider
          console.log('🔧 AuthProvider: Loading Farcaster provider...');
          const { getFarcasterAuthProvider } = await import('./farcasterAuth');
          const authProvider = getFarcasterAuthProvider();
          await authProvider.initialize();
          setProvider(authProvider);
          setAuthState(authProvider.getState());
        } else {
          // Load Web3Auth no-modal provider
          console.log('🔧 AuthProvider: Loading Web3Auth no-modal provider...');
          const { getWeb3AuthNoModalProvider } = await import('./web3authNoModal');
          const authProvider = getWeb3AuthNoModalProvider(config!);
          
          try {
            await authProvider.initialize();
            console.log('🔧 AuthProvider: Web3Auth provider initialized successfully');
          } catch (initError) {
            console.error('🔧 AuthProvider: Failed to initialize Web3Auth:', initError);
            // Even if initialization fails, set the provider so user can see error
            // The provider will handle the error state internally
          }
          
          setProvider(authProvider);
          
          // Check if we have an existing backend session
          const backendStatus = await backendAuth.checkAuthStatus();
          
          if (backendStatus.success && backendStatus.user) {
            const providerState = authProvider.getState();
            if (providerState.user) {
              providerState.user = {
                ...providerState.user,
                ...backendStatus.user
              } as AuthUser;
            }
            providerState.isConnected = true;
            setAuthState(providerState);
          } else {
            setAuthState(authProvider.getState());
          }
        }
      } catch (error) {
        console.error('🔧 AuthProvider: Error loading provider:', error);
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load auth provider',
          isLoading: false
        }));
      }
    };

    loadProvider();
  }, [isInFarcaster, config, configLoading, backendAuth]);

  // Monitor provider state for connection and handle backend auth
  useEffect(() => {
    if (!provider || !authState.isConnected) return;
    
    console.log('🔧 AuthProvider: Checking if backend auth needed...', {
      hasProvider: !!provider,
      isConnected: authState.isConnected,
      hasUserId: !!authState.user?.userId,
      hasBackendToken: !!backendAuth.getToken()
    });
    
    // Skip if we already have backend auth
    if (backendAuth.getToken()) {
      console.log('🔧 AuthProvider: Backend token already exists, skipping');
      return;
    }
    
    // Provider just connected - call backend auth
    const handleBackendAuth = async () => {
      console.log('🔧 AuthProvider: Provider connected, calling backend auth...');
      
      const providerState = provider.getState();
      const token = provider.getToken();
      
      console.log('🔧 AuthProvider: Provider data:', {
        hasToken: !!token,
        hasWalletAddress: !!providerState.user?.walletAddress,
        userDetails: providerState.user
      });
      
      if (token && providerState.user?.walletAddress) {
        console.log('🔧 AuthProvider: Calling backendAuth.login...', {
          hasIdToken: !!token,
          authProvider: providerState.user.authProvider,
          tokenLength: token.length
        });
        const backendResult = await backendAuth.login(
          token,
          providerState.user.walletAddress
        );
        
        if (backendResult.success && backendResult.user) {
          console.log('🔧 AuthProvider: Backend auth successful!');
          // Merge backend user data with provider user data
          const newState = { ...providerState };
          if (newState.user) {
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user.fid,
              username: newState.user.username,
              displayName: newState.user.displayName || backendResult.user.email,
            } as AuthUser;
          }
          setAuthState(newState);
        } else {
          console.error('🔧 AuthProvider: Backend auth failed:', backendResult.error);
          setAuthState(prev => ({
            ...prev,
            error: backendResult.error || 'Backend authentication failed',
            isConnected: false
          }));
        }
      } else {
        console.error('🔧 AuthProvider: Missing token or wallet address for backend auth', {
          hasToken: !!token,
          hasWalletAddress: !!providerState.user?.walletAddress
        });
      }
    };
    
    handleBackendAuth();
  }, [provider, authState.isConnected, backendAuth]);


  // Create the unified context value - memoize to prevent re-renders (must be before early returns)
  const contextValue: AuthContextType = React.useMemo(() => {
    if (!provider) {
      // Return minimal context when provider not loaded
      return {
        ...authState,
        connect: async () => { throw new Error('Auth provider not initialized'); },
        disconnect: async () => { throw new Error('Auth provider not initialized'); },
        getToken: () => null,
        hasVisitedBefore: () => false,
        markAsVisited: () => {},
        signMessage: async () => { throw new Error('Auth provider not initialized'); },
        signContractTransaction: async () => { throw new Error('Auth provider not initialized'); },
        getEthersProvider: () => { throw new Error('Auth provider not initialized'); },
        getUSDCBalance: async () => '0',
        authenticatedFetch: undefined,
      };
    }
    
    return ({
    // State
    ...authState,

    // Methods - delegate to the loaded provider
    connect: async (loginHint?: string) => {
      try {
        // First connect to the auth provider (Web3Auth)
        await provider.connect();
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (newState.token && newState.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            newState.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    disconnect: async () => {
      // Logout from backend first
      await backendAuth.logout();
      
      // Then disconnect from provider
      await provider.disconnect();
      setAuthState(provider.getState());
    },

    getToken: () => provider.getToken(),
    
    hasVisitedBefore: () => provider.hasVisitedBefore(),
    
    markAsVisited: () => provider.markAsVisited(),

    signMessage: async (message: string) => {
      // Cast to access signMessage method
      const providerWithSign = provider as any;
      if (providerWithSign.signMessage) {
        return await providerWithSign.signMessage(message);
      }
      throw new Error('Sign message not available');
    },

    getEthersProvider: () => {
      // Cast to access getEthersProvider method
      const providerWithEthers = provider as any;
      if (providerWithEthers.getEthersProvider) {
        return providerWithEthers.getEthersProvider();
      }
      throw new Error('Ethers provider not available');
    },

    getUSDCBalance: async (userAddress?: string) => {
      // Cast to access getUSDCBalance method
      const providerWithUSDC = provider as any;
      if (providerWithUSDC.getUSDCBalance) {
        return await providerWithUSDC.getUSDCBalance(userAddress);
      }
      throw new Error('getUSDCBalance not available');
    },

    signContractTransaction: async (params: any) => {
      // Cast to access signContractTransaction method
      const providerWithSign = provider as any;
      if (providerWithSign.signContractTransaction) {
        return await providerWithSign.signContractTransaction(params);
      }
      throw new Error('signContractTransaction not available');
    },

    // High-level contract transaction methods
    createContract: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.createContract) {
        return await providerWithContract.createContract(...args);
      }
      throw new Error('createContract not available');
    },

    approveUSDC: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.approveUSDC) {
        return await providerWithContract.approveUSDC(...args);
      }
      throw new Error('approveUSDC not available');
    },

    depositFunds: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.depositFunds) {
        return await providerWithContract.depositFunds(...args);
      }
      throw new Error('depositFunds not available');
    },

    fundContract: async (...args: any[]) => {
      console.log('🔧 AuthProvider: fundContract called, delegating to provider');
      const providerWithContract = provider as any;
      if (providerWithContract.fundContract) {
        // Pass authenticatedFetch as the second parameter to reuse existing auth logic
        return await providerWithContract.fundContract(args[0], backendAuth.authenticatedFetch);
      }
      throw new Error('fundContract not available from provider');
    },

    claimFunds: async (...args: any[]) => {
      console.log('🔧 AuthProvider: claimFunds called, delegating to provider');
      const providerWithContract = provider as any;
      if (providerWithContract.claimFunds) {
        return await providerWithContract.claimFunds(...args);
      }
      throw new Error('claimFunds not available from provider');
    },

    raiseDispute: async (...args: any[]) => {
      console.log('🔧 AuthProvider: raiseDispute called, delegating to provider');
      const providerWithContract = provider as any;
      if (providerWithContract.raiseDispute) {
        return await providerWithContract.raiseDispute(...args);
      }
      throw new Error('raiseDispute not available from provider');
    },
    
    // No-modal specific method for connecting with specific adapters
    connectWithAdapter: async (adapter: string, loginHint?: string) => {
      try {
        // Check if provider has connectWithAdapter method
        const providerWithAdapter = provider as any;
        if (!providerWithAdapter.connectWithAdapter) {
          // Fall back to regular connect for providers that don't support adapters
          await provider.connect();
          return;
        }
        
        // First connect to the auth provider (Web3Auth)
        const authResult = await providerWithAdapter.connectWithAdapter(adapter, loginHint);
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (authResult.success && newState.token && authResult.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            authResult.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed  
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    // Use BackendAuth for authenticated API calls
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return backendAuth.authenticatedFetch(url, options);
    },
    });
  }, [authState, provider, backendAuth]);

  // Memoize callbacks to prevent FarcasterAuthProviderWrapper re-renders (must be before early returns)
  const handleProviderReady = React.useCallback((p: IAuthProvider) => {
    setProvider(p);
  }, []);
  
  const handleStateChange = React.useCallback((state: AuthState) => {
    setAuthState(state);
  }, []);

  // Early returns after all hooks
  
  // Still detecting environment
  if (envDetectionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Detecting environment...</p>
        </div>
      </div>
    );
  }

  // Show loading for Web3Auth while provider loads
  if (!isInFarcaster && (configLoading || !config || !provider)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {isInFarcaster ? (
        <FarcasterAuthProviderWrapper 
          onProviderReady={handleProviderReady}
          onStateChange={handleStateChange}
        >
          {children}
        </FarcasterAuthProviderWrapper>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// Wrapper that loads and renders FarcasterAuthProvider
const FarcasterAuthProviderWrapper = React.memo(function FarcasterAuthProviderWrapper({ 
  children, 
  onProviderReady,
  onStateChange 
}: { 
  children: React.ReactNode;
  onProviderReady?: (provider: IAuthProvider) => void;
  onStateChange?: (state: AuthState) => void;
}) {
  const [FarcasterComponent, setFarcasterComponent] = useState<any>(null);
  
  // Track wrapper renders
  const wrapperId = React.useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔧 FarcasterAuthProviderWrapper [${wrapperId.current}]: RENDERING`);
  
  // Poll for Farcaster provider state changes - but stop once connected
  useEffect(() => {
    if (!FarcasterComponent) return;
    
    let checkFarcasterState: NodeJS.Timeout;
    let hasConnected = false;
    
    const checkState = () => {
      // Check if Farcaster provider exists and has connected
      const farcasterProvider = (window as any).__farcasterProvider;
      if (farcasterProvider && onProviderReady) {
        onProviderReady(farcasterProvider);
        
        const state = farcasterProvider.getState();
        if (state.isConnected && onStateChange && !hasConnected) {
          console.log('🔧 FarcasterWrapper: Farcaster connected, updating parent state');
          hasConnected = true;
          onStateChange(state);
          // Stop polling once connected
          if (checkFarcasterState) {
            clearInterval(checkFarcasterState);
          }
        }
      }
    };
    
    checkFarcasterState = setInterval(checkState, 500);
    
    return () => {
      if (checkFarcasterState) {
        clearInterval(checkFarcasterState);
      }
    };
  }, [FarcasterComponent, onProviderReady, onStateChange]);
  
  useEffect(() => {
    const loadFarcaster = async () => {
      console.log('🔧 FarcasterWrapper: Loading FarcasterAuthProvider...');
      try {
        const { FarcasterAuthProvider, getFarcasterAuthProvider } = await import('./farcasterAuth');
        
        // Store the provider instance globally so we can access it
        const provider = getFarcasterAuthProvider();
        (window as any).__farcasterProvider = provider;
        
        setFarcasterComponent(() => FarcasterAuthProvider);
      } catch (error) {
        console.error('🔧 FarcasterWrapper: Failed to load:', error);
      }
    };
    loadFarcaster();
  }, []);
  
  if (!FarcasterComponent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Farcaster authentication...</p>
        </div>
      </div>
    );
  }
  
  // Pass the AuthContext to FarcasterAuthProvider so it uses the same context
  return React.createElement(FarcasterComponent, { AuthContext }, children);
});

// Component for regular (non-Farcaster) authentication
function RegularAuthProvider({ children }: AuthProviderProps) {
  const { config, isLoading: configLoading } = useConfig();
  const [provider, setProvider] = useState<IAuthProvider | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'loading'
  });
  
  // Get backend auth instance
  const backendAuth = BackendAuth.getInstance();

  // Load Web3Auth provider
  useEffect(() => {
    if (configLoading || !config) return;

    const loadProvider = async () => {
      try {
        console.log('🔧 RegularAuthProvider: Loading Web3Auth provider...');
        const { getWeb3AuthProvider } = await import('./web3auth');
        const authProvider = getWeb3AuthProvider(config);

        await authProvider.initialize();
        setProvider(authProvider);
        
        // Check if we have an existing backend session
        const backendStatus = await backendAuth.checkAuthStatus();
        
        if (backendStatus.success && backendStatus.user) {
          const providerState = authProvider.getState();
          if (providerState.user) {
            providerState.user = {
              ...providerState.user,
              ...backendStatus.user,
              authProvider: providerState.user.authProvider || 'unknown'
            } as AuthUser;
          }
          providerState.isConnected = true;
          setAuthState(providerState);
        } else {
          setAuthState(authProvider.getState());
        }
        
      } catch (error) {
        console.error('🔧 RegularAuthProvider: Error loading provider:', error);
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load auth provider',
          isLoading: false
        }));
      }
    };

    loadProvider();
  }, [config, configLoading, backendAuth]);

  // Show loading while we load the provider
  if (configLoading || !config || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Create the context value that implements AuthContextType
  const contextValue: AuthContextType = {
    // State
    ...authState,

    // Methods - delegate to the loaded provider
    connect: async () => {
      try {
        // First connect to the auth provider (Web3Auth)
        const authResult = await provider.connect();
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (newState.token && newState.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            newState.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    disconnect: async () => {
      // Logout from backend first
      await backendAuth.logout();
      
      // Then disconnect from provider
      await provider.disconnect();
      setAuthState(provider.getState());
    },

    getToken: () => provider.getToken(),
    
    hasVisitedBefore: () => provider.hasVisitedBefore(),
    
    markAsVisited: () => provider.markAsVisited(),

    signMessage: async (message: string) => {
      // Cast to access signMessage method
      const providerWithSign = provider as any;
      if (providerWithSign.signMessage) {
        return await providerWithSign.signMessage(message);
      }
      throw new Error('Sign message not available');
    },

    getEthersProvider: () => {
      // Cast to access getEthersProvider method
      const providerWithEthers = provider as any;
      if (providerWithEthers.getEthersProvider) {
        return providerWithEthers.getEthersProvider();
      }
      throw new Error('Ethers provider not available');
    },
    
    getUSDCBalance: async (userAddress?: string) => {
      const providerWithBalance = provider as any;
      if (providerWithBalance.getUSDCBalance) {
        return await providerWithBalance.getUSDCBalance(userAddress);
      }
      return '0';
    },
    
    signContractTransaction: async (params: any) => {
      const providerWithSign = provider as any;
      if (providerWithSign.signContractTransaction) {
        return await providerWithSign.signContractTransaction(params);
      }
      throw new Error('Contract transaction signing not available');
    },
    
    // Use BackendAuth for authenticated API calls
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return backendAuth.authenticatedFetch(url, options);
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// The ONLY hook the rest of the app should use
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}