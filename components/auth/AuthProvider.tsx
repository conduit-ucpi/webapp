import React, { useState, useEffect } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useConfig } from './ConfigProvider';
import { AuthContextType, AuthState, IAuthProvider } from './authInterface';
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
          // Load Web3Auth provider
          console.log('🔧 AuthProvider: Loading Web3Auth provider...');
          const { getWeb3AuthProvider } = await import('./web3auth');
          const authProvider = getWeb3AuthProvider(config!);
          await authProvider.initialize();
          setProvider(authProvider);
          
          // Check if we have an existing backend session
          const backendStatus = await backendAuth.checkAuthStatus();
          
          if (backendStatus.success && backendStatus.user) {
            const providerState = authProvider.getState();
            providerState.user = {
              ...providerState.user,
              ...backendStatus.user
            };
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
        console.log('🔧 AuthProvider: Calling backendAuth.login...');
        const backendResult = await backendAuth.login(
          token,
          providerState.user.walletAddress
        );
        
        if (backendResult.success && backendResult.user) {
          console.log('🔧 AuthProvider: Backend auth successful!');
          // Merge backend user data with provider user data
          const newState = { ...providerState };
          newState.user = {
            ...newState.user,
            ...backendResult.user,
            // Keep provider-specific fields
            fid: newState.user?.fid,
            username: newState.user?.username,
            displayName: newState.user?.displayName || backendResult.user.email,
          };
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
        console.error('🔧 AuthProvider: Missing token or wallet address for backend auth');
      }
    };
    
    handleBackendAuth();
  }, [provider, authState.isConnected, backendAuth]);

  // Create the unified context value - memoize to prevent re-renders (must be before early returns)
  const contextValue: AuthContextType = React.useMemo(() => ({
    // State
    ...authState,

    // Methods - delegate to the loaded provider
    connect: async () => {
      try {
        // First connect to the auth provider (Web3Auth)
        const authResult = await provider.connect();
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (authResult.token && authResult.user.walletAddress) {
          const backendResult = await backendAuth.login(
            authResult.token,
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
            };
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
    
    // Use BackendAuth for authenticated API calls
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return backendAuth.authenticatedFetch(url, options);
    },
  }), [authState, provider, backendAuth]);

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
          providerState.user = {
            ...providerState.user,
            ...backendStatus.user
          };
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
        if (authResult.token && authResult.user.walletAddress) {
          const backendResult = await backendAuth.login(
            authResult.token,
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
            };
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