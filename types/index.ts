import { Web3Auth } from "@web3auth/modal";

export interface Config {
  web3AuthClientId: string;
  web3AuthNetwork: string;
  chainId: number;
  rpcUrl: string;
  usdcContractAddress: string;
  moonPayApiKey: string;
  onramperApiKey?: string;
  minGasWei: string;
  basePath: string;
  snowtraceBaseUrl: string;
  serviceLink: string;
  // Optional wallet services configuration
  walletServicesShowWidget?: string;
  walletServicesButtonPosition?: string;
  walletServicesEnableKeyExport?: string;
  walletServicesHideTopup?: string;
}

export interface User {
  userId: string;
  email: string;
  walletAddress: string;
  userType?: string;
}

export interface Contract {
  contractAddress: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  expiryTimestamp: number;
  description: string;
  status: 'PENDING' | 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
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
    id: string;
    content: string;
    addedBy: string;
    addedAt: number;
  }>;
  // Blockchain query status and error information
  blockchainQueryError?: string;
  hasDiscrepancy?: boolean;
  discrepancyDetails?: string[];
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
  // Admin notes array from contract service
  adminNotes?: Array<{
    id: string;
    content: string;
    addedBy: string;
    addedAt: number;
  }>;
}

export interface CreateContractRequest {
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
  contractAddress: string;
  userWalletAddress: string;
  signedTransaction: string;
  buyerEmail?: string;
  sellerEmail?: string;
  payoutDateTime: string;
  amount?: string;
  currency?: string;
  contractDescription?: string;
  productName?: string;
  serviceLink?: string;
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

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (idToken: string, walletAddress: string, provider: any) => Promise<void>;
  logout: () => Promise<void>;
}

export interface Web3AuthInstanceContextType {
  web3authInstance: Web3Auth | null;
  web3authProvider: any | null;
  isLoading: boolean;
  onLogout: () => Promise<void>;
  updateProvider?: (provider: any) => void;
}

export interface ConfigContextType {
  config: Config | null;
  isLoading: boolean;
}