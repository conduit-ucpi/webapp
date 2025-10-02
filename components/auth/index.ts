/**
 * Unified auth exports - THE ONLY PLACE components should import auth from
 * 
 * This file provides the auth hooks that components should use.
 * All implementation details (Farcaster, Web3Auth, BackendAuth) are hidden.
 * 
 * IMPORTANT: Only AuthProvider.tsx should import farcasterAuth, web3auth, or backendAuth
 */

// Export the unified hook and provider from the Simple AuthProvider
export { useAuth, SimpleAuthProvider as AuthProvider } from './SimpleAuthProvider';

// Export types
export type { User, AuthContextType } from '@/types';
export type { WalletProvider, WalletContextType } from '@/lib/wallet/types';