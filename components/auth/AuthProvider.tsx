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

  // Load the appropriate provider based on environment
  useEffect(() => {
    if (envDetectionLoading || configLoading || !config) return;

    const loadProvider = async () => {
      try {
        let authProvider: IAuthProvider;

        console.log('🔧 AuthProvider: Loading provider...', { isInFarcaster, config: !!config });

        if (isInFarcaster) {
          const { getFarcasterAuthProvider } = await import('./farcasterAuth');
          authProvider = getFarcasterAuthProvider(config);
        } else {
          const { getWeb3AuthProvider } = await import('./web3auth');
          authProvider = getWeb3AuthProvider(config);
        }

        console.log('🔧 AuthProvider: Calling provider.initialize()...');
        await authProvider.initialize();
        setProvider(authProvider);
        
        // Check if we have an existing backend session
        const backendStatus = await backendAuth.checkAuthStatus();
        if (backendStatus.success && backendStatus.user) {
          // We have a valid backend session
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
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load auth provider',
          isLoading: false
        }));
      }
    };

    loadProvider();
  }, [isInFarcaster, envDetectionLoading, config, configLoading]);

  // Show loading while we figure out which provider to use
  if (envDetectionLoading || configLoading || !config || !provider) {
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
        // First connect to the auth provider (Farcaster or Web3Auth)
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