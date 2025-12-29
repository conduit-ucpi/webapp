/**
 * Token details fetched from blockchain
 */
export interface TokenDetails {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface Config {
  chainId: number;
  rpcUrl: string;
  usdcContractAddress: string;
  usdtContractAddress?: string;
  contractAddress?: string;
  contractFactoryAddress?: string;
  userServiceUrl?: string;
  chainServiceUrl?: string;
  contractServiceUrl?: string;
  moonPayApiKey: string;
  minGasWei: string;
  maxGasPriceGwei: string;
  maxGasCostGwei: string;
  usdcGrantFoundryGas: string;
  depositFundsFoundryGas: string;
  gasPriceBuffer: string;
  basePath: string;
  explorerBaseUrl: string;
  serviceLink: string;
  neynarApiKey?: string;
  walletConnectProjectId?: string;
  tokenSymbol?: string; // Token symbol (e.g., "USDC", "USDT", "DAI")
  defaultTokenSymbol?: string; // Default token symbol to use
  siteName?: string; // Site branding name (e.g., "Instant Escrow", "USDCBAY")
  // Token details from blockchain
  usdcDetails?: TokenDetails | null;
  usdtDetails?: TokenDetails | null;
  primaryToken?: TokenDetails | null;
  // Optional wallet services configuration
  walletServicesShowWidget?: string;
  walletServicesButtonPosition?: string;
  walletServicesEnableKeyExport?: string;
  walletServicesHideTopup?: string;
  // Build information
  gitTag?: string;
  gitSha?: string;
  buildVersion?: string;
}

export interface ConfigContextType {
  config: Config | null;
  isLoading: boolean;
}

export interface User {
  userId: string;
  email: string;
  walletAddress: string;
  userType?: string;
}

export interface Contract {
  id?: string; // Database ID from contract service
  contractAddress: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  expiryTimestamp: number;
  description: string;
  status: 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED' | 'ERROR' | 'UNKNOWN' | 'AWAITING_FUNDING' | 'PENDING' | 'CREATED';
  createdAt: number;
  funded?: boolean;
  fundedAt?: string;
  disputedAt?: string;
  resolvedAt?: string;
  claimedAt?: string;
  // Optional email fields from contract service
  buyerEmail?: string;
  sellerEmail?: string;
  // Optional notes field from contract service (used for dispute resolution)
  notes?: string;
  // Admin notes array from contract service
  adminNotes?: Array<{
    note: string;
    createdBy: string;
    timestamp: number;
  }>;
  // Disputes array for audit trail
  disputes?: Array<{
    reason: string;
    refundPercent: number | null;
    userEmail: string;
    timestamp: number;
  }>;
  // Product name from contract service
  productName?: string;
  // Blockchain query status and error information
  blockchainQueryError?: string;
  hasDiscrepancy?: boolean;
  discrepancyDetails?: string[];
  // Backend-provided computed status (replaces client-side status computation)
  backendStatus?: string;
  // Raw blockchain status for reference
  blockchainStatus?: string;
  // Backend-provided CTA fields for consistent UI behavior
  ctaType?: string;
  ctaLabel?: string;
  ctaVariant?: string;
}

export interface PendingContract {
  id: string;
  sellerEmail: string;
  buyerEmail?: string;
  amount: number;
  currency: string;
  sellerAddress: string;
  expiryTimestamp: number;
  chainId?: string;
  chainAddress?: string;
  description: string;
  createdAt: number;
  createdBy: string;
  state: 'OK' | 'IN-PROCESS';
  // Backend-provided status for pending contracts
  status?: 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED' | 'ERROR' | 'UNKNOWN' | 'AWAITING_FUNDING' | 'PENDING' | 'CREATED';
  // Admin notes array from contract service
  adminNotes?: Array<{
    id: string;
    content: string;
    addedBy: string;
    addedAt: number;
  }>;
  // Backend-provided CTA fields for consistent UI behavior
  ctaType?: string;
  ctaLabel?: string;
  ctaVariant?: string;
}

export interface CreateContractRequest {
  contractserviceId: string;
  tokenAddress: string;
  buyer: string;
  seller: string;
  amount: string;
  expiryTimestamp: number;
  description: string;
  serviceLink?: string;
}

export interface CreatePendingContractRequest {
  buyerEmail: string;
  amount: number;
  description: string;
  expiryTimestamp: number;
  serviceLink?: string;
}

export interface RaiseDisputeRequest {
  databaseId?: string; // Database ID from contract service
  contractAddress: string;
  userWalletAddress: string;
  signedTransaction: string;
  reason?: string;
  refundPercent?: number;
}

export interface ResolveDisputeRequest {
  buyerPercentage: number;
  sellerPercentage: number;
  resolutionNote: string;
  chainAddress?: string;
  buyerEmail?: string;
  sellerEmail?: string;
  amount?: string;
  currency?: string;
  contractDescription?: string;
  payoutDateTime?: string;
  buyerActualAmount?: string;
  sellerActualAmount?: string;
  serviceLink?: string;
}

export interface SubmitDisputeEntryRequest {
  timestamp: number;
  reason: string;
  refundPercent: number;
}

export interface TransferUSDCRequest {
  recipientAddress: string;
  amount: string; // in USDC (not microUSDC)
  userWalletAddress: string;
  signedTransaction: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (idToken: string, walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  connect: () => Promise<void>; // Unified connect method that handles wallet connection + login
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface ConfigContextType {
  config: Config | null;
  isLoading: boolean;
}

export interface FarcasterAuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (farcasterToken: string, walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
}