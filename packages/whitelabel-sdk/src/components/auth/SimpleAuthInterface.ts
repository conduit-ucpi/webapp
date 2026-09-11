/**
 * Simplified auth interface with only what's actually used
 */

export interface AuthUser {
  // Core identity (actually used)
  userId: string;
  walletAddress: string;
  email?: string;

  // Provider-specific identifiers (actually used)
  fid?: number;                    // Farcaster ID
  web3authUserId?: string;         // Web3Auth user ID

  // Profile information (actually used)
  username?: string;               // Handle/username (@alice)
  displayName?: string;            // Display name (Alice Smith)
  profileImageUrl?: string;        // Profile picture URL

  // Metadata (actually used)
  userType?: string;               // admin, user, etc.
  authProvider: 'farcaster' | 'web3auth' | 'external_wallet' | 'walletconnect' | 'unknown';
}

// Simplified auth context - only what's actually used
export interface SimpleAuthContextType {
  // Most common properties
  user: AuthUser | null;
  isLoading: boolean;

  // Less common but used
  isConnected: boolean;
  error: string | null;

  // Auth methods that are actually used
  connect?: (loginHint?: string) => Promise<void>;
  connectWithAdapter?: (adapter: string, loginHint?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  refreshUserData?: () => Promise<void>;
  hasVisitedBefore: () => boolean;

  // Direct ethers access (for advanced usage)
  getEthersProvider?: () => Promise<any>;

  // Wallet services access (for wallet management)
  showWalletUI?: () => Promise<void>;

  // Deprecated methods - throw errors directing to useSimpleEthers
  fundContract?: (...args: any[]) => Promise<any>;
  claimFunds?: (...args: any[]) => Promise<any>;
  raiseDispute?: (...args: any[]) => Promise<any>;
}