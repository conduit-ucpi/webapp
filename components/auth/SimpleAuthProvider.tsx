/**
 * Simple Auth Provider that wraps the new auth system with config handling
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider as NewAuthProvider, useAuth as useNewAuth } from '@/lib/auth';
import { useConfig } from './ConfigProvider';

// Simple context that matches the old interface for backward compatibility
const AuthContext = React.createContext<any>(null);

interface SimpleAuthProviderProps {
  children: React.ReactNode;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const newAuth = useNewAuth();

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
      // Simplified fetch - the new auth system handles cookies automatically
      return fetch(url, options);
    },
    hasVisitedBefore: () => false,
    refreshUserData: async () => {
      // The new auth system handles this automatically
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
    <NewAuthProvider config={authConfig}>
      <AuthWrapper>
        {children}
      </AuthWrapper>
    </NewAuthProvider>
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