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

  // Wallet operations (may throw if not supported)
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTransaction(params: TransactionRequest): Promise<string>;

  // Capabilities
  getCapabilities(): ProviderCapabilities;

  // Optional: Wallet switching (not all providers support this)
  switchWallet?(): Promise<ConnectionResult>;

  // Optional: User info (for social logins)
  getUserInfo?(): Record<string, unknown> | null;
}

/**
 * Provider registry entry
 */
export interface ProviderRegistration {
  name: string;
  provider: UnifiedProvider;
  priority: number; // Lower is higher priority
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