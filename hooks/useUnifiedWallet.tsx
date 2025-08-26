import { useContext } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useWallet as useWeb3AuthWallet } from '@/lib/wallet/WalletProvider';
import { useWallet as useFarcasterWallet } from '@/components/auth/FarcasterWalletProvider';

/**
 * Simple unified wallet hook that returns the appropriate wallet based on context
 * Both wallets implement the same interface, so we just return the right one
 */
export function useUnifiedWallet() {
  const { isInFarcaster } = useFarcaster();
  
  // Call both hooks to satisfy React rules
  let web3AuthWallet = null;
  let farcasterWallet = null;
  
  try {
    web3AuthWallet = useWeb3AuthWallet();
  } catch (e) {
    // Not in Web3Auth context
  }
  
  try {
    farcasterWallet = useFarcasterWallet();
  } catch (e) {
    // Not in Farcaster context
  }
  
  // Return the appropriate one based on context
  return isInFarcaster ? farcasterWallet : web3AuthWallet;
}