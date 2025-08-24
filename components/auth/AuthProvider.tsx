import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Web3AuthProvider } from "@web3auth/modal/react";
import { User } from '@/types';
import { createWeb3AuthConfig } from '@/lib/web3authConfig';
import { useConfig } from './ConfigProvider';
import { ethers } from 'ethers';

interface AuthContextType {
  // User state
  user: User | null;
  isLoading: boolean;
  
  // Auth methods
  login: (idToken: string, walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Wallet info & functionality - available everywhere
  walletAddress: string | null;
  signTransaction: (params: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  getWalletProvider: () => any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const web3AuthConfig = config ? createWeb3AuthConfig(config) : null;

  // Backend verification and login
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
        setWalletAddress(walletAddress);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setWalletAddress(null);

      const web3authProvider = (window as any).web3authProvider;
      if (web3authProvider) {
        await web3authProvider.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setWalletAddress(null);
    }
  }, []);

  // Wallet functionality - available everywhere
  const signTransaction = useCallback(async (params: any): Promise<string> => {
    const web3authProvider = (window as any).web3authProvider;
    if (!web3authProvider) throw new Error('Wallet not connected');
    
    return await web3authProvider.request({
      method: "eth_signTransaction",
      params: [params]
    });
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const web3authProvider = (window as any).web3authProvider;
    if (!web3authProvider || !walletAddress) throw new Error('Wallet not connected');
    
    return await web3authProvider.request({
      method: "personal_sign",
      params: [message, walletAddress]
    });
  }, [walletAddress]);

  const getWalletProvider = useCallback(() => {
    return (window as any).web3authProvider;
  }, []);

  // Initialize - check backend auth and get wallet address
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Check if user is authenticated with backend
        const response = await fetch('/api/auth/identity');
        if (response.ok && isMounted) {
          const userData = await response.json();
          setUser(userData);

          // Get wallet address from Web3Auth if available
          const web3authProvider = (window as any).web3authProvider;
          if (web3authProvider) {
            try {
              const accounts = await web3authProvider.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) {
                setWalletAddress(accounts[0]);
              }
            } catch (error) {
              console.warn('Could not get wallet address:', error);
            }
          }
        } else if (isMounted) {
          setUser(null);
          setWalletAddress(null);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (isMounted) {
          setUser(null);
          setWalletAddress(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (config) {
      initialize();
    }

    return () => {
      isMounted = false;
    };
  }, [config]);

  const contextValue: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    walletAddress,
    signTransaction,
    signMessage,
    getWalletProvider
  };

  if (!config || !web3AuthConfig) {
    return <div>Loading configuration...</div>;
  }

  return (
    <Web3AuthProvider config={web3AuthConfig}>
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    </Web3AuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}