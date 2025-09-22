import { ethers } from 'ethers';
import { WalletProvider, TransactionRequest } from './types';
import { toHexString, ensureHexPrefix } from '@/utils/hexUtils';

/**
 * Web3Auth implementation of WalletProvider
 */
export class Web3AuthWalletProvider implements WalletProvider {
  private web3authProvider: any;
  private ethersProvider: ethers.BrowserProvider;
  private address: string | null = null;

  constructor(web3authProvider: any) {
    this.web3authProvider = web3authProvider;
    this.ethersProvider = new ethers.BrowserProvider(web3authProvider);
  }

  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address;
    }
    
    const accounts = await this.web3authProvider.request({
      method: "eth_accounts"
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available');
    }
    
    if (!accounts[0]) {
      throw new Error('No wallet address found');
    }
    this.address = accounts[0];
    return accounts[0];
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    const fromAddress = params.from || await this.getAddress();
    
    // Build transaction object for Web3Auth
    const txObject = {
      from: fromAddress,
      to: params.to,
      data: params.data,
      value: ensureHexPrefix(params.value || '0'),
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      nonce: params.nonce ? (typeof params.nonce === 'string' ? params.nonce : ensureHexPrefix(params.nonce.toString(16))) : undefined
    };

    // Remove undefined fields
    Object.keys(txObject).forEach(key => {
      if (txObject[key as keyof typeof txObject] === undefined) {
        delete txObject[key as keyof typeof txObject];
      }
    });

    try {
      // Try eth_sign first (avoids modal)
      const tx = ethers.Transaction.from({
        to: params.to,
        data: params.data,
        value: ensureHexPrefix(params.value || '0'),
        gasLimit: params.gasLimit,
        gasPrice: params.gasPrice,
        nonce: typeof params.nonce === 'string' ? parseInt(params.nonce, 16) : params.nonce,
        chainId: params.chainId,
        type: 0  // Legacy transaction
      });
      
      const unsignedTx = tx.unsignedSerialized;
      const txHash = ethers.keccak256(unsignedTx);
      
      const signature = await this.web3authProvider.request({
        method: "eth_sign",
        params: [fromAddress, txHash]
      });
      
      const sig = ethers.Signature.from(signature);
      const signedTx = tx.clone();
      signedTx.signature = sig;
      
      return signedTx.serialized;
    } catch (error) {
      console.warn('eth_sign failed, falling back to eth_signTransaction:', error);
      
      // Fallback to eth_signTransaction (may show modal)
      const signedTx = await this.web3authProvider.request({
        method: "eth_signTransaction",
        params: [txObject]
      });
      
      return signedTx;
    }
  }

  async signMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    
    const signature = await this.web3authProvider.request({
      method: "personal_sign",
      params: [message, address]
    });
    
    return signature;
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    return this.web3authProvider.request(args);
  }

  isConnected(): boolean {
    return !!this.web3authProvider;
  }

  getProviderName(): string {
    return 'Web3Auth';
  }

  getEthersProvider(): ethers.BrowserProvider {
    return this.ethersProvider;
  }
}