/**
 * Unified blockchain provider wrapper
 * Abstracts away the underlying provider type (Web3Auth, WalletConnect, etc.)
 */

import { ethers } from 'ethers';
import { WalletProvider } from '../types';

export class ProviderWrapper {
  private ethersProvider: ethers.BrowserProvider | null = null;
  private rawProvider: any = null;
  private providerType: string = 'unknown';

  constructor(rawProvider: any, providerType: string = 'unknown') {
    this.rawProvider = rawProvider;
    this.providerType = providerType;

    if (rawProvider) {
      try {
        this.ethersProvider = new ethers.BrowserProvider(rawProvider);
      } catch (error) {
        console.warn('🔧 ProviderWrapper: Failed to create ethers provider:', error);
      }
    }
  }

  /**
   * Get the ethers.js provider
   */
  getEthersProvider(): ethers.BrowserProvider | null {
    return this.ethersProvider;
  }

  /**
   * Get the raw provider (for direct access if needed)
   */
  getRawProvider(): any {
    return this.rawProvider;
  }

  /**
   * Get provider type
   */
  getProviderType(): string {
    return this.providerType;
  }

  /**
   * Get a signer for transactions
   */
  async getSigner(): Promise<ethers.Signer | null> {
    if (!this.ethersProvider) {
      return null;
    }

    try {
      return await this.ethersProvider.getSigner();
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to get signer:', error);
      return null;
    }
  }

  /**
   * Get the wallet address
   */
  async getAddress(): Promise<string | null> {
    const signer = await this.getSigner();
    if (!signer) {
      return null;
    }

    try {
      return await signer.getAddress();
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to get address:', error);
      return null;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    const signer = await this.getSigner();
    if (!signer) {
      throw new Error('No signer available');
    }

    return await signer.signMessage(message);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(transaction: any): Promise<ethers.TransactionResponse> {
    const signer = await this.getSigner();
    if (!signer) {
      throw new Error('No signer available');
    }

    return await signer.sendTransaction(transaction);
  }

  /**
   * Get network information
   */
  async getNetwork(): Promise<ethers.Network | null> {
    if (!this.ethersProvider) {
      return null;
    }

    try {
      return await this.ethersProvider.getNetwork();
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to get network:', error);
      return null;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address?: string): Promise<bigint | null> {
    if (!this.ethersProvider) {
      return null;
    }

    try {
      const targetAddress = address || await this.getAddress();
      if (!targetAddress) {
        return null;
      }

      return await this.ethersProvider.getBalance(targetAddress);
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to get balance:', error);
      return null;
    }
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(chainId: number): Promise<boolean> {
    if (!this.rawProvider?.request) {
      return false;
    }

    try {
      const chainIdHex = `0x${chainId.toString(16)}`;

      await this.rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });

      return true;
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to switch network:', error);
      return false;
    }
  }

  /**
   * Add event listener to raw provider
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (this.rawProvider?.on) {
      this.rawProvider.on(event, listener);
    }
  }

  /**
   * Remove event listener from raw provider
   */
  off(event: string, listener: (...args: any[]) => void): void {
    if (this.rawProvider?.off) {
      this.rawProvider.off(event, listener);
    }
  }

  /**
   * Check if provider is connected
   */
  isConnected(): boolean {
    return !!this.ethersProvider && !!this.rawProvider;
  }

  /**
   * Disconnect the provider
   */
  async disconnect(): Promise<void> {
    if (this.rawProvider?.disconnect) {
      try {
        await this.rawProvider.disconnect();
      } catch (error) {
        console.warn('🔧 ProviderWrapper: Disconnect error:', error);
      }
    }

    this.ethersProvider = null;
    this.rawProvider = null;
  }

  /**
   * Create a contract instance
   */
  async getContract(address: string, abi: any): Promise<ethers.Contract | null> {
    const signer = await this.getSigner();
    if (!signer) {
      return null;
    }

    try {
      return new ethers.Contract(address, abi, signer);
    } catch (error) {
      console.error('🔧 ProviderWrapper: Failed to create contract:', error);
      return null;
    }
  }
}