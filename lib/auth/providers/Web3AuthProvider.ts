/**
 * Web3Auth provider implementation
 * Handles Web3Auth Modal with all adapters (social + wallet connections)
 */

import { Web3Auth } from "@web3auth/modal";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { AuthProvider, AuthState, AuthConfig } from '../types';
import { TokenManager } from '../core/TokenManager';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';
import { detectDevice } from '../../../utils/deviceDetection';

export class Web3AuthProvider implements AuthProvider {
  private web3authInstance: Web3Auth | null = null;
  private config: AuthConfig;
  private tokenManager: TokenManager;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private isConnecting: boolean = false;

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
    mLog.info('Web3AuthProvider', 'Connect called - initializing Web3Auth modal with all adapters');

    // Prevent duplicate connection attempts
    if (this.isConnecting) {
      mLog.warn('Web3AuthProvider', 'Connection already in progress, waiting for current attempt');
      // Wait for current connection attempt to finish
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Return current state if connected
      if (this.web3authInstance?.connected && this.web3authInstance?.provider) {
        mLog.info('Web3AuthProvider', 'Using existing connection from previous attempt');
        return this.web3authInstance.provider;
      }
    }

    this.isConnecting = true;
    mLog.debug('Web3AuthProvider', 'Set isConnecting flag to prevent duplicates');

    // Detect device for mobile-specific handling
    const deviceInfo = detectDevice();

    try {
      // Initialize Web3Auth if not already done
      if (!this.web3authInstance) {
        mLog.info('Web3AuthProvider', 'Creating Web3Auth instance');
        const web3authConfig = createWeb3AuthConfig({
          ...this.config,
          walletConnectProjectId: this.config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
        });

        mLog.debug('Web3AuthProvider', 'Config created successfully');

        this.web3authInstance = new Web3Auth(web3authConfig.web3AuthOptions);

        // Initialize Web3Auth Modal (adapters are automatically available in v10)
        mLog.info('Web3AuthProvider', 'Initializing Web3Auth with built-in adapters');
        await this.web3authInstance.init();
        mLog.info('Web3AuthProvider', 'Web3Auth initialized successfully');

        // Log current connection state after init
        mLog.debug('Web3AuthProvider', 'Post-init state check', {
          connected: this.web3authInstance.connected,
          hasProvider: !!this.web3authInstance.provider
        });

        // Force logout on mobile to prevent auto-connection to MetaMask
        if (this.web3authInstance.connected) {
          mLog.warn('Web3AuthProvider', 'Auto-connected detected', {
            isMobile: deviceInfo.isMobile,
            hasProvider: !!this.web3authInstance.provider
          });

          // On mobile, ALWAYS logout to force modal choice and prevent MetaMask auto-selection
          if (deviceInfo.isMobile || this.web3authInstance.provider) {
            mLog.info('Web3AuthProvider', 'Forcing logout to show modal choice (mobile or real connection)');
            try {
              await this.web3authInstance.logout();
              mLog.info('Web3AuthProvider', 'Logged out successfully, will now show modal for user choice');

              // Clear any cached session data
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('Web3Auth-cachedAdapter');
                window.sessionStorage.removeItem('Web3Auth-cachedAdapter');
                mLog.debug('Web3AuthProvider', 'Cleared cached adapter data');
              }
            } catch (logoutError) {
              mLog.warn('Web3AuthProvider', 'Logout failed, continuing anyway', {
                error: logoutError instanceof Error ? logoutError.message : String(logoutError)
              });
            }
          } else {
            mLog.info('Web3AuthProvider', 'False positive connection (desktop, no provider), continuing to modal');
          }
        }
      }

      // On mobile, clear ALL cache to prevent auto-selection
      if (deviceInfo.isMobile && typeof window !== 'undefined') {
        // Clear any Web3Auth session storage that might cause auto-connection
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('web3auth') || key.includes('Web3Auth') || key.includes('openlogin'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          window.localStorage.removeItem(key);
          mLog.debug('Web3AuthProvider', 'Cleared localStorage key', { key });
        });

