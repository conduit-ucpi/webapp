import React, { ReactNode } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { Web3AuthProviderWrapper } from './Web3AuthProviderWrapper';
import { Web3AuthContextProvider } from './Web3AuthContextProvider';
import { AuthContextProvider } from '@/lib/auth/AuthContextProvider';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import { AuthProvider } from './AuthProvider';
import { FarcasterAuthProvider } from './FarcasterAuthProvider';
import { WagmiProviderWrapper } from './WagmiProvider';

interface ConditionalAuthProviderProps {
  children: ReactNode;
}

/**
 * Conditionally provides Web3Auth or Farcaster auth based on context
 */
export const ConditionalAuthProvider: React.FC<ConditionalAuthProviderProps> = ({ children }) => {
  const { isInFarcaster, isLoading } = useFarcaster();

  // Show loading state while detecting context
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isInFarcaster) {
    // Farcaster context - use FarcasterAuthProvider
    console.log('Running in Farcaster - using FarcasterAuthProvider');
    
    return (
      <WagmiProviderWrapper>
        <FarcasterAuthProvider>
          {children}
        </FarcasterAuthProvider>
      </WagmiProviderWrapper>
    );
  } else {
    // Regular web context - use full Web3Auth stack
    console.log('Running in regular web - using Web3Auth');
    
    return (
      <Web3AuthProviderWrapper>
        <Web3AuthContextProvider>
          <AuthContextProvider>
            <WalletProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
            </WalletProvider>
          </AuthContextProvider>
        </Web3AuthContextProvider>
      </Web3AuthProviderWrapper>
    );
  }
};