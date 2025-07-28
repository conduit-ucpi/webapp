export interface Config {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  usdcContractAddress: string;
  moonPayApiKey: string;
  minGasWei: string;
}

export interface User {
  userId: string;
  email: string;
  walletAddress: string;
}

export interface Contract {
  contractAddress: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  expiryTimestamp: number;
  description: string;
  status: 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'DISPUTED' | 'RESOLVED' | 'CLAIMED';
  createdAt: number;
  funded?: boolean;
  fundedAt?: string;
  disputedAt?: string;
  resolvedAt?: string;
  claimedAt?: string;
  // Optional email fields from contract service
  buyerEmail?: string;
  sellerEmail?: string;
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
  createdAt: string;
  createdBy: string;
}

export interface CreateContractRequest {
  buyer: string;
  seller: string;
  amount: string;
  expiryTimestamp: number;
  description: string;
}

export interface CreatePendingContractRequest {
  buyerEmail: string;
  amount: number;
  description: string;
  expiryTimestamp: number;
}

export interface AuthContextType {
  user: User | null;
  provider: any | null;
  isLoading: boolean;
  login: (idToken: string, walletAddress: string, provider: any) => Promise<void>;
  logout: () => Promise<void>;
}

export interface ConfigContextType {
  config: Config | null;
  isLoading: boolean;
}