        // Also clear sessionStorage
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key && (key.includes('web3auth') || key.includes('Web3Auth') || key.includes('openlogin'))) {
            window.sessionStorage.removeItem(key);
            mLog.debug('Web3AuthProvider', 'Cleared sessionStorage key', { key });
          }
        }

        // Clear the specific cached adapter key
        window.localStorage.removeItem('Web3Auth-cachedAdapter');
        window.sessionStorage.removeItem('Web3Auth-cachedAdapter');
        mLog.info('Web3AuthProvider', 'Cleared all Web3Auth cache on mobile');
      }

      // Connect - this will show the modal with all options
      mLog.info('Web3AuthProvider', 'Opening Web3Auth modal');
      const provider = await this.web3authInstance.connect();

      if (!provider) {
        mLog.error('Web3AuthProvider', 'No provider returned from Web3Auth');
        throw new Error('No provider returned from Web3Auth');
      }

      mLog.info('Web3AuthProvider', 'Connected successfully, getting user info');

      // Get user info and determine auth method
      const user = await this.web3authInstance.getUserInfo();
      mLog.debug('Web3AuthProvider', 'User info retrieved', {
        hasEmail: !!user.email,
        hasIdToken: !!user.idToken,
        authMethod: user.email ? 'social' : 'wallet'
      });

      // Create and cache the ethers provider (SINGLE INSTANCE)
      this.cachedEthersProvider = new ethers.BrowserProvider(provider);
      mLog.info('Web3AuthProvider', 'Created and cached single ethers provider instance');

      const signer = await this.cachedEthersProvider.getSigner();
      const address = await signer.getAddress();
      mLog.debug('Web3AuthProvider', 'Got wallet address', { address });

      let authToken: string;

      // Check if this is a social login (has email) or wallet connection
      if (user.email || user.idToken) {
        // Social login - use the idToken
        mLog.info('Web3AuthProvider', 'Social login detected, using idToken');
        authToken = user.idToken || `social:${address}`;
      } else {
        // Wallet connection - generate signature auth token
        mLog.info('Web3AuthProvider', 'Wallet connection detected, generating signature');
        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substring(2, 15);
        const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`;

        mLog.debug('Web3AuthProvider', 'Requesting signature from wallet', {
          message,
          timestamp,
          nonce
        });

        let signature: string;
        try {
          // Double-check connection state before signing
          if (!this.web3authInstance?.connected || !this.web3authInstance?.provider) {
            throw new Error('Web3Auth connection lost before signing');
          }

          mLog.info('Web3AuthProvider', 'About to call signer.signMessage - this may trigger app switch');
          mLog.debug('Web3AuthProvider', 'Pre-signature connection state', {
            connected: this.web3authInstance.connected,
            hasProvider: !!this.web3authInstance.provider,
            hasEthersProvider: !!this.cachedEthersProvider
          });

          // Add timeout to detect hanging signature requests
          const signPromise = signer.signMessage(message);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Signature request timeout after 60 seconds')), 60000)
          );

          signature = await Promise.race([signPromise, timeoutPromise]) as string;
          mLog.info('Web3AuthProvider', 'Signature received successfully');

          // Verify connection state after signing
          mLog.debug('Web3AuthProvider', 'Post-signature connection state', {
            connected: this.web3authInstance?.connected,
            hasProvider: !!this.web3authInstance?.provider,
            signatureLength: signature.length
          });
        } catch (signError) {
          mLog.error('Web3AuthProvider', 'Signature failed', {
            error: signError instanceof Error ? signError.message : String(signError),
            errorType: signError instanceof Error ? signError.constructor.name : typeof signError
          });
          throw signError;
        }

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
    } finally {
      this.isConnecting = false;
      mLog.debug('Web3AuthProvider', 'Cleared isConnecting flag');
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

    // Prevent duplicate switch attempts
    if (this.isConnecting) {
      mLog.warn('Web3AuthProvider', 'Connection already in progress, cannot switch wallet now');
      throw new Error('Connection already in progress, please wait');
    }

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