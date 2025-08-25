import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Web3AuthProvider, useWeb3Auth } from "@web3auth/modal/react";
import { User } from '@/types';
import { createWeb3AuthConfig } from '@/lib/web3authConfig';
import { useConfig } from './ConfigProvider';
import { ethers } from 'ethers';

interface AuthContextType {
  // User state
  user: User | null;
  isLoading: boolean;
  
  // Auth methods
  connect: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Wallet info & functionality - available everywhere
  walletAddress: string | null;
  signTransaction: (params: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  getWalletProvider: () => any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Internal component that has access to Web3Auth hooks
function AuthProviderInternal({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const { web3Auth } = useWeb3Auth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Connect method that handles all Web3Auth interaction
  const connect = useCallback(async () => {
    if (!web3Auth) {
      throw new Error('Web3Auth not initialized');
    }

    try {
      console.log('Starting Web3Auth connection...');
      
      // Connect to Web3Auth
      const web3authProvider = await web3Auth.connect();
      if (!web3authProvider) {
        throw new Error('Failed to connect wallet');
      }

      // Store provider globally for other methods to access
      (window as any).web3authProvider = web3authProvider;

      // Get user info and wallet address
      const userInfo = await web3Auth.getUserInfo();
      const accounts = await web3authProvider.request({ method: 'eth_accounts' });
      
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No wallet address found');
      }

      const address = accounts[0];
      const idToken = userInfo?.idToken || '';
      
      // Backend verification
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setWalletAddress(address);
        console.log('Connection and login successful');
      } else {
        throw new Error('Backend login failed');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  }, [web3Auth]);

  // Backend verification and login (kept for compatibility)
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

      // Clear the global provider reference
      (window as any).web3authProvider = null;

      // Logout from Web3Auth if available
      if (web3Auth) {
        await web3Auth.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setWalletAddress(null);
      // Clear provider even on error
      (window as any).web3authProvider = null;
    }
  }, [web3Auth]);

  // Wallet functionality - available everywhere
  const signTransaction = useCallback(async (params: any): Promise<string> => {
    console.log('AuthProvider.signTransaction called with params:', params);
    const web3authProvider = (window as any).web3authProvider;
    if (!web3authProvider) throw new Error('Wallet not connected');
    
    // Format transaction parameters for Web3Auth (requires hex strings)
    const formattedParams = {
      ...params,
      nonce: typeof params.nonce === 'number' ? `0x${params.nonce.toString(16)}` : params.nonce,
      gasLimit: typeof params.gasLimit === 'number' ? `0x${params.gasLimit.toString(16)}` : params.gasLimit,
      gasPrice: typeof params.gasPrice === 'number' ? `0x${params.gasPrice.toString(16)}` : params.gasPrice,
      value: typeof params.value === 'number' ? `0x${params.value.toString(16)}` : params.value,
    };
    
    console.log('AuthProvider.signTransaction formatted params:', formattedParams);
    
    return await web3authProvider.request({
      method: "eth_signTransaction",
      params: [formattedParams]
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
    connect,
    logout,
    walletAddress,
    signTransaction,
    signMessage,
    getWalletProvider
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Main provider that wraps Web3AuthProvider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { config } = useConfig();
  const web3AuthConfig = config ? createWeb3AuthConfig(config) : null;

  if (!config || !web3AuthConfig) {
    return <div>Loading configuration...</div>;
  }

  return (
    <Web3AuthProvider config={web3AuthConfig}>
      <AuthProviderInternal>
        {children}
      </AuthProviderInternal>
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