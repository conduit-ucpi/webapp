/**
 * Unified auth exports - THE ONLY PLACE components should import auth from
 * 
 * This file provides the auth hooks that components should use.
 * All Web3Auth and Farcaster specific code is contained within UnifiedAuthProvider.
 */

// Export the unified hooks
export { useAuth } from './UnifiedAuthProvider';
export { useWallet } from './UnifiedAuthProvider';

// Export the main provider
export { UnifiedAuthProvider } from './UnifiedAuthProvider';

// Export types
export type { User, AuthContextType } from '@/types';
export type { WalletProvider, WalletContextType } from '@/lib/wallet/types';