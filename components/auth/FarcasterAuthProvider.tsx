'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { User, FarcasterAuthContextType, AuthContextType } from '@/types';
import { AuthContext } from './GenericAuthProvider';
import { useAccount, useConnect } from 'wagmi';

const FarcasterAuthContext = createContext<FarcasterAuthContextType | undefined>(undefined);

export function FarcasterAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();

  console.log('🚀 FarcasterAuthProvider mounted!');

  // Helper to safely call debug API (avoid fetch errors in tests)
  const debugLog = (event: string, data?: any) => {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const fetchPromise = fetch('/api/debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            ...data,
            timestamp: new Date().toISOString()
          })
        });
        
        if (fetchPromise && typeof fetchPromise.catch === 'function') {
          fetchPromise.catch(() => {});
        }
      } catch (error) {
        // Silently ignore debug errors
      }
    }
  };

  const login = async (farcasterToken: string, walletAddress: string) => {
    try {
      // Ensure we have a valid JWT string (this should never fail if called correctly)
      if (!farcasterToken || typeof farcasterToken !== 'string') {
        throw new Error('Invalid farcaster token provided to login function');
      }

      // Basic JWT format validation (should have 3 non-empty parts separated by dots)
      const tokenParts = farcasterToken.split('.');
      if (tokenParts.length !== 3 || tokenParts.some(part => part.length === 0)) {
        throw new Error('Invalid farcaster token provided to login function');
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${farcasterToken}`
        },
        body: JSON.stringify({ 
          address: walletAddress 
        })
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      debugLog('FarcasterAuthProvider_login_error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      debugLog('FarcasterAuthProvider_logout_success');
    } catch (error) {
      debugLog('FarcasterAuthProvider_logout_error', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Even if logout fails, clear local state
      setUser(null);
    }
  };

  useEffect(() => {
    console.log('🔥 FarcasterAuthProvider useEffect started');
    let isMounted = true;

    const checkAuthStatus = async () => {
      console.log('🔥 checkAuthStatus started');
      debugLog('FarcasterAuthProvider_checkAuthStatus_started');

      try {
        // Go straight to automatic Farcaster auth
        console.log('🔥 About to call attemptFarcasterAuth');
        await attemptFarcasterAuth();
        console.log('🔥 attemptFarcasterAuth completed');
      } catch (error) {
        console.error('🔥 Error in checkAuthStatus:', error);
        debugLog('FarcasterAuthProvider_checkAuthStatus_error', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        if (isMounted) {
          console.log('🔥 Setting isLoading to false');
          setIsLoading(false);
          debugLog('FarcasterAuthProvider_checkAuthStatus_completed');
        }
      }
    };

    const attemptFarcasterAuth = async () => {
      try {
        console.log('🔥 attemptFarcasterAuth: Starting');
        debugLog('attemptFarcasterAuth_started');
        
        // Import Farcaster SDK dynamically to avoid SSR issues
        // Skip in test environment
        if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
          console.log('🔥 attemptFarcasterAuth: Skipping - test env or no window');
          debugLog('attemptFarcasterAuth_skipped_test_env');
          return;
        }
        
        console.log('🔥 attemptFarcasterAuth: Importing SDK');
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        console.log('🔥 attemptFarcasterAuth: Getting context');
        // Get the context from Farcaster SDK - wait for it to be ready
        const context = await sdk.context;
        
        console.log('🔥 attemptFarcasterAuth: Waiting 1 second');
        // Wait a bit more for full context to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🔥 attemptFarcasterAuth: Checking context and user', { context: !!context, user: !!context?.user });
        if (!context || !context.user) {
          console.log('🔥 attemptFarcasterAuth: No context or user - returning');
          debugLog('attemptFarcasterAuth_no_context', {
            context: !!context,
            user: !!context?.user
          });
          return;
        }

        console.log('🔥 attemptFarcasterAuth: Full user object:', context.user);
        console.log('🔥 attemptFarcasterAuth: User properties:', Object.keys(context.user));
        console.log('🔥 attemptFarcasterAuth: User JSON:', JSON.stringify(context.user, null, 2));
        
        debugLog('attemptFarcasterAuth_context_found', { 
          context: context,
          user: context.user,
          allUserProperties: Object.keys(context.user),
          userStringified: JSON.stringify(context.user)
        });

        // Auto-connect wallet if not connected
        console.log('🔥 wagmi connection status:', { isConnected, address });
        if (!isConnected || !address) {
          console.log('🔥 attemptFarcasterAuth: Wallet not connected - attempting auto-connect');
          
          // Find Farcaster connector
          const farcasterConnector = connectors.find((c: any) => 
            c.name?.includes('Farcaster') || 
            c.id?.includes('miniapp') ||
            c.type?.includes('farcaster')
          );
          
          if (!farcasterConnector) {
            console.log('🔥 attemptFarcasterAuth: No Farcaster connector found, using first available');
            if (connectors.length > 0) {
              try {
                console.log('🔥 attemptFarcasterAuth: Connecting with', connectors[0].name);
                await connect({ connector: connectors[0] });
                // Wait a moment for connection to establish
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (error) {
                console.log('🔥 attemptFarcasterAuth: Auto-connect failed:', error);
                return;
              }
            } else {
              console.log('🔥 attemptFarcasterAuth: No connectors available');
              return;
            }
          } else {
            try {
              console.log('🔥 attemptFarcasterAuth: Auto-connecting with Farcaster connector');
              await connect({ connector: farcasterConnector });
              // Wait a moment for connection to establish
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.log('🔥 attemptFarcasterAuth: Farcaster auto-connect failed:', error);
              return;
            }
          }
          
          // Check connection again after auto-connect attempt
          // Note: This might not work immediately due to React state updates
          // The useEffect will re-run when isConnected/address changes
          console.log('🔥 attemptFarcasterAuth: Auto-connect attempted, will retry on next render');
          return;
        }

        const walletAddress = address;

        console.log('🔥 attemptFarcasterAuth: Getting token from quickAuth');
        // Get proper signed JWT from Farcaster Quick Auth
        const tokenResult = await sdk.quickAuth.getToken();
        
        // Extract the actual token string from the result and ensure it's a string
        let token: string;
        if (typeof tokenResult === 'string') {
          token = tokenResult;
        } else if (tokenResult && typeof tokenResult === 'object' && 'token' in tokenResult) {
          token = String((tokenResult as any).token);
        } else {
          throw new Error('Invalid token format received from Farcaster SDK');
        }
        
        // Validate that we actually have a JWT-like string
        if (!token || typeof token !== 'string' || token.trim() === '') {
          throw new Error('Empty or invalid token received from Farcaster SDK');
        }
        
        // Basic JWT format validation (should have 3 parts separated by dots)
        if (!token.includes('.') || token.split('.').length !== 3) {
          throw new Error('Token does not appear to be a valid JWT format');
        }
        
        console.log('🔥 attemptFarcasterAuth: About to call login with token and address');
        debugLog('attemptFarcasterAuth_calling_login', { 
          walletAddress,
          hasToken: !!token,
          tokenType: typeof token
        });
        
        await login(token, walletAddress);
        
        console.log('🔥 attemptFarcasterAuth: Login successful!');
        debugLog('attemptFarcasterAuth_login_success');
      } catch (error) {
        debugLog('attemptFarcasterAuth_error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    console.log('🔥 About to call checkAuthStatus');
    checkAuthStatus();

    return () => {
      console.log('🔥 FarcasterAuthProvider useEffect cleanup');
      isMounted = false;
    };
  }, [isConnected, address]); // React to wagmi wallet connection changes

  // Create auth context value for regular components
  const authContextValue: AuthContextType = {
    user,
    isLoading,
    login: async (idToken: string, walletAddress: string) => {
      return login(idToken, walletAddress);
    },
    logout,
    connect: async () => {
      // In Farcaster context, connection is automatic
      // Just check if we're connected and authenticated
      if (user) {
        console.log('Already connected and authenticated in Farcaster');
        return;
      }
      
      // Connection is automatic, but auth might still be in progress
      if (isLoading) {
        throw new Error('Authentication in progress, please wait');
      }
      
      console.log('Farcaster authentication should happen automatically');
    }
  };

  return (
    <FarcasterAuthContext.Provider value={{ user, isLoading, login, logout }}>
      <AuthContext.Provider value={authContextValue}>
        {children}
      </AuthContext.Provider>
    </FarcasterAuthContext.Provider>
  );
}

export function useFarcasterAuth() {
  const context = useContext(FarcasterAuthContext);
  if (context === undefined) {
    throw new Error('useFarcasterAuth must be used within a FarcasterAuthProvider');
  }
  return context;
}

// Regular useAuth hook that works with existing components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}