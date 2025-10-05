/**
 * Web3Auth provider implementation
 * Handles Web3Auth Modal with all adapters (social + wallet connections)
 */

import { Web3Auth } from "@web3auth/modal";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { AuthProvider, AuthState, AuthConfig } from '../types';
import { TokenManager } from '../core/TokenManager';
import { ethers } from "ethers";

export class Web3AuthProvider implements AuthProvider {
  private web3authInstance: Web3Auth | null = null;
  private config: AuthConfig;
  private tokenManager: TokenManager;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenManager = TokenManager.getInstance();
  }

  getProviderName(): string {
    return 'web3auth';
  }

  async initialize(): Promise<void> {
    console.log('🔧 Web3AuthProvider: Initialize called');
    // Don't pre-initialize to save resources - lazy load when needed
  }

  async connect(): Promise<any> {
    console.log('🔧 Web3AuthProvider: Connect called - initializing Web3Auth modal with all adapters');

    try {
      // Initialize Web3Auth if not already done
      if (!this.web3authInstance) {
        console.log('🔧 Web3AuthProvider: Creating Web3Auth instance');
        const web3authConfig = createWeb3AuthConfig({
          ...this.config,
          walletConnectProjectId: this.config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
        });

        this.web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);

        // Initialize Web3Auth Modal
        console.log('🔧 Web3AuthProvider: Initializing Web3Auth');
        await this.web3authInstance.init();
        console.log('🔧 Web3AuthProvider: Web3Auth initialized successfully');
      }

      // Connect - this will show the modal with all options
      console.log('🔧 Web3AuthProvider: Opening Web3Auth modal');
      const provider = await this.web3authInstance.connect();

      if (!provider) {
        throw new Error('No provider returned from Web3Auth');
      }

      console.log('🔧 Web3AuthProvider: Connected, getting user info');

      // Get user info and determine auth method
      const user = await this.web3authInstance.getUserInfo();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      let authToken: string;

      // Check if this is a social login (has email) or wallet connection
      if (user.email || user.idToken) {
        // Social login - use the idToken
        console.log('🔧 Web3AuthProvider: Social login detected, using idToken');
        authToken = user.idToken || `social:${address}`;
      } else {
        // Wallet connection - generate signature auth token
        console.log('🔧 Web3AuthProvider: Wallet connection detected, generating signature');
        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substring(2, 15);
        const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`;
        const signature = await signer.signMessage(message);

        authToken = btoa(JSON.stringify({
          type: 'signature_auth',
          walletAddress: address,
          message,
          signature,
          timestamp,
          nonce,
          issuer: 'web3auth_unified',
          header: {
            alg: 'ECDSA',
            typ: 'SIG'
          },
          payload: {
            sub: address,
            iat: Math.floor(timestamp / 1000), // Convert to seconds
            iss: 'web3auth_unified',
            wallet_type: 'external'
          }
        }));
      }

      // Store token
      this.tokenManager.setToken(authToken);

      console.log('🔧 Web3AuthProvider: ✅ Successfully connected and authenticated');
      return provider;

    } catch (error) {
      console.error('🔧 Web3AuthProvider: Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔧 Web3AuthProvider: Disconnecting');

    if (this.web3authInstance) {
      await this.web3authInstance.logout();
      this.web3authInstance = null;
    }

    this.tokenManager.clearToken();
  }

  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.web3authInstance?.provider) {
      throw new Error('No provider available for signing');
    }

    const ethersProvider = new ethers.BrowserProvider(this.web3authInstance.provider);
    const signer = await ethersProvider.getSigner();
    return await signer.signMessage(message);
  }

  async getEthersProvider(): Promise<any> {
    if (!this.web3authInstance?.provider) {
      return null;
    }
    return new ethers.BrowserProvider(this.web3authInstance.provider);
  }

  hasVisitedBefore(): boolean {
    try {
      return !!localStorage.getItem('conduit-has-visited');
    } catch {
      return false;
    }
  }

  markAsVisited(): void {
    try {
      localStorage.setItem('conduit-has-visited', 'true');
    } catch {}
  }

  isReady: boolean = true;

  getState(): AuthState {
    return {
      user: null, // Will be populated by backend after auth
      token: this.getToken(),
      isConnected: !!this.web3authInstance?.connected,
      isLoading: false,
      isInitialized: true,
      error: null,
      providerName: 'web3auth'
    };
  }

  isConnected(): boolean {
    return !!this.web3authInstance?.connected;
  }

  getUserInfo(): any {
    return this.web3authInstance?.getUserInfo() || null;
  }
}