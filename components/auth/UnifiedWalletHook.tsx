import { useContext } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useWallet as useWeb3AuthWallet } from '@/lib/wallet/WalletProvider';
import { useWallet as useFarcasterWallet } from './FarcasterWalletProvider';

/**
 * Unified useWallet hook that automatically uses the correct wallet provider
 * based on the current context (Web3Auth or Farcaster)
 */
export function useWallet() {
  const { isInFarcaster } = useFarcaster();
  
  // Always call both hooks but return the appropriate one based on context
  let web3AuthWallet, farcasterWallet;
  
  try {
    web3AuthWallet = useWeb3AuthWallet();
  } catch (error) {
    // Web3Auth wallet not available - likely in Farcaster context
    web3AuthWallet = null;
  }
  
  try {
    farcasterWallet = useFarcasterWallet();
  } catch (error) {
    // Farcaster wallet not available - likely in Web3Auth context
    farcasterWallet = null;
  }
  
  if (isInFarcaster && farcasterWallet) {
    return farcasterWallet;
  } else if (!isInFarcaster && web3AuthWallet) {
    return web3AuthWallet;
  }
  
  // Fallback if neither is available
  throw new Error('No wallet provider available');
}