import { ethers } from 'ethers';
import { WalletProvider, TransactionRequest } from './types';

/**
 * External wallet provider implementation for MetaMask and other EIP-1193 compatible wallets
 */
export class ExternalWalletProvider implements WalletProvider {
  private provider: any;
  private ethersProvider: ethers.BrowserProvider;
  private address: string | null = null;

  constructor(provider: any) {
    if (!provider) {
      throw new Error('No external wallet provider available');
    }
    
    this.provider = provider;
    this.ethersProvider = new ethers.BrowserProvider(provider);
  }

  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address;
    }

    try {
      const signer = await this.ethersProvider.getSigner();
      this.address = await signer.getAddress();
      return this.address;
    } catch (error) {
      console.error('Failed to get address:', error);
      throw new Error('Failed to get wallet address');
    }
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    try {
      const signer = await this.ethersProvider.getSigner();
      
      // Convert params to ethers format
      const txRequest = {
        to: params.to,
        data: params.data,
        value: params.value ? ethers.parseEther(params.value) : 0,
        gasLimit: params.gasLimit,
        gasPrice: params.gasPrice,
        nonce: typeof params.nonce === 'string' ? parseInt(params.nonce, 10) : params.nonce,
      };

      const signedTx = await signer.signTransaction(txRequest);
      return signedTx;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      const signer = await this.ethersProvider.getSigner();
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      
      // Handle user rejection
      if ((error as any).code === 4001 || 
          (error as any).code === -32603 ||
          (error as any).message?.includes('User denied') ||
          (error as any).message?.includes('User rejected')) {
        throw new Error('User rejected the signature request');
      }
      
      throw error;
    }
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    try {
      return await this.provider.request(args);
    } catch (error) {
      console.error('Provider request failed:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.provider && this.provider.isConnected?.() !== false;
  }

  getProviderName(): string {
    // Try to detect the specific wallet type
    if (this.provider.isMetaMask) {
      return 'MetaMask';
    } else if (this.provider.isTrust) {
      return 'Trust Wallet';
    } else if (this.provider.isCoinbaseWallet) {
      return 'Coinbase Wallet';
    } else if (this.provider.isRabby) {
      return 'Rabby Wallet';
    } else {
      return 'External Wallet';
    }
  }

  getEthersProvider(): any {
    return this.ethersProvider;
  }

  /**
   * Check if MetaMask or other compatible wallet is available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).ethereum !== 'undefined';
  }

  /**
   * Get the available external wallet provider
   */
  static async getProvider(): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('No external wallet found. Please install MetaMask or another compatible wallet.');
    }

    const ethereum = (window as any).ethereum;
    
    // Handle multiple wallet providers
    if (ethereum.providers && Array.isArray(ethereum.providers)) {
      // Find MetaMask if available, otherwise use the first provider
      const metamask = ethereum.providers.find((provider: any) => provider.isMetaMask);
      return metamask || ethereum.providers[0];
    }
    
    return ethereum;
  }

  /**
   * Request permission to access accounts
   */
  static async requestAccounts(): Promise<string[]> {
    const provider = await this.getProvider();
    return await provider.request({ method: 'eth_requestAccounts' });
  }

  /**
   * Get currently connected accounts (if any)
   */
  static async getAccounts(): Promise<string[]> {
    const provider = await this.getProvider();
    return await provider.request({ method: 'eth_accounts' });
  }
}