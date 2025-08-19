/**
 * Abstract wallet provider interface
 * This allows different wallet providers (Web3Auth, Farcaster, etc.) to be used interchangeably
 */

export interface WalletProvider {
  /**
   * Get the wallet address
   */
  getAddress(): Promise<string>;

  /**
   * Sign a transaction
   */
  signTransaction(params: TransactionRequest): Promise<string>;

  /**
   * Sign a message (for authentication or other purposes)
   */
  signMessage(message: string): Promise<string>;

  /**
   * Request method for raw RPC calls
   */
  request(args: { method: string; params?: any[] }): Promise<any>;

  /**
   * Check if the wallet is connected
   */
  isConnected(): boolean;

  /**
   * Get the provider name for debugging/display
   */
  getProviderName(): string;

  /**
   * Get the underlying provider (for ethers.js compatibility)
   */
  getEthersProvider(): any;
}

export interface TransactionRequest {
  from?: string;
  to: string;
  data: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  nonce?: string | number;
  chainId?: number;
}

export interface WalletContextType {
  walletProvider: WalletProvider | null;
  isConnected: boolean;
  address: string | null;
  connectWallet: (provider: WalletProvider) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isLoading: boolean;
}