/**
 * React Auth Provider - Main context provider for the reorganized auth system
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthState, AuthResult, AuthUser, AuthConfig } from '../types';
import { AuthManager } from '../core/AuthManager';
import { AuthService } from '../backend/AuthService';
import { ProviderWrapper } from '../blockchain/ProviderWrapper';

interface AuthContextValue {
  // State
  state: AuthState;
  user: AuthUser | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => Promise<AuthResult>;
  disconnect: () => Promise<void>;
  switchWallet: () => Promise<AuthResult>;
  signMessage: (message: string) => Promise<string>;

  // Blockchain
  provider: ProviderWrapper | null;
  getEthersProvider: () => Promise<any>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  config: AuthConfig;
}

export function AuthProvider({ children, config }: AuthProviderProps) {
  const [authManager] = useState(() => AuthManager.getInstance());
  const [authService] = useState(() => AuthService.getInstance());
  const [state, setState] = useState<AuthState>(() => authManager.getState());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [provider, setProvider] = useState<ProviderWrapper | null>(null);

  // Initialize auth manager
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        await authManager.initialize(config);

        if (isMounted) {
          // Check for existing backend session
          const backendStatus = await authService.checkAuthentication();
          if (backendStatus.success && backendStatus.user) {
            setUser(backendStatus.user);
          }
        }
      } catch (error) {
        console.error('🔧 AuthProvider: Initialization failed:', error);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [authManager, authService, config]);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authManager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [authManager]);

  // Update provider when connected
  useEffect(() => {
    const updateProvider = async () => {
      if (state.isConnected) {
        try {
          const ethersProvider = await authManager.getEthersProvider();
          if (ethersProvider) {
            const currentProvider = authManager.getCurrentProvider();
            const wrapper = new ProviderWrapper(
              ethersProvider,
              currentProvider?.getProviderName() || 'unknown'
            );
            setProvider(wrapper);
          }
        } catch (error) {
          console.error('🔧 AuthProvider: Failed to create provider wrapper:', error);
        }
      } else {
        setProvider(null);
      }
    };

    updateProvider();
  }, [state.isConnected, authManager]);

  const connect = useCallback(async (): Promise<AuthResult> => {
    try {
      // Connect with auth manager (handles provider selection)
      const result = await authManager.connect();

      if (result.success && result.provider) {
        // Get wallet address
        const currentProvider = authManager.getCurrentProvider();
        if (currentProvider) {
          const ethersProvider = await currentProvider.getEthersProvider();
          if (ethersProvider) {
            const signer = await ethersProvider.getSigner();
            const address = await signer.getAddress();

            // Authenticate with backend
            const token = currentProvider.getToken();
            if (token) {
              const backendResult = await authService.authenticateWithBackend(token, address);

              if (backendResult.success && backendResult.user) {
                setUser(backendResult.user);
                return {
                  success: true,
                  user: backendResult.user,
                  token,
                  provider: result.provider
                };
              } else {
                throw new Error(backendResult.error || 'Backend authentication failed');
              }
            }
          }
        }
      }

      throw new Error(result.error || 'Connection failed');

    } catch (error) {
      console.error('🔧 AuthProvider: Connect failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }, [authManager, authService]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      // Logout from backend first
      await authService.logout();

      // Then disconnect auth manager
      await authManager.disconnect();

      // Clear local state
      setUser(null);
      setProvider(null);

    } catch (error) {
      console.error('🔧 AuthProvider: Disconnect failed:', error);
    }
  }, [authManager, authService]);

  const switchWallet = useCallback(async (): Promise<AuthResult> => {
    try {
      // Get current provider and call switchWallet
      const currentProvider = authManager.getCurrentProvider();
      if (currentProvider && typeof currentProvider.switchWallet === 'function') {
        const result = await currentProvider.switchWallet();

        if (result) {
          // Get wallet address and authenticate with backend
          const ethersProvider = await currentProvider.getEthersProvider();
          if (ethersProvider) {
            const signer = await ethersProvider.getSigner();
            const address = await signer.getAddress();

            // Authenticate with backend using new connection
            const token = currentProvider.getToken();
            if (token) {
              const backendResult = await authService.authenticateWithBackend(token, address);

              if (backendResult.success && backendResult.user) {
                setUser(backendResult.user);
                return {
                  success: true,
                  user: backendResult.user,
                  token,
                  provider: result
                };
              } else {
                throw new Error(backendResult.error || 'Backend authentication failed');
              }
            }
          }
        }
      }

      throw new Error('Switch wallet not supported by current provider');

    } catch (error) {
      console.error('🔧 AuthProvider: Switch wallet failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Switch wallet failed'
      };
    }
  }, [authManager, authService]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    return await authManager.signMessage(message);
  }, [authManager]);

  const getEthersProvider = useCallback(async (): Promise<any> => {
    return await authManager.getEthersProvider();
  }, [authManager]);

  const contextValue: AuthContextValue = {
    // State
    state,
    user,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    connect,
    disconnect,
    switchWallet,
    signMessage,

    // Blockchain
    provider,
    getEthersProvider
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}