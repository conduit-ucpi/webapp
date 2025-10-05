import React, { useState, useEffect, useCallback } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useConfig } from './ConfigProvider';
import { SimpleAuthContextType, AuthUser } from './SimpleAuthInterface';
import { useEthersProvider } from '@/components/providers/EthersProvider';
import { AuthManager, AuthService, ProviderRegistry } from '@/lib/auth';

// Simple context that only handles auth without complex Web3Service
const AuthContext = React.createContext<SimpleAuthContextType | null>(null);

interface SimpleAuthProviderProps {
  children: React.ReactNode;
}

export function SimpleAuthProvider({ children }: SimpleAuthProviderProps) {
  const { isInFarcaster, isLoading: envDetectionLoading } = useFarcaster();
  const { config, isLoading: configLoading } = useConfig();
  const { setProvider: setAppEthersProvider } = useEthersProvider();
  const [authManager] = useState(() => AuthManager.getInstance());
  const [authService] = useState(() => AuthService.getInstance());
  const [authState, setAuthState] = useState({
    user: null as AuthUser | null,
    isConnected: false,
    isLoading: true,
    error: null as string | null
  });

  // Initialize auth system
  useEffect(() => {
    if (envDetectionLoading || configLoading || !config) return;

    const initializeAuth = async () => {
      try {
        console.log('🔧 SimpleAuthProvider: Initializing auth system...');

        // Initialize auth manager with config
        await authManager.initialize(config);

        // Subscribe to auth state changes
        const unsubscribe = authManager.subscribe((newState) => {
          console.log('🔧 SimpleAuthProvider: Auth state changed:', newState);
          setAuthState({
            user: newState.user as AuthUser | null,
            isConnected: newState.isConnected,
            isLoading: newState.isLoading,
            error: newState.error
          });
        });

        // Check for existing backend session
        const backendStatus = await authService.checkAuthentication();
        if (backendStatus.success && backendStatus.user) {
          console.log('🔧 SimpleAuthProvider: Found existing backend session');
          setAuthState(prev => ({
            ...prev,
            user: backendStatus.user as AuthUser,
            isConnected: true,
            isLoading: false
          }));
        } else {
          setAuthState(prev => ({
            ...prev,
            isLoading: false
          }));
        }

        // Return cleanup function
        return unsubscribe;
      } catch (error) {
        console.error('🔧 SimpleAuthProvider: Failed to initialize:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Initialization failed'
        }));
      }
    };

    initializeAuth();
  }, [isInFarcaster, envDetectionLoading, configLoading, config, authManager, authService]);

  // Handle wallet connection and set ethers provider in app context
  useEffect(() => {
    if (!authState.isConnected || !authState.user?.userId) return;

    const setupEthersProvider = async () => {
      try {
        const ethersProvider = await authManager.getEthersProvider();
        if (ethersProvider) {
          console.log('🔧 SimpleAuthProvider: Setting ethers provider in app context');
          setAppEthersProvider(ethersProvider);
        }
      } catch (error) {
        console.error('🔧 SimpleAuthProvider: Failed to get ethers provider:', error);
      }
    };

    setupEthersProvider();
  }, [authState.isConnected, authState.user?.userId, setAppEthersProvider, authManager]);

  // Connect method
  const connect = useCallback(async (loginHint?: string): Promise<void> => {
    console.log('🔧 SimpleAuthProvider: Connecting...');
    const result = await authManager.connect();

    if (result.success && result.user) {
      // Authenticate with backend
      const currentProvider = authManager.getCurrentProvider();
      if (currentProvider) {
        const token = currentProvider.getToken();
        const ethersProvider = await authManager.getEthersProvider();

        if (token && ethersProvider) {
          const signer = await ethersProvider.getSigner();
          const address = await signer.getAddress();

          const backendResult = await authService.authenticateWithBackend(token, address);
          if (backendResult.success && backendResult.user) {
            console.log('🔧 SimpleAuthProvider: Backend authentication successful');
          }
        }
      }
    } else if (result.error) {
      throw new Error(result.error);
    }
  }, [authManager, authService]);

  // Cleanup
  const disconnect = useCallback(async () => {
    console.log('🔧 SimpleAuthProvider: Disconnecting...');
    await authService.logout();
    await authManager.disconnect();
    setAppEthersProvider(null);
  }, [authManager, authService, setAppEthersProvider]);

  // Get ethers provider for direct access
  const getEthersProvider = useCallback(async () => {
    return await authManager.getEthersProvider();
  }, [authManager]);

  // Context value with only what's actually used
  const contextValue: SimpleAuthContextType = {
    // Core state (most commonly used)
    user: authState.user,
    isLoading: authState.isLoading || envDetectionLoading || configLoading,

    // Less common but used
    isConnected: authState.isConnected,
    error: authState.error,

    // Auth methods that are actually used
    connect,
    disconnect,
    authenticatedFetch: async (url: string, options?: RequestInit): Promise<Response> => {
      const result = await authService.apiCall(url, options);
      // Convert the result to a Response-like object for backward compatibility
      return new Response(JSON.stringify(result), {
        status: result.error ? 500 : 200,
        statusText: result.error ? 'Error' : 'OK',
        headers: { 'Content-Type': 'application/json' }
      });
    },
    hasVisitedBefore: () => false,
    getEthersProvider,

    // Optional methods (not always used)
    connectWithAdapter: undefined, // Not implemented in new system yet
    refreshUserData: async (): Promise<void> => {
      await authService.refreshUserData();
    },

    // Deprecated methods - throw errors directing to useSimpleEthers
    fundContract: async () => {
      throw new Error('fundContract deprecated - use useSimpleEthers().fundAndSendTransaction instead');
    },
    claimFunds: async () => {
      throw new Error('claimFunds deprecated - use useSimpleEthers().fundAndSendTransaction instead');
    },
    raiseDispute: async () => {
      throw new Error('raiseDispute deprecated - use useSimpleEthers().fundAndSendTransaction instead');
    }
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): SimpleAuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
}

// Export alias for backward compatibility
export const AuthProvider = SimpleAuthProvider;