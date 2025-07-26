import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { User, AuthContextType } from '@/types';
import { resetWeb3AuthInstance } from './ConnectWallet';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${router.basePath}/api/auth/identity`);
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (idToken: string, walletAddress: string) => {
    try {
      const response = await fetch(`${router.basePath}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ address: walletAddress })
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
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
      // Clear Web3Auth session if available
      const web3authInstance = (window as any).web3auth;
      if (web3authInstance && web3authInstance.connected) {
        try {
          await web3authInstance.logout();
        } catch (logoutError) {
          console.warn('Web3Auth logout failed, continuing with cleanup:', logoutError);
        }
      }
      
      // Clear all Web3Auth related localStorage/sessionStorage
      // Web3Auth stores session data in various localStorage keys
      const keysToRemove = [
        'Web3Auth-cachedAdapter',
        'openlogin_store',
        'local_storage_key',
        'session_id',
        'sessionId', 
        'walletconnect',
        'Web3Auth-connectedAdapters'
      ];
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key}:`, e);
        }
      });
      
      // Clear all items that start with 'Web3Auth' or 'openlogin'
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.startsWith('Web3Auth') || key.startsWith('openlogin') || key.startsWith('walletconnect')) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.warn(`Failed to remove localStorage key ${key}:`, e);
          }
        }
      });
      
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.startsWith('Web3Auth') || key.startsWith('openlogin') || key.startsWith('walletconnect')) {
          try {
            sessionStorage.removeItem(key);
          } catch (e) {
            console.warn(`Failed to remove sessionStorage key ${key}:`, e);
          }
        }
      });
      
      // Clear global Web3Auth references
      (window as any).web3auth = null;
      (window as any).web3authProvider = null;
      
      // Reset the Web3Auth instance so modal appears on next connect
      resetWeb3AuthInstance();
      
      // Call backend logout to clear server session
      await fetch(`${router.basePath}/api/auth/logout`, { method: 'POST' });
      
      // Clear local auth state
      setUser(null);
      
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state and storage
      setUser(null);
      (window as any).web3auth = null;
      (window as any).web3authProvider = null;
      resetWeb3AuthInstance();
      
      // Force clear storage even on error
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear storage on error:', e);
      }
    }
  };

  useEffect(() => {
    checkAuthStatus();
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