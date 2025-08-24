import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthContextType } from '@/types';
import { resetWeb3AuthInstance } from './ConnectWallet';
import { useWeb3AuthInstance } from './Web3AuthContextProvider';
import { useAuthContext } from '@/lib/auth/AuthContextProvider';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {
    web3authInstance,
    web3authProvider,
    isLoading: isWeb3AuthInstanceLoading,
    onLogout,
    updateProvider } = useWeb3AuthInstance();
  const { authProvider, disconnectAuth } = useAuthContext();


  const login = async (idToken: string, userWalletAddress: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ address: userWalletAddress })
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);

        // Update provider state
        updateProvider?.((window as any).web3authProvider);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Use the abstract auth provider for logout
      if (authProvider) {
        console.log(`Logging out with ${authProvider.getProviderName()}...`);
        await disconnectAuth();
      }

      // Call backend logout to clear server session
      await fetch('/api/auth/logout', { method: 'POST' });

      // Clear local auth state
      setUser(null);
      
      // Clear the provider state in Web3AuthContextProvider (for backward compatibility)
      await onLogout();

      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
      
      // Fallback cleanup for backward compatibility
      try {
        resetWeb3AuthInstance();
        await onLogout();
      } catch (fallbackError) {
        console.warn('Fallback cleanup failed:', fallbackError);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const safeCheckAuthStatus = async () => {
      try {
        // Check auth status first
        const response = await fetch('/api/auth/identity');
        if (response.ok && isMounted) {
          const userData = await response.json();
          setUser(userData);
        } else if (isMounted) {
          // If no valid session, clear everything
          const globalProvider = (window as any).web3authProvider;
          if (globalProvider) {
            (window as any).web3authProvider = null;
          }
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
        if (isMounted) {
          setUser(null);
          onLogout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    safeCheckAuthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}