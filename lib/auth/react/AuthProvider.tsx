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
      // Connect with auth manager (handles provider selection + SIWE auto-auth)
      const result = await authManager.connect(preferredProvider);

      if (result.success && result.address) {
        mLog.info('AuthProvider', 'Connection successful, checking SIWX authentication status...', {
          address: result.address
        });

        // SIWX handles authentication automatically during connection (required: true in config)
        // Poll for session with retries to allow time for SIWX to complete (especially for embedded wallets)
        try {
          // Poll for SIWX session (may take a moment to complete after connection)
          const maxRetries = 5;
          const retryDelay = 500; // ms
          let sessionFound = false;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const sessionResponse = await fetch('/api/auth/siwe/session');

            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();

              if (sessionData.address) {
                mLog.info('AuthProvider', `✅ SIWX session found on attempt ${attempt} - user authenticated automatically`, {
                  address: sessionData.address
                });

                // Fetch full user data from backend
                const backendStatus = await authService.checkAuthentication();

                if (backendStatus.success && backendStatus.user) {
                  setUser(backendStatus.user);
                  authManager.setState({ isAuthenticated: true });
                  mLog.info('AuthProvider', '✅ User data loaded from backend');
                  sessionFound = true;
                  break;
                }
              }
            }

            // If not found and not last attempt, wait before retry
            if (!sessionFound && attempt < maxRetries) {
              mLog.debug('AuthProvider', `SIWX session not found yet, retrying (${attempt}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }

          if (!sessionFound) {
            mLog.warn('AuthProvider', 'No SIWX session found after all retries - authentication may have failed or user denied signature');
          }
        } catch (siwxError) {
          mLog.error('AuthProvider', 'SIWX session check error:', {
            error: siwxError instanceof Error ? siwxError.message : String(siwxError)
          });
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