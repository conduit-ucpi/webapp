/**
 * React Auth Provider - Main context provider for the reorganized auth system
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthConfig } from '../types';
import { AuthState, AuthUser, ConnectionResult } from '../types/unified-provider';
import { AuthManager } from '../core/AuthManager';
import { AuthService } from '../backend/AuthService';
import { ethers } from 'ethers';
import { mLog } from '../../../utils/mobileLogger';

interface AuthContextValue {
  // State
  state: AuthState;
  user: AuthUser | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  address: string | null;

  // Actions
  connect: () => Promise<ConnectionResult>;
  authenticateBackend: (connectionResult?: ConnectionResult) => Promise<boolean>;
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
  const [isConnecting, setIsConnecting] = useState(false);

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
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('🔧 AuthProvider: Connection already in progress, ignoring duplicate request');
      return {
        success: false,
        error: 'Connection already in progress',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      };
    }

    setIsConnecting(true);

    try {
      // Connect with auth manager (handles provider selection - NO auth)
      const result = await authManager.connect();
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
    } finally {
      setIsConnecting(false);
    }
  }, [authManager, isConnecting]);

  const authenticateBackend = useCallback(async (connectionResult?: ConnectionResult): Promise<boolean> => {
    mLog.info('AuthProvider', 'authenticateBackend called', {
      hasConnectionResult: !!connectionResult,
      connectionSuccess: connectionResult?.success,
      connectionAddress: connectionResult?.address,
      reactStateConnected: state.isConnected,
      reactStateAddress: state.address
    });

    // Use connection result if provided, otherwise fall back to React state
    const isConnected = connectionResult?.success ?? state.isConnected;
    const address = connectionResult?.address ?? state.address;

    mLog.debug('AuthProvider', 'Authentication state check', {
      isConnected,
      address,
      usingConnectionResult: !!connectionResult
    });

    if (!isConnected) {
      mLog.error('AuthProvider', 'Cannot authenticate - no wallet connected', {
        connectionResultSuccess: connectionResult?.success,
        reactStateConnected: state.isConnected,
        usingConnectionResult: !!connectionResult
      });
      return false;
    }

    if (!address) {
      mLog.error('AuthProvider', 'Cannot authenticate - no address available', {
        connectionResultAddress: connectionResult?.address,
        reactStateAddress: state.address,
        usingConnectionResult: !!connectionResult
      });
      return false;
    }

    try {
      mLog.info('AuthProvider', 'Starting message signing for authentication', {
        address
      });

      // Sign message for authentication
      const authToken = await authManager.signMessageForAuth();

      mLog.info('AuthProvider', 'Message signed successfully, sending to backend', {
        address,
        hasToken: !!authToken
      });

      // Send to backend
      const backendResult = await authService.authenticateWithBackend(authToken, address);

      mLog.debug('AuthProvider', 'Backend authentication result', {
        success: backendResult.success,
        hasUser: !!backendResult.user,
        error: backendResult.error
      });

      if (backendResult.success && backendResult.user) {
        setUser(backendResult.user);
        // Update auth manager state to reflect successful authentication
        authManager.setState({ ...authManager.getState(), isAuthenticated: true });
        mLog.info('AuthProvider', '✅ Backend authentication successful');
        return true;
      } else {
        mLog.error('AuthProvider', 'Backend authentication failed', {
          success: backendResult.success,
          error: backendResult.error,
          hasUser: !!backendResult.user
        });
        return false;
      }
    } catch (error) {
      mLog.error('AuthProvider', 'Authentication error during signing or backend call', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }, [authManager, authService, state.isConnected, state.address]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      // Logout from backend first
      await authService.logout();

      // Then disconnect auth manager
      await authManager.disconnect();

      // CRITICAL: Completely obliterate Web3Service singleton to remove ALL traces of previous session
      const { Web3Service } = await import('@/lib/web3');
      Web3Service.clearInstance();
      console.log('🔧 AuthProvider: Web3Service singleton cleared - no trace of previous session');

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
        // After successful wallet switch, re-authenticate with backend
        await authenticateBackend(result);
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
  }, [authManager, authService, authenticateBackend]);

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
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    address: state.address,

    // Actions
    connect,
    authenticateBackend,
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