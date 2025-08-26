import React, { createContext, useContext } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { WalletProvider as Web3AuthWalletProvider, useWallet as useWeb3AuthWallet } from '@/lib/wallet/WalletProvider';
import { FarcasterWalletProvider, useWallet as useFarcasterWallet } from './FarcasterWalletProvider';

interface UnifiedWalletContextType {
  walletProvider: any;
  isConnected: boolean;
  address: string | null;
  connectWallet: (provider?: any) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isLoading: boolean;
  provider: 'web3auth' | 'farcaster' | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextType | undefined>(undefined);

/**
 * Simple wrapper that passes through to the correct provider
 */
function WalletPassthrough({ children }: { children: React.ReactNode }) {
  const { isInFarcaster } = useFarcaster();
  
  // Call both hooks unconditionally to satisfy React rules
  let farcasterContext: any = null;
  let web3AuthContext: any = null;
  
  try {
    farcasterContext = useFarcasterWallet();
  } catch (e) {
    // Not in Farcaster context
  }
  
  try {
    web3AuthContext = useWeb3AuthWallet();
  } catch (e) {
    // Not in Web3Auth context
  }
  
  // Select the appropriate context or provide default
  const walletContext = (isInFarcaster ? farcasterContext : web3AuthContext) || {
    // Provide default context during loading
    walletProvider: null,
    isConnected: false,
    address: null,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
    isLoading: true
  };

  return (
    <UnifiedWalletContext.Provider value={{
      ...walletContext,
      provider: isInFarcaster ? 'farcaster' : 'web3auth'
    }}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}

/**
 * Unified wallet provider that automatically selects the correct wallet
 * based on the current context (Web3Auth or Farcaster)
 */
export function UnifiedWalletProvider({ children }: { children: React.ReactNode }) {
  const { isInFarcaster, isDetecting } = useFarcaster();
  
  // During detection, show loading
  if (isDetecting) {
    return (
      <UnifiedWalletContext.Provider value={{
        walletProvider: null,
        isConnected: false,
        address: null,
        connectWallet: async () => {},
        disconnectWallet: async () => {},
        isLoading: true,
        provider: null
      }}>
        {children}
      </UnifiedWalletContext.Provider>
    );
  }
  
  // Render the appropriate provider based on context
  if (isInFarcaster) {
    return (
      <FarcasterWalletProvider>
        <WalletPassthrough>{children}</WalletPassthrough>
      </FarcasterWalletProvider>
    );
  }
  
  return (
    <Web3AuthWalletProvider>
      <WalletPassthrough>{children}</WalletPassthrough>
    </Web3AuthWalletProvider>
  );
}

/**
 * Unified wallet hook
 */
export function useWallet(): UnifiedWalletContextType {
  const context = useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error('useWallet must be used within UnifiedWalletProvider');
  }
  return context;
}