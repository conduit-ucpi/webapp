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
  private cachedEthersProvider: ethers.BrowserProvider | null = null;

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

      // Create and cache the ethers provider (SINGLE INSTANCE)
      this.cachedEthersProvider = new ethers.BrowserProvider(provider);
      console.log('🔧 Web3AuthProvider: Created and cached single ethers provider instance');

      const signer = await this.cachedEthersProvider.getSigner();
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

    // Clear the cached ethers provider
    this.cachedEthersProvider = null;
    console.log('🔧 Web3AuthProvider: Cleared cached ethers provider');

    this.tokenManager.clearToken();
  }

  async switchWallet(): Promise<any> {
    console.log('🔧 Web3AuthProvider: Switching wallet - clearing cache and showing modal');

    // Initialize Web3Auth if not already done
    if (!this.web3authInstance) {
      console.log('🔧 Web3AuthProvider: Creating Web3Auth instance for wallet switch');
      const web3authConfig = createWeb3AuthConfig({
        ...this.config,
        walletConnectProjectId: this.config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
      });

      this.web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);
      await this.web3authInstance.init();
    }

    // Clear any cached connection to force modal selection
    if (this.web3authInstance.connected) {
      console.log('🔧 Web3AuthProvider: Clearing existing connection to force modal');
      await this.web3authInstance.logout();
    }

    // Now connect which will show the modal with all options
    return this.connect();
  }

  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    return await signer.signMessage(message);
  }

  async getEthersProvider(): Promise<any> {
    // Return the cached ethers provider (SINGLE INSTANCE)
    return this.cachedEthersProvider;
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