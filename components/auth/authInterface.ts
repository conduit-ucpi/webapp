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
  authProvider: 'farcaster' | 'web3auth' | 'external_wallet' | 'unknown';
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

// Contract transaction parameters
export interface ContractTransactionParams {
  contractAddress: string;
  abi: any[];
  functionName: string;
  functionArgs: any[];
  debugLabel?: string;
}

// Contract funding parameters
export interface ContractFundingParams {
  contract: {
    id: string;
    amount: number;
    currency?: string;
    sellerAddress: string;
    expiryTimestamp: number;
    description: string;
    buyerEmail?: string;
    sellerEmail?: string;
  };
  userAddress: string;
  config: {
    usdcContractAddress: string;
    serviceLink: string;
    rpcUrl: string;
  };
  utils: {
    toMicroUSDC?: (amount: number) => number;
    toUSDCForWeb3?: (amount: number, currency?: string) => string;
    formatDateTimeWithTZ?: (timestamp: number) => string;
  };
  onStatusUpdate?: (step: string, message: string) => void;
}

// Contract funding result
export interface ContractFundingResult {
  contractAddress: string;
  approvalTxHash: string;
  depositTxHash: string;
}

export interface AuthMethods {
  // Core authentication
  connect: (loginHint?: string) => Promise<void>;
  connectWithAdapter?: (adapter: string, loginHint?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Token management
  getToken: () => string | null;
  refreshToken?: () => Promise<string | null>;
  
  // Wallet operations
  signMessage: (message: string) => Promise<string>;
  getEthersProvider: () => any; // Returns ethers provider for SDK integration
  getUSDCBalance: (userAddress?: string) => Promise<string>;
  signContractTransaction: (params: ContractTransactionParams) => Promise<string>;
  waitForTransaction?: (transactionHash: string, maxWaitTime?: number) => Promise<void>;
  
  // High-level contract operations
  createContract?: (contract: ContractFundingParams['contract'], userAddress: string, config: ContractFundingParams['config'], utils: ContractFundingParams['utils']) => Promise<string>;
  approveUSDC?: (contractAddress: string, amount: number, currency: string | undefined, userAddress: string, config: ContractFundingParams['config'], utils: ContractFundingParams['utils']) => Promise<string>;
  depositFunds?: (params: ContractFundingParams & { contractAddress: string }) => Promise<string>;
  fundContract?: (params: ContractFundingParams) => Promise<ContractFundingResult>;
  claimFunds?: (contractAddress: string, userAddress: string) => Promise<string>;
  raiseDispute?: (params: {
    contractAddress: string;
    userAddress: string;
    reason: string;
    refundPercent: number;
    // Contract data for database updates and email notifications
    contract?: any;
    // Configuration and utilities for email processing
    config?: any;
    utils?: any;
  }) => Promise<string>;
  
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
  getUSDCBalance(userAddress?: string): Promise<string>;
  signContractTransaction(params: any): Promise<string>;
  waitForTransaction?(transactionHash: string, maxWaitTime?: number): Promise<void>;
  
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