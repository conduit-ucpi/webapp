/**
 * Unified authentication interface for all auth providers
 * This defines the contract that both Web3Auth and Farcaster auth implementations must fulfill
 */

export interface AuthUser {
  // Core identity
  userId: string;
  walletAddress: string;
  email?: string;
  
  // Provider-specific identifiers
  fid?: number;                    // Farcaster ID
  web3authUserId?: string;         // Web3Auth user ID
  
  // Profile information
  username?: string;               // Handle/username (@alice)
  displayName?: string;            // Display name (Alice Smith)
  profileImageUrl?: string;        // Profile picture URL
  ensName?: string;                // ENS name if available
  
  // Metadata
  userType?: string;               // admin, user, etc.
  authProvider: 'farcaster' | 'web3auth' | 'unknown';
}

export interface AuthState {
  // User data
  user: AuthUser | null;
  
  // Authentication tokens
  token: string | null;            // JWT or auth token
  idToken?: string;                // ID token if available
  
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Error handling
  error: string | null;
  
  // Provider info
  providerName: string;
}

export interface AuthMethods {
  // Core authentication
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Token management
  getToken: () => string | null;
  refreshToken?: () => Promise<string | null>;
  
  // Wallet operations
  signMessage: (message: string) => Promise<string>;
  getEthersProvider: () => any; // Returns ethers provider for SDK integration
  
  // Backend API helpers
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  
  // State checks
  hasVisitedBefore: () => boolean;
  markAsVisited: () => void;
}

export interface AuthContextType extends AuthState, AuthMethods {}

/**
 * Unified auth result returned by providers
 */
export interface AuthResult {
  user: AuthUser;
  token: string;
}


/**
 * Events that auth providers can emit
 */
export type AuthEvent = 
  | { type: 'connecting' }
  | { type: 'connected'; user: AuthUser; token: string }
  | { type: 'disconnected' }
  | { type: 'error'; error: string }
  | { type: 'tokenRefreshed'; token: string };

/**
 * Auth provider interface that implementations must satisfy
 */
export interface IAuthProvider {
  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;
  
  // Authentication
  connect(): Promise<AuthResult>;
  disconnect(): Promise<void>;
  
  // Token management
  getToken(): string | null;
  refreshToken?(): Promise<string | null>;
  
  // Wallet operations
  signMessage(message: string): Promise<string>;
  getEthersProvider(): any;
  
  // State checks
  hasVisitedBefore(): boolean;
  markAsVisited(): void;
  
  // State
  getState(): AuthState;
  isReady(): boolean;
  
  // Events (optional)
  on?(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void;
  off?(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void;
}