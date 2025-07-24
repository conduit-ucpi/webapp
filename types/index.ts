export interface Config {
  web3AuthClientId: string;
  chainId: number;
  rpcUrl: string;
  usdcContractAddress: string;
  moonPayApiKey: string;
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
  amount: string;
  expiryTimestamp: number;
  description: string;
  status: 'active' | 'expired' | 'disputed' | 'resolved' | 'completed';
  createdAt: number;
}

export interface CreateContractRequest {
  sellerAddress: string;
  amount: string;
  expiryTimestamp: number;
  description: string;
  signedTransaction: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (idToken: string, walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface ConfigContextType {
  config: Config | null;
  isLoading: boolean;
}