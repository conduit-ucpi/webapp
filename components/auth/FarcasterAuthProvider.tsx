'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { User, FarcasterAuthContextType } from '@/types';

// Mock useAccount for tests
let useAccount: any;
if (process.env.NODE_ENV === 'test') {
  useAccount = () => ({ isConnected: false, address: undefined });
} else {
  // Try to import wagmi - if it fails, provide fallback
  try {
    const wagmi = require('wagmi');
    useAccount = wagmi.useAccount;
  } catch (error) {
    // Fallback implementation for environments without wagmi
    useAccount = () => ({ isConnected: false, address: undefined });
  }
}

const FarcasterAuthContext = createContext<FarcasterAuthContextType | undefined>(undefined);

export function FarcasterAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Call the hook (mocked in tests, fallback if wagmi not available)
  const { isConnected, address } = useAccount();

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
    let isMounted = true;

    const checkAuthStatus = async () => {
      debugLog('FarcasterAuthProvider_checkAuthStatus_started', {
        isConnected,
        hasAddress: !!address,
        walletAddress: address
      });

      try {
        // Go straight to automatic Farcaster auth
        await attemptFarcasterAuth();
      } catch (error) {
        debugLog('FarcasterAuthProvider_checkAuthStatus_error', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          debugLog('FarcasterAuthProvider_checkAuthStatus_completed');
        }
      }
    };

    const attemptFarcasterAuth = async () => {
      try {
        debugLog('attemptFarcasterAuth_started');
        
        // Import Farcaster SDK dynamically to avoid SSR issues
        // Skip in test environment
        if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
          debugLog('attemptFarcasterAuth_skipped_test_env');
          return;
        }
        
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Get the context from Farcaster SDK - wait for it to be ready
        const context = await sdk.context;
        
        // Wait a bit more for full context to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!context || !context.user) {
          debugLog('attemptFarcasterAuth_no_context', {
            context: !!context,
            user: !!context?.user
          });
          return;
        }

        debugLog('attemptFarcasterAuth_context_found', { 
          context: context,
          user: context.user,
          allUserProperties: Object.keys(context.user),
          userStringified: JSON.stringify(context.user)
        });

        // Use wagmi wallet address instead of trying to get it from Farcaster context
        if (!isConnected || !address) {
          debugLog('attemptFarcasterAuth_no_wagmi_wallet', {
            isConnected,
            hasAddress: !!address,
            userProperties: Object.keys(context.user)
          });
          return;
        }

        const walletAddress = address;

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
        
        debugLog('attemptFarcasterAuth_calling_login', { 
          walletAddress,
          hasToken: !!token,
          tokenType: typeof token
        });
        
        await login(token, walletAddress);
        
        debugLog('attemptFarcasterAuth_login_success');
      } catch (error) {
        debugLog('attemptFarcasterAuth_error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
    };
  }, [isConnected, address]);

  return (
    <FarcasterAuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
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