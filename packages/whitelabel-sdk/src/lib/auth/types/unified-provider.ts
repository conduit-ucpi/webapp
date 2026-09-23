/**
 * Unified provider interface that all wallet/auth providers must implement
 * This consolidates AuthProvider and WalletProvider into a single interface
 */

import { ethers } from 'ethers';

/**
 * Transaction request parameters
 */
export interface TransactionRequest {
  from?: string;
  to: string;
  data: string;
  value?: string;
  gasLimit?: string | bigint;
  gasPrice?: string | bigint;
  nonce?: string | number;
  chainId?: number;
}

/**
 * Provider capabilities - what operations the provider supports
 */
export type ConnectionMode = 'default' | 'wallet-only' | 'social-only';

/** What to put in the connected wallet, in whole tokens as a decimal string ("15" = 15 USDC). */
export interface FundWalletRequest {
  amount: string;
  asset: 'USDC' | 'native-currency' | { erc20: string };
  chainId: number;
}

export interface FundWalletResult {
  status: 'completed' | 'cancelled';
  transactionHash?: string;
}

export interface ProviderCapabilities {
  canSign: boolean;
  canTransact: boolean;
  canSwitchWallets: boolean;
  isAuthOnly: boolean;
}

/**
 * Provider connection result
 */
export interface ConnectionResult {
  success: boolean;
  address?: string;
  error?: string;
  /** User dismissed the connect modal without choosing - not a failure to report. */
  cancelled?: boolean;
  capabilities: ProviderCapabilities;
}

/**
 * Unified provider interface - combines auth and wallet functionality
 */
export interface UnifiedProvider {
  // Identity
  getProviderName(): string;

  // Lifecycle
  initialize(): Promise<void>;
  connect(): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Ethereum provider access (returns cached instance)
  getEthersProvider(): ethers.BrowserProvider | null;

  // Ethereum provider access - async version that ensures provider is ready
  // Use this when you need to guarantee the provider is initialized (e.g., after page refresh)
  getEthersProviderAsync(): Promise<ethers.BrowserProvider | null>;

  // Wallet operations (may throw if not supported)
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTransaction(params: TransactionRequest): Promise<string>;

  // Capabilities
  getCapabilities(): ProviderCapabilities;

  // Optional: Wallet switching (not all providers support this)
  switchWallet?(): Promise<ConnectionResult>;

  // Optional: narrow what the connect UI offers — external wallets only, embedded (email /
  // social) only, or everything. The choice cards set this BEFORE connect(), so it is
  // delivered to whichever provider getBestProvider() will pick, not to a named one.
  //
  // ⚠️ THIS USED TO LIVE IN THE REOWN ADAPTER, and AuthManager reached it with
  //    getProvider('walletconnect'). Any other provider's implementation was therefore never
  //    called: the cards rendered, the user chose, nothing changed, nothing failed.
  setConnectionMode?(mode: ConnectionMode): Promise<void>;

  // Optional: put money in the wallet through the provider's own on-ramp (card, exchange,
  // transfer). Present only where the provider offers one; the UI shows the option when it is.
  fundWallet?(request: FundWalletRequest): Promise<FundWalletResult>;

  // Optional: let the user take the wallet's private key away (embedded wallets only). The
  // provider shows the key in its own isolated UI; this app never sees it.
  canExportWallet?(): boolean;
  exportWallet?(): Promise<void>;

  // Optional: Manual authentication request (fallback for when auto-auth fails)
  requestAuthentication?(): Promise<boolean>;

  // Optional: User info (for social logins)
  getUserInfo?(): Record<string, unknown> | null;

  // Optional: subscribe to async connection changes (e.g. AppKit finishing
  // its persisted-session restore after restoreSession() has already run).
  // Returns an unsubscribe function. AuthManager uses this to update state
  // when the wallet reconnects asynchronously on cold load.
  onConnectionChange?(
    callback: (info: { isConnected: boolean; address: string | null }) => void
  ): () => void;
}


/**
 * Auth state for React context
 */
export interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  address: string | null;
  providerName: string | null;
  capabilities: ProviderCapabilities | null;
  error: string | null;
}

/**
 * Auth user from backend
 */
export interface AuthUser {
  userId: string;
  email?: string;
  walletAddress: string;
  userType?: string;
}