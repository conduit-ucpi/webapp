import { ethers } from 'ethers';
import { WalletProvider, TransactionRequest } from './types';

/**
 * Example Farcaster implementation of WalletProvider
 * This shows how you can add support for different providers
 */
interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  verifications?: string[];
  custody?: string;
}

export class FarcasterWalletProvider implements WalletProvider {
  private signerAddress: string;
  private signer: any; // This would be your Farcaster signer
  private rpcProvider: ethers.JsonRpcProvider;
  private farcasterUser: FarcasterUser | null = null;

  constructor(signerAddress: string, signer: any, rpcUrl: string, farcasterUser?: FarcasterUser) {
    this.signerAddress = signerAddress;
    this.signer = signer;
    this.rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.farcasterUser = farcasterUser || null;
  }

  async getAddress(): Promise<string> {
    return this.signerAddress;
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    // For Farcaster, you'd implement signing using their SDK
    // This is just a placeholder showing the interface
    
    const tx = ethers.Transaction.from({
      to: params.to,
      data: params.data,
      value: params.value || '0x0',
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      nonce: typeof params.nonce === 'string' ? parseInt(params.nonce, 16) : params.nonce,
      chainId: params.chainId,
      type: 0
    });

    // Use Farcaster's signing method here
    // const signature = await this.signer.signTransaction(tx);
    
    throw new Error('Farcaster signing not yet implemented');
  }

  async signMessage(message: string): Promise<string> {
    // Use Farcaster's message signing
    throw new Error('Farcaster message signing not yet implemented');
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    // For Farcaster, you might proxy these to a JSON-RPC provider
    // or handle them through their SDK
    return this.rpcProvider.send(args.method, args.params || []);
  }

  isConnected(): boolean {
    return !!this.signer && !!this.signerAddress;
  }

  getProviderName(): string {
    return 'Farcaster';
  }

  getEthersProvider(): ethers.JsonRpcProvider {
    return this.rpcProvider;
  }

  // Farcaster-specific methods
  getFarcasterUser(): FarcasterUser | null {
    return this.farcasterUser;
  }

  setFarcasterUser(user: FarcasterUser): void {
    this.farcasterUser = user;
  }
}