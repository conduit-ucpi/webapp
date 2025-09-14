import { ethers } from 'ethers';
import { AuthProvider, AuthResult } from './types';
import { ExternalWalletProvider } from '@/lib/wallet/external-wallet-provider';

/**
 * External wallet implementation of AuthProvider
 * Handles MetaMask and other external wallet authentication via signature tokens
 */
export class ExternalWalletAuthProvider implements AuthProvider {
  private walletProvider: ExternalWalletProvider | null = null;
  private _isConnected: boolean = false;
  private userInfo: any = null;

  getProviderName(): string {
    return 'External Wallet';
  }

  async initialize(): Promise<void> {
    // Check if MetaMask is available
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        this.walletProvider = new ExternalWalletProvider((window as any).ethereum);
        // Check if already connected
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_accounts' 
        });
        if (accounts && accounts.length > 0) {
          this._isConnected = true;
          this.userInfo = { walletAddress: accounts[0] };
        }
      } catch (error) {
        console.warn('Failed to initialize external wallet:', error);
      }
    }
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  getUserInfo(): any {
    return this.userInfo;
  }

  hasVisitedBefore(): boolean {
    try {
      const visited = localStorage.getItem('conduit-external-wallet-visited');
      return !!visited;
    } catch (error) {
      console.warn('localStorage not available:', error);
      return false;
    }
  }

  markAsVisited(): void {
    try {
      localStorage.setItem('conduit-external-wallet-visited', 'true');
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }

  /**
   * Generate a cryptographic nonce for the authentication message
   */
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create the authentication message that will be signed
   */
  private createAuthMessage(walletAddress: string, timestamp: number, nonce: string): string {
    return `Authenticate wallet ${walletAddress} at ${timestamp} with nonce ${nonce}`;
  }

  /**
   * Generate a signature token according to backend requirements
   */
  private async generateSignatureToken(walletAddress: string, signature: string): Promise<string> {
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const message = this.createAuthMessage(walletAddress, timestamp, nonce);

    const tokenData = {
      type: "signature_auth",
      walletAddress: walletAddress.toLowerCase(),
      message: message,
      signature: signature,
      timestamp: timestamp,
      nonce: nonce,
      issuer: "web3auth_external_wallet",
      header: { 
        alg: "ECDSA", 
        typ: "SIG" 
      },
      payload: { 
        sub: walletAddress.toLowerCase(),
        iat: Math.floor(timestamp / 1000),
        iss: "web3auth_external_wallet",
        wallet_type: "external"
      }
    };

    // Convert to base64-encoded JSON
    const jsonString = JSON.stringify(tokenData);
    const base64Token = btoa(jsonString);
    
    console.log('Generated signature token:', {
      tokenData,
      jsonString,
      base64Token
    });

    return base64Token;
  }

  async connect(): Promise<AuthResult> {
    if (!this.walletProvider) {
      throw new Error('No external wallet provider available. Please install MetaMask or another compatible wallet.');
    }

    try {
      console.log('External wallet connecting...');

      // Request wallet connection
      await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      });

      // Get wallet address
      const walletAddress = await this.walletProvider.getAddress();
      console.log('Connected wallet address:', walletAddress);

      // Create authentication message
      const timestamp = Date.now();
      const nonce = this.generateNonce();
      const message = this.createAuthMessage(walletAddress, timestamp, nonce);

      console.log('Requesting signature for message:', message);

      // Request signature from wallet
      const signature = await this.walletProvider.signMessage(message);
      console.log('Signature received:', signature);

      // Generate signature token
      const signatureToken = await this.generateSignatureToken(walletAddress, signature);

      // Update connection state
      this._isConnected = true;
      this.userInfo = { walletAddress };

      return {
        idToken: signatureToken,
        walletAddress,
        walletProvider: this.walletProvider
      };

    } catch (error) {
      console.error('External wallet connection error:', error);
      
      // Handle user rejection
      if ((error as any).code === 4001) {
        throw new Error('User rejected the connection request');
      }
      
      // Handle signature rejection
      if ((error as any).code === -32603 || 
          (error as any).message?.includes('User denied') ||
          (error as any).message?.includes('User rejected')) {
        throw new Error('User rejected the signature request');
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Clear connection state
      this._isConnected = false;
      this.userInfo = null;
      this.walletProvider = null;

      // Clear any stored data
      try {
        localStorage.removeItem('conduit-external-wallet-visited');
      } catch (e) {
        console.warn('Failed to clear localStorage:', e);
      }

      console.log('External wallet disconnected');
    } catch (error) {
      console.error('External wallet disconnect error:', error);
      throw error;
    }
  }
}