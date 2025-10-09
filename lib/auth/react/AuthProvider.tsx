/**
 * React Auth Provider - Main context provider for the reorganized auth system
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthConfig } from '../types';
import { AuthState, AuthUser, ConnectionResult } from '../types/unified-provider';
import { AuthManager } from '../core/AuthManager';
import { AuthService } from '../backend/AuthService';
import { ethers } from 'ethers';

interface AuthContextValue {
  // State
  state: AuthState;
  user: AuthUser | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => Promise<ConnectionResult>;
  disconnect: () => Promise<void>;
  switchWallet: () => Promise<ConnectionResult>;
  signMessage: (message: string) => Promise<string>;

  // Blockchain
  getEthersProvider: () => Promise<ethers.BrowserProvider | null>;
  showWalletUI?: () => Promise<void>;
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

  // No need to manage provider separately - it's cached in AuthManager

  const connect = useCallback(async (): Promise<ConnectionResult> => {
    try {
      // Connect with auth manager (handles provider selection)
      const result = await authManager.connect();

      if (result.success) {
        // Get wallet address
        const currentProvider = authManager.getCurrentProvider();
        if (currentProvider) {
          const ethersProvider = await currentProvider.getEthersProvider();
          if (ethersProvider && result.address) {
            // Authenticate with backend
            const token = currentProvider.getAuthToken();
            if (token) {
              const backendResult = await authService.authenticateWithBackend(token, result.address);

              if (backendResult.success && backendResult.user) {
                setUser(backendResult.user);
                // Return result as-is since it's already a ConnectionResult
                return result;
              } else {
                throw new Error(backendResult.error || 'Backend authentication failed');
              }
            }
          }
        }
      }

      return result; // Return the ConnectionResult whether success or failure

    } catch (error) {
      console.error('🔧 AuthProvider: Connect failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
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

    } catch (error) {
      console.error('🔧 AuthProvider: Disconnect failed:', error);
    }
  }, [authManager, authService]);

  const switchWallet = useCallback(async (): Promise<ConnectionResult> => {
    try {
      // Use AuthManager's switchWallet method
      const result = await authManager.switchWallet();

      if (result.success && result.address) {
        // Authenticate with backend using new connection
        const currentProvider = authManager.getCurrentProvider();
        const token = currentProvider?.getAuthToken();

        if (token) {
          const backendResult = await authService.authenticateWithBackend(token, result.address);

          if (backendResult.success && backendResult.user) {
            setUser(backendResult.user);
          }
        }
      }

      return result;

    } catch (error) {
      console.error('🔧 AuthProvider: Switch wallet failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Switch wallet failed',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      };
    }
  }, [authManager, authService]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    return await authManager.signMessage(message);
  }, [authManager]);

  const getEthersProvider = useCallback(async (): Promise<ethers.BrowserProvider | null> => {
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