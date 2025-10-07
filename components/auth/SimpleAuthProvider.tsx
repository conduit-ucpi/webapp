/**
 * Simple Auth Provider that wraps the new auth system with config handling
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider as NewAuthProvider, useAuth as useNewAuth, BackendClient } from '@/lib/auth';
import { useConfig } from './ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { toUSDCForWeb3 } from '@/utils/validation';

// Create a default auth context value to prevent "context not found" errors
const defaultAuthValue = {
  user: null,
  isLoading: true,
  isConnected: false,
  error: null,
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  switchWallet: () => Promise.resolve(),
  getEthersProvider: () => null,
  showWalletUI: async () => { throw new Error('Auth not ready'); },
  authenticatedFetch: async () => new Response('{}', { status: 200 }),
  hasVisitedBefore: () => false,
  refreshUserData: async () => {},
  claimFunds: async () => { throw new Error('Auth not ready'); },
  raiseDispute: async () => { throw new Error('Auth not ready'); }
};

// Simple context that matches the old interface for backward compatibility
const AuthContext = React.createContext<any>(defaultAuthValue);

interface SimpleAuthProviderProps {
  children?: React.ReactNode;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const newAuth = useNewAuth();
  const backendClient = BackendClient.getInstance();
  const { fundAndSendTransaction } = useSimpleEthers();

  // Expose the new auth with the old interface
  const authValue = {
    user: newAuth.user,
    isLoading: newAuth.isLoading,
    isConnected: newAuth.isConnected,
    error: newAuth.error,
    connect: newAuth.connect,
    disconnect: newAuth.disconnect,
    switchWallet: newAuth.switchWallet,
    getEthersProvider: newAuth.getEthersProvider,
    showWalletUI: newAuth.showWalletUI || undefined,
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
    },

    // Blockchain operations using fundAndSendTransaction
    claimFunds: async (contractAddress: string, userAddress: string): Promise<string> => {
      console.log('🔧 SimpleAuthProvider: claimFunds called', { contractAddress, userAddress });

      if (!contractAddress || !userAddress) {
        throw new Error('Contract address and user address are required');
      }

      // Import contract ABI
      const { ESCROW_CONTRACT_ABI } = await import('@conduit-ucpi/sdk');
      const { ethers } = await import('ethers');

      // Encode the claimFunds function call
      const contractInterface = new ethers.Interface(ESCROW_CONTRACT_ABI);
      const data = contractInterface.encodeFunctionData('claimFunds', []);

      // Use fundAndSendTransaction for the blockchain operation
      return await fundAndSendTransaction({
        to: contractAddress,
        data,
        value: '0' // No value needed for claiming
      });
    },

    raiseDispute: async (params: {
      contractAddress: string;
      userAddress: string;
      reason: string;
      refundPercent: number;
      contract?: any;
      config?: any;
      utils?: any;
    }): Promise<string> => {
      console.log('🔧 SimpleAuthProvider: raiseDispute called', {
        contractAddress: params.contractAddress,
        userAddress: params.userAddress,
        reason: params.reason,
        refundPercent: params.refundPercent
      });

      if (!params.contractAddress || !params.userAddress || !params.reason || params.refundPercent == null) {
        throw new Error('Contract address, user address, reason, and refund percent are required');
      }

      // Import contract ABI
      const { ESCROW_CONTRACT_ABI } = await import('@conduit-ucpi/sdk');
      const { ethers } = await import('ethers');

      // Encode the raiseDispute function call
      const contractInterface = new ethers.Interface(ESCROW_CONTRACT_ABI);
      const data = contractInterface.encodeFunctionData('raiseDispute', [
        params.reason,
        params.refundPercent
      ]);

      // Use fundAndSendTransaction for the blockchain operation
      return await fundAndSendTransaction({
        to: params.contractAddress,
        data,
        value: '0' // No value needed for raising dispute
      });
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or initial render, provide a minimal context to prevent hydration issues
  if (!mounted || isLoading || !config) {
    // Create a minimal auth context that won't break components during hydration
    const fallbackAuthValue = {
      user: null,
      isLoading: !mounted || isLoading,
      isConnected: false,
      error: null,
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      switchWallet: () => Promise.resolve(),
      getEthersProvider: () => null,
      showWalletUI: async () => { throw new Error('Auth not ready'); },
      authenticatedFetch: async () => new Response('{}', { status: 200 }),
      hasVisitedBefore: () => false,
      refreshUserData: async () => {},
      claimFunds: async () => { throw new Error('Auth not ready'); },
      raiseDispute: async () => { throw new Error('Auth not ready'); }
    };

    return (
      <AuthContext.Provider value={fallbackAuthValue}>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading configuration...</p>
          </div>
        </div>
      </AuthContext.Provider>
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
  // Context will always have a value now (either from provider or default)
  return context;
}

// Export alias for backward compatibility
export const AuthProvider = SimpleAuthProvider;