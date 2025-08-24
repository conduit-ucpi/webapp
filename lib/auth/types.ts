/**
 * Abstract authentication provider interface
 * This allows different auth providers (Web3Auth, Farcaster, etc.) to be used interchangeably
 */

import { WalletProvider } from '@/lib/wallet/types';

export interface AuthResult {
  idToken: string;
  walletAddress: string;
  walletProvider: WalletProvider;
}

export interface AuthProvider {
  /**
   * Get the provider name for debugging/display
   */
  getProviderName(): string;

  /**
   * Initialize the auth provider
   */
  initialize(): Promise<void>;

  /**
   * Check if user is already connected/authenticated
   */
  isConnected(): boolean;

  /**
   * Connect and authenticate the user
   * Returns the auth token, wallet address, and wallet provider
   */
  connect(): Promise<AuthResult>;

  /**
   * Disconnect and clear authentication
   */
  disconnect(): Promise<void>;

  /**
   * Get current user info if available
   */
  getUserInfo(): any;

  /**
   * Check if user has visited before (for UX purposes)
   */
  hasVisitedBefore(): boolean;

  /**
   * Mark that user has visited (for UX purposes)
   */
  markAsVisited(): void;
}

export interface AuthContextType {
  authProvider: AuthProvider | null;
  isConnected: boolean;
  isConnecting: boolean;
  userInfo: any;
  connectAuth: () => Promise<AuthResult>;
  disconnectAuth: () => Promise<void>;
  hasVisitedBefore: boolean;
}