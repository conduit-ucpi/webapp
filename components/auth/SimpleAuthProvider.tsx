/**
 * Simple Auth Provider that wraps the new auth system with config handling
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider as NewAuthProvider, useAuth as useNewAuth, BackendClient } from '@/lib/auth';
import { useConfig } from './ConfigProvider';
import { useEthersProvider } from '@/components/providers/EthersProvider';

// Simple context that matches the old interface for backward compatibility
const AuthContext = React.createContext<any>(null);

interface SimpleAuthProviderProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const newAuth = useNewAuth();
  const backendClient = BackendClient.getInstance();
  const { setProvider } = useEthersProvider();

  // Update EthersProvider when auth provider changes
  useEffect(() => {
    const updateEthersProvider = async () => {
      if (newAuth.isConnected) {
        try {
          console.log('🔧 SimpleAuthProvider: Auth connected, updating EthersProvider');
          const ethersProvider = await newAuth.getEthersProvider();
          if (ethersProvider) {
            console.log('🔧 SimpleAuthProvider: Setting ethers provider in EthersProvider context');
            setProvider(ethersProvider);
          }
        } catch (error) {
          console.error('🔧 SimpleAuthProvider: Failed to get ethers provider:', error);
        }
      } else {
        console.log('🔧 SimpleAuthProvider: Auth disconnected, clearing EthersProvider');
        setProvider(null);
      }
    };

    updateEthersProvider();
  }, [newAuth.isConnected, setProvider]); // Removed getEthersProvider from deps to prevent loop

  // Expose the new auth with the old interface
  const authValue = {
    user: newAuth.user,
    isLoading: newAuth.isLoading,
    isConnected: newAuth.isConnected,
    error: newAuth.error,
    connect: newAuth.connect,
    disconnect: newAuth.disconnect,
    getEthersProvider: newAuth.getEthersProvider,
    authenticatedFetch: async (url: string, options?: RequestInit): Promise<Response> => {
      // Use proper backend client with authentication headers
      return backendClient.authenticatedFetch(url, options);
    },
    hasVisitedBefore: () => false,
    refreshUserData: async () => {
      // Refresh user data from the backend
      try {
        const result = await backendClient.checkAuthStatus();
        if (result.success && result.user) {
          // The user data will be automatically updated through the auth context
          console.log('🔧 SimpleAuthProvider: User data refreshed');
        }
      } catch (error) {
        console.error('🔧 SimpleAuthProvider: Failed to refresh user data:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function SimpleAuthProvider({ children }: SimpleAuthProviderProps) {
  const { config, isLoading } = useConfig();

  // Show loading state while config is being fetched
  if (isLoading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Convert config to AuthConfig format expected by the new auth system
  const authConfig = {
    web3AuthClientId: config.web3AuthClientId,
    web3AuthNetwork: config.web3AuthNetwork,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerBaseUrl: config.explorerBaseUrl,
    walletConnectProjectId: config.walletConnectProjectId
  };

  return (
    <NewAuthProvider config={authConfig} children={
      <AuthWrapper children={children} />
    } />
  );
}

export function useAuth(): any {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
}

// Export alias for backward compatibility
export const AuthProvider = SimpleAuthProvider;