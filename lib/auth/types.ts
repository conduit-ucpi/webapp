/**
 * Unified authentication types for the reorganized auth system
 */

// Core user and auth state types
export interface AuthUser {
  userId: string;
  email?: string;
  walletAddress: string;
  userType?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  providerName: string;
}

// Auth operation results
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  provider?: any;
  error?: string;
}

export interface BackendAuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// Wallet provider interface
export interface WalletProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  off?: (event: string, callback: (...args: any[]) => void) => void;
  disconnect?: () => Promise<void>;
}

// Core auth provider interface
export interface AuthProvider {
  getProviderName(): string;
  initialize(): Promise<void>;
  connect(): Promise<any>;
  disconnect(): Promise<void>;
  switchWallet(): Promise<any>;
  getToken(): string | null;
  signMessage(message: string): Promise<string>;
  getEthersProvider(): Promise<any>;
  hasVisitedBefore(): boolean;
  markAsVisited(): void;
  isReady: boolean;
  getState(): AuthState;
  isConnected(): boolean;
  getUserInfo(): any;
}

// Configuration types
export interface AuthConfig {
  web3AuthClientId: string;
  dynamicEnvironmentId?: string; // Dynamic.xyz environment ID
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  web3AuthNetwork: string;
  walletConnectProjectId?: string;
}

export type ProviderType = 'farcaster' | 'dynamic';

// React context types
export interface AuthContextType {
  authProvider: AuthProvider | null;
  isConnected: boolean;
  isConnecting: boolean;
  userInfo: any;
  connectAuth: () => Promise<AuthResult>;
  disconnectAuth: () => Promise<void>;
  hasVisitedBefore: boolean;
}

// Legacy types for backward compatibility during migration
export interface LegacyAuthResult {
  idToken: string;
  walletAddress: string;
  walletProvider: WalletProvider;
}