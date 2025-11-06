/**
 * Simple Auth Provider that wraps the new auth system with config handling
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider as NewAuthProvider, useAuth as useNewAuth, BackendClient } from '@/lib/auth';
import { useConfig } from './ConfigProvider';
import { toUSDCForWeb3 } from '@/utils/validation';

// Create a default auth context value to prevent "context not found" errors
const defaultAuthValue = {
  user: null,
  isLoading: true,
  isConnected: false,
  isAuthenticated: false,
  error: null,
  address: null,
  state: {
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    isAuthenticated: false,
    address: null,
    providerName: null,
    capabilities: null,
    error: null
  },
  connect: () => Promise.resolve(),
  authenticateBackend: () => Promise.resolve(false),
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
  const { config } = useConfig();

  // Memoize the auth value to prevent unnecessary re-renders
  // Only recreate when the actual auth state changes, not on every render
  const authValue = React.useMemo(() => ({
    user: newAuth.user,
    isLoading: newAuth.isLoading,
    isConnected: newAuth.isConnected,
    isAuthenticated: newAuth.isAuthenticated,
    error: newAuth.error,
    address: newAuth.address,
    state: newAuth.state, // Expose state object which includes providerName
    connect: newAuth.connect,
    authenticateBackend: newAuth.authenticateBackend,
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

      if (!config) {
        throw new Error('Config not available');
      }

      // Get ethers provider directly from auth (avoid circular dependency)
      const ethersProvider = await newAuth.getEthersProvider();
      if (!ethersProvider) {
        throw new Error('Ethers provider not available');
      }

      // Import and create Web3Service directly (avoid useSimpleEthers hook)
      const { Web3Service } = await import('@/lib/web3');
      const web3Service = Web3Service.getInstance(config!);

      // Initialize Web3Service if needed
      if (!web3Service.isServiceInitialized()) {
        console.log('🔧 SimpleAuthProvider: Initializing Web3Service for claim');
        await web3Service.initialize(ethersProvider);
      }

      // Use Web3Service directly for the blockchain operation
      return await web3Service.fundAndSendTransaction({
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

      // Import ethers for encoding
      const { ethers } = await import('ethers');

      // Encode the raiseDispute function call using hardcoded ABI (takes no parameters)
      const escrowAbi = [
        "function raiseDispute() external"
      ];
      const contractInterface = new ethers.Interface(escrowAbi);
      const data = contractInterface.encodeFunctionData('raiseDispute', []);

      // Get ethers provider directly from auth (avoid circular dependency)
      const ethersProvider = await newAuth.getEthersProvider();
      if (!ethersProvider) {
        throw new Error('Ethers provider not available');
      }

      // Import and create Web3Service directly (avoid useSimpleEthers hook)
      const { Web3Service } = await import('@/lib/web3');
      const web3Service = Web3Service.getInstance(config!);

      // Initialize Web3Service if needed
      if (!web3Service.isServiceInitialized()) {
        console.log('🔧 SimpleAuthProvider: Initializing Web3Service for dispute');
        await web3Service.initialize(ethersProvider);
      }

      // Step 1: Execute blockchain transaction using Web3Service directly
      const txHash = await web3Service.fundAndSendTransaction({
        to: params.contractAddress,
        data,
        value: '0' // No value needed for raising dispute
      });

      // Step 2: Notify contractservice about the dispute (if contract ID is provided)
      if (params.contract?.id) {
        console.log('Notifying contractservice about dispute...');

        try {
          const disputeEntry = {
            timestamp: Math.floor(Date.now() / 1000),
            reason: params.reason || 'Dispute raised on blockchain',
            refundPercent: params.refundPercent || 0
          };

          const response = await backendClient.authenticatedFetch(`/api/contracts/${params.contract.id}/dispute`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(disputeEntry)
          });

          if (!response.ok) {
            console.error('Contract service notification failed:', await response.text());
            // Don't throw - the blockchain transaction succeeded
          } else {
            console.log('✅ Contract service notified about dispute');
          }
        } catch (error) {
          console.error('Failed to notify contract service:', error);
          // Don't throw - the blockchain transaction succeeded
        }
      }

      return txHash;
    }
  }), [
    newAuth.user,
    newAuth.isLoading,
    newAuth.isConnected,
    newAuth.isAuthenticated,
    newAuth.error,
    newAuth.address,
    newAuth.state,
    newAuth.connect,
    newAuth.authenticateBackend,
    newAuth.disconnect,
    newAuth.switchWallet,
    newAuth.getEthersProvider,
    newAuth.showWalletUI,
    config,
    backendClient
  ]);

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
      isAuthenticated: false,
      error: null,
      address: null,
      state: {
        isConnected: false,
        isLoading: !mounted || isLoading,
        isInitialized: false,
        isAuthenticated: false,
        address: null,
        providerName: null,
        capabilities: null,
        error: null
      },
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
    dynamicEnvironmentId: config.dynamicEnvironmentId, // Pass through Dynamic environment ID
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