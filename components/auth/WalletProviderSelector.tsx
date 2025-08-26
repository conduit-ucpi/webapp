import React from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { WalletProvider as Web3AuthWalletProvider } from '@/lib/wallet/WalletProvider';
import { FarcasterWalletProvider } from '@/components/auth/FarcasterWalletProvider';

/**
 * Simple component that renders the appropriate wallet provider based on context
 */
export function WalletProviderSelector({ children }: { children: React.ReactNode }) {
  const { isInFarcaster } = useFarcaster();
  
  if (isInFarcaster) {
    return <FarcasterWalletProvider>{children}</FarcasterWalletProvider>;
  }
  
  return <Web3AuthWalletProvider>{children}</Web3AuthWalletProvider>;
}