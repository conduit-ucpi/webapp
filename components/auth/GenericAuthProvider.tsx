import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, AuthContextType } from '@/types';

/**
 * Generic AuthProvider that works with any underlying authentication method
 * This provider only handles auth state and backend communication
 * It doesn't know or care about Web3Auth, Farcaster, or any specific implementation
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface GenericAuthProviderProps {
  children: React.ReactNode;
  connectMethod?: () => Promise<void>; // Optional connect implementation from specific auth provider
}

export function GenericAuthProvider({ children, connectMethod }: GenericAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generic login that works with any auth method
  const login = useCallback(async (idToken: string, walletAddress: string) => {
    try {
      const response = await fetch('/api/auth/login', {
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
  }, []);

  // Generic logout
  const logout = useCallback(async () => {
    try {
      // Call backend logout to clear server session
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Clear local auth state
      setUser(null);
      
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
    }
  }, []);

  // Generic connect - uses implementation provided by specific auth provider
  const connect = useCallback(async () => {
    if (connectMethod) {
      await connectMethod();
    } else {
      throw new Error('Connect method not provided to GenericAuthProvider');
    }
  }, [connectMethod]);

  // Check auth status on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/identity');
        if (response.ok && isMounted) {
          const userData = await response.json();
          setUser(userData);
        } else if (isMounted) {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      connect
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within GenericAuthProvider');
  }
  return context;
}