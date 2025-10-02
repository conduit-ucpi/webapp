import React, { useState, useEffect, useCallback } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useConfig } from './ConfigProvider';
import { SimpleAuthContextType, AuthUser } from './SimpleAuthInterface';
import { BackendAuth } from './backendAuth';
import { useEthersProvider } from '@/components/providers/EthersProvider';

// Simple context that only handles auth without complex Web3Service
const AuthContext = React.createContext<SimpleAuthContextType | null>(null);

interface SimpleAuthProviderProps {
  children: React.ReactNode;
}

export function SimpleAuthProvider({ children }: SimpleAuthProviderProps) {
  const { isInFarcaster, isLoading: envDetectionLoading } = useFarcaster();
  const { config, isLoading: configLoading } = useConfig();
  const { setProvider: setAppEthersProvider } = useEthersProvider();
  const [provider, setProvider] = useState<any>(null); // Simplified - no complex interface
  const [authState, setAuthState] = useState({
    user: null as AuthUser | null,
    isConnected: false,
    isLoading: true,
    error: null as string | null
  });

  const backendAuth = BackendAuth.getInstance();

  // Load appropriate auth provider based on environment
  useEffect(() => {
    if (envDetectionLoading || configLoading || !config) return;

    const loadProvider = async () => {
      console.log('🔧 SimpleAuthProvider: Loading provider...');

      if (isInFarcaster) {
        console.log('🔧 SimpleAuthProvider: Loading Farcaster provider...');
        const { getFarcasterAuthProvider } = await import('./farcasterAuth');
        const authProvider = getFarcasterAuthProvider();
        await authProvider.initialize();
        setProvider(authProvider);
        setAuthState(authProvider.getState());
      } else {
        console.log('🔧 SimpleAuthProvider: Loading Web3Auth provider...');
        const { getWeb3AuthProvider } = await import('./web3auth');
        const authProvider = getWeb3AuthProvider(config);

        try {
          await authProvider.initialize();
          console.log('🔧 SimpleAuthProvider: Provider initialized successfully');
        } catch (initError) {
          console.error('🔧 SimpleAuthProvider: Failed to initialize provider:', initError);
        }

        setProvider(authProvider);

        // Check if we have an existing backend session
        const backendStatus = await backendAuth.checkAuthStatus();

        if (backendStatus.success && backendStatus.user) {
          const providerState = authProvider.getState();
          const updatedState = {
            ...providerState,
            user: {
              ...(providerState.user || {}),
              ...backendStatus.user
            } as AuthUser,
            isConnected: true
          };
          setAuthState(updatedState);
        } else {
          setAuthState(authProvider.getState());
        }
      }
    };

    loadProvider().catch((error) => {
      console.error('🔧 SimpleAuthProvider: Failed to load provider:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
    });
  }, [isInFarcaster, envDetectionLoading, configLoading, config]);

  // Handle wallet connection and set ethers provider in app context
  useEffect(() => {
    if (!provider || !authState.isConnected || !authState.user?.userId) return;

    const setupEthersProvider = async () => {
      try {
        const ethersProvider = await provider.getEthersProvider();
        if (ethersProvider) {
          console.log('🔧 SimpleAuthProvider: Setting ethers provider in app context');
          setAppEthersProvider(ethersProvider);
        }
      } catch (error) {
        console.error('🔧 SimpleAuthProvider: Failed to get ethers provider:', error);
      }
    };

    setupEthersProvider();
  }, [provider, authState.isConnected, authState.user?.userId, setAppEthersProvider]);

  // Cleanup
  const disconnect = useCallback(async () => {
    if (provider) {
      await provider.disconnect();
      setAuthState({
        user: null,
        isConnected: false,
        isLoading: false,
        error: null
      });
    }

    await backendAuth.logout();
    setAppEthersProvider(null);
  }, [provider, setAppEthersProvider]);

  // Get ethers provider for direct access
  const getEthersProvider = useCallback(async () => {
    if (!provider) return null;
    return await provider.getEthersProvider();
  }, [provider]);

  // Context value with only what's actually used
  const contextValue: SimpleAuthContextType = {
    // Core state (most commonly used)
    user: authState.user,
    isLoading: authState.isLoading || envDetectionLoading || configLoading,

    // Less common but used
    isConnected: authState.isConnected,
    error: authState.error,

    // Auth methods that are actually used
    disconnect,
    authenticatedFetch: backendAuth.authenticatedFetch.bind(backendAuth),
    hasVisitedBefore: () => false,
    getEthersProvider,

    // Optional methods (not always used)
    connect: provider?.connect?.bind(provider),
    connectWithAdapter: provider?.connectWithAdapter?.bind(provider),
    refreshUserData: provider?.refreshUserData?.bind(provider),

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