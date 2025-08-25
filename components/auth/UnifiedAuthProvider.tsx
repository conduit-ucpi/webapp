import React from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';

// Implementation-specific imports are ONLY here, nowhere else
import { Web3AuthProviderWrapper } from './Web3AuthProviderWrapper';
import { Web3AuthContextProvider } from './Web3AuthContextProvider';
import { AuthContextProvider } from '@/lib/auth/AuthContextProvider';
import { WalletProvider } from '@/lib/wallet/WalletProvider';

import { WagmiProviderWrapper } from './WagmiProvider';
import { FarcasterWalletProvider } from './FarcasterWalletProvider';
import { FarcasterAuthProvider } from './FarcasterAuthProvider';

import { GenericAuthProvider } from './GenericAuthProvider';

interface UnifiedAuthProviderProps {
  children: React.ReactNode;
}

/**
 * The ONE auth provider that all components use.
 * This internally decides which implementation to use based on context.
 * No components should ever import Web3Auth or Farcaster specific providers.
 */
export function UnifiedAuthProvider({ children }: UnifiedAuthProviderProps) {
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
    // Farcaster implementation - all contained here
    console.log('Running in Farcaster - using Farcaster auth stack');
    
    return (
      <WagmiProviderWrapper>
        <FarcasterWalletProvider>
          <FarcasterAuthProvider>
            {/* FarcasterAuthProvider provides AuthContext that GenericAuthProvider expects */}
            {children}
          </FarcasterAuthProvider>
        </FarcasterWalletProvider>
      </WagmiProviderWrapper>
    );
  } else {
    // Web3Auth implementation - all contained here
    console.log('Running in regular web - using Web3Auth stack');
    
    return (
      <Web3AuthProviderWrapper>
        <Web3AuthContextProvider>
          <AuthContextProvider>
            <WalletProvider>
              <GenericAuthProvider>
                {children}
              </GenericAuthProvider>
            </WalletProvider>
          </AuthContextProvider>
        </Web3AuthContextProvider>
      </Web3AuthProviderWrapper>
    );
  }
}

// Export the hooks that components should use
export { useAuth } from './GenericAuthProvider';
export { useWallet } from './UnifiedWalletHook';

