/**
 * React Auth Provider - Main context provider for the reorganized auth system
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthConfig, ProviderType } from '../types';
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
  requestAuthentication: () => Promise<boolean>; // Manually trigger SIWX authentication
  disconnect: () => Promise<void>;
  switchWallet: () => Promise<ConnectionResult>;
  signMessage: (message: string) => Promise<string>;
  updateUserData: (userData: AuthUser) => void; // Update user data from external source

  // Blockchain
  getEthersProvider: () => Promise<ethers.BrowserProvider | null>;
  showWalletUI?: () => Promise<void>;

  // Provider info
  getProviderUserInfo: () => Record<string, unknown> | null;
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
          // Check for existing SIWE session on startup
          try {
            const sessionResponse = await fetch('/api/auth/siwe/session');

            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();

              if (sessionData.address) {
                mLog.info('AuthProvider', 'Found existing SIWE session on startup', {
                  address: sessionData.address
                });

                // Fetch full user data from backend
                const backendStatus = await authService.checkAuthentication();

                if (backendStatus.success && backendStatus.user) {
                  setUser(backendStatus.user);
                  authManager.setState({
                    isAuthenticated: true,
                    isConnected: true,
                    address: sessionData.address
                  });
                  mLog.info('AuthProvider', '✅ Session restored from SIWE cookie');
                }
              }
            } else {
              mLog.debug('AuthProvider', 'No existing SIWE session found on startup');
            }
          } catch (sessionError) {
            mLog.debug('AuthProvider', 'Error checking SIWE session on startup:', {
              error: sessionError instanceof Error ? sessionError.message : String(sessionError)
            });
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

  // LAZY AUTHENTICATION:
  // We don't authenticate with backend immediately after wallet connection.
  // Instead, the first API call that needs auth will trigger a 401 response,
  // which our authenticatedFetch handler will catch and automatically:
  // 1. Request a SIWE signature from the connected wallet
  // 2. Create a backend JWT (AUTH-TOKEN cookie)
  // 3. Retry the original request
  // This provides better UX - users only sign when they actually need backend auth

  // No need to manage provider separately - it's cached in AuthManager

  const connect = useCallback(async (preferredProvider?: ProviderType): Promise<ConnectionResult> => {
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
      // Connect with auth manager (wallet connection only - no backend auth yet)
      const result = await authManager.connect(preferredProvider);

      if (result.success && result.address) {
        mLog.info('AuthProvider', '✅ Wallet connected successfully (lazy auth - backend JWT will be created on first API call)', {
          address: result.address
        });

        // Don't authenticate with backend immediately
        // The first API call that needs auth will trigger a 401, which will:
        // 1. Request a SIWE signature (via requestAuthentication)
        // 2. Create a backend JWT
        // 3. Retry the original request
        // This provides better UX - users only sign when they actually need backend auth
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
    } finally {
      setIsConnecting(false);
    }
  }, [authManager, authService, isConnecting]);

  // Track if authentication is in progress to prevent duplicate calls from multiple component instances
  const isAuthenticatingRef = useRef(false);

  const authenticateBackend = useCallback(async (connectionResult?: ConnectionResult): Promise<boolean> => {
    // Prevent duplicate authentication attempts (e.g., from multiple ConnectWalletEmbedded instances)
    if (isAuthenticatingRef.current) {
      mLog.warn('AuthProvider', 'Authentication already in progress, skipping duplicate call');
      return false;
    }

    mLog.info('AuthProvider', 'authenticateBackend called (SIWE mode - checking session)', {
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
      // Mark authentication as in progress
      isAuthenticatingRef.current = true;

      // Set loading state for backend authentication
      authManager.setState({ isLoading: true });

      mLog.info('AuthProvider', 'Checking SIWE session (no manual signing required)', {
        address
      });

      // SIWE handles authentication automatically during connection
      // Check if we have an active SIWE session
      const sessionResponse = await fetch('/api/auth/siwe/session');

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();

        if (sessionData.address) {
          mLog.info('AuthProvider', '✅ SIWE session found - user authenticated', {
            address: sessionData.address
          });

          // Fetch full user data from backend
          const backendStatus = await authService.checkAuthentication();

          if (backendStatus.success && backendStatus.user) {
            setUser(backendStatus.user);
            authManager.setState({ isAuthenticated: true, isLoading: false });
            mLog.info('AuthProvider', '✅ Backend authentication successful (SIWE)');
            return true;
          } else {
            authManager.setState({ isLoading: false });
            mLog.error('AuthProvider', 'Failed to fetch user data despite valid SIWE session');
            return false;
          }
        } else {
          authManager.setState({ isLoading: false });
          mLog.error('AuthProvider', 'SIWE session response missing address');
          return false;
        }
      } else {
        authManager.setState({ isLoading: false });
        mLog.error('AuthProvider', 'No SIWE session found - authentication failed', {
          status: sessionResponse.status
        });
        return false;
      }
    } catch (error) {
      authManager.setState({ isLoading: false });
      mLog.error('AuthProvider', 'Authentication error during SIWE session check', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    } finally {
      // Clear authentication in progress flag
      isAuthenticatingRef.current = false;
    }
  }, [authManager, authService, state.isConnected, state.address]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      // Sign out from SIWE session (clears AUTH-TOKEN cookie)
      await fetch('/api/auth/siwe/signout', { method: 'POST' });

      // Then disconnect auth manager
      await authManager.disconnect();

      // Clear local state
      setUser(null);

      mLog.info('AuthProvider', '✅ Disconnected and signed out successfully');

    } catch (error) {
      console.error('🔧 AuthProvider: Disconnect failed:', error);
      mLog.error('AuthProvider', 'Disconnect error', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [authManager]);

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

  const requestAuthentication = useCallback(async (): Promise<boolean> => {
    mLog.info('AuthProvider', '🔧 Manually requesting authentication from provider');

    try {
      const success = await authManager.requestAuthentication();

      if (success) {
        mLog.info('AuthProvider', '✅ Manual authentication request triggered successfully');

        // Wait a moment for authentication to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if session was created
        const sessionResponse = await fetch('/api/auth/siwe/session');
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.address) {
            mLog.info('AuthProvider', '✅ SIWX session created successfully after manual trigger');

            // Fetch user data
            const backendStatus = await authService.checkAuthentication();
            if (backendStatus.success && backendStatus.user) {
              setUser(backendStatus.user);
              authManager.setState({ isAuthenticated: true });
              return true;
            }
          }
        }

        mLog.warn('AuthProvider', '⚠️ Manual authentication triggered but session not created yet');
        return false;
      } else {
        mLog.error('AuthProvider', '❌ Failed to trigger manual authentication');
        return false;
      }
    } catch (error) {
      mLog.error('AuthProvider', 'Error during manual authentication request:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }, [authManager, authService]);

  const showWalletUI = useCallback(async (): Promise<void> => {
    mLog.info('AuthProvider', '🔧 Opening wallet management UI');

    try {
      await authManager.showWalletUI();
      mLog.info('AuthProvider', '✅ Wallet management UI opened successfully');
    } catch (error) {
      mLog.error('AuthProvider', 'Error opening wallet management UI:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }, [authManager]);

  const getProviderUserInfo = useCallback((): Record<string, unknown> | null => {
    const provider = authManager.getCurrentProvider();
    if (!provider) {
      return null;
    }

    // Call getUserInfo() if available
    if (typeof provider.getUserInfo === 'function') {
      return provider.getUserInfo();
    }

    return null;
  }, [authManager]);

  // Update user data from external source (e.g., after fetching from backend)
  const updateUserData = useCallback((userData: AuthUser) => {
    setUser(userData);
    authManager.setState({ isAuthenticated: true });
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
    requestAuthentication,
    disconnect,
    switchWallet,
    signMessage,
    updateUserData,

    // Blockchain
    getEthersProvider,
    showWalletUI,

    // Provider info
    getProviderUserInfo
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