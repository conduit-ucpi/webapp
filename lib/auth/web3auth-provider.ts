import { ethers } from 'ethers';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthUser, useIdentityToken } from '@web3auth/modal/react';
import { AuthProvider, AuthResult } from './types';
import { Web3AuthWalletProvider } from '@/lib/wallet/web3auth-provider';

/**
 * Web3Auth implementation of AuthProvider
 * Handles Web3Auth-specific authentication flow
 */
export class Web3AuthAuthProvider implements AuthProvider {
  private web3authHooks: {
    provider: any;
    connect: () => Promise<any>;
    isConnected: boolean;
    userInfo: any;
    idToken: string | null;
  };

  constructor(web3authHooks: {
    provider: any;
    connect: () => Promise<any>;
    isConnected: boolean;
    userInfo: any;
    idToken: string | null;
  }) {
    this.web3authHooks = web3authHooks;
  }

  getProviderName(): string {
    return 'Web3Auth';
  }

  async initialize(): Promise<void> {
    // Web3Auth is initialized by the React provider wrapper
    // No additional initialization needed here
  }

  isConnected(): boolean {
    return this.web3authHooks.isConnected;
  }

  getUserInfo(): any {
    return this.web3authHooks.userInfo;
  }

  hasVisitedBefore(): boolean {
    try {
      const visited = localStorage.getItem('conduit-has-visited');
      return !!visited;
    } catch (error) {
      console.warn('localStorage not available:', error);
      return false;
    }
  }

  markAsVisited(): void {
    try {
      localStorage.setItem('conduit-has-visited', 'true');
    } catch (error) {
      console.warn('localStorage not available:', error);
    }
  }

  async connect(): Promise<AuthResult> {
    console.log('Web3Auth connecting...');
    
    const web3authProvider = await this.web3authHooks.connect();
    
    if (!web3authProvider) {
      throw new Error('Failed to connect wallet - no provider available');
    }
    
    console.log('Web3Auth provider obtained:', web3authProvider);

    // Get wallet address using ethers.js
    let walletAddress: string | null = null;
    
    try {
      const ethersProvider = new ethers.BrowserProvider(web3authProvider as any);
      const signer = await ethersProvider.getSigner();
      walletAddress = await signer.getAddress();
      console.log('Wallet address from ethers.js:', walletAddress);
    } catch (ethersError) {
      console.error('Failed to get address via ethers.js:', ethersError);
      
      // Fallback: Try direct provider request
      try {
        const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
        if (accounts && accounts.length > 0) {
          walletAddress = accounts[0];
          console.log('Wallet address from eth_accounts:', walletAddress);
        }
      } catch (providerError) {
        console.error('Failed to get address via provider.request:', providerError);
      }
    }
    
    if (!walletAddress) {
      throw new Error('Could not obtain wallet address');
    }
    
    console.log('Final wallet address:', walletAddress);
    
    // Handle idToken acquisition
    let tokenToUse = this.web3authHooks.idToken;
    
    if (!tokenToUse) {
      console.log('idToken not available immediately, attempting to get it...');
      
      // For social logins, we need to explicitly call getIdentityToken
      const web3authInstance = (window as any).web3auth;
      if (web3authInstance && web3authInstance.connectedConnectorName === 'auth') {
        console.log('Social login detected, calling getIdentityToken...');
        try {
          const authUser = await web3authInstance.getIdentityToken();
          console.log('getIdentityToken result:', authUser);
          if (authUser?.idToken) {
            tokenToUse = authUser.idToken;
          }
        } catch (err) {
          console.error('getIdentityToken failed:', err);
        }
      }
      
      // Poll for idToken if still not available
      if (!tokenToUse) {
        tokenToUse = await this.pollForIdToken();
      }
      
      // Fallback to wallet address if no idToken available
      if (!tokenToUse) {
        console.warn('No idToken available, using wallet address as fallback');
        tokenToUse = `wallet:${walletAddress}`;
      }
    }
    
    // Create wallet provider abstraction
    const walletProvider = new Web3AuthWalletProvider(web3authProvider);
    
    return {
      idToken: tokenToUse,
      walletAddress,
      walletProvider
    };
  }

  private async pollForIdToken(maxAttempts = 10, interval = 500): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Polling for idToken, attempt ${attempt}/${maxAttempts}`);
      
      // Check hook again
      if (this.web3authHooks.idToken) {
        console.log('Got idToken from hook on attempt', attempt);
        return this.web3authHooks.idToken;
      }
      
      // Check Web3Auth instance
      const web3authInstance = (window as any).web3auth;
      if (web3authInstance) {
        // Check state
        if (web3authInstance.state?.idToken) {
          console.log('Got idToken from state on attempt', attempt);
          return web3authInstance.state.idToken;
        }
        
        // Try getIdentityToken
        if (web3authInstance.getIdentityToken) {
          try {
            console.log(`Calling getIdentityToken on attempt ${attempt}...`);
            const authUser = await web3authInstance.getIdentityToken();
            console.log(`getIdentityToken result on attempt ${attempt}:`, authUser);
            if (authUser?.idToken) {
              console.log('Got idToken from getIdentityToken on attempt', attempt);
              return authUser.idToken;
            }
          } catch (err) {
            console.warn(`getIdentityToken failed on attempt ${attempt}:`, err);
          }
        }
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    return null;
  }

  async disconnect(): Promise<void> {
    try {
      // Clear Web3Auth session if available
      const web3authInstance = (window as any).web3auth;
      if (web3authInstance && web3authInstance.connected) {
        try {
          await web3authInstance.logout();
        } catch (logoutError) {
          console.warn('Web3Auth logout failed, continuing with cleanup:', logoutError);
        }
      }

      // Clear all Web3Auth related localStorage/sessionStorage
      const keysToRemove = [
        'Web3Auth-cachedAdapter',
        'openlogin_store',
        'local_storage_key',
        'session_id',
        'sessionId',
        'walletconnect',
        'Web3Auth-connectedAdapters'
      ];

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key}:`, e);
        }
      });

      // Clear all items that start with 'Web3Auth' or 'openlogin'
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (key.startsWith('Web3Auth') || key.startsWith('openlogin') || key.startsWith('walletconnect')) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.warn(`Failed to remove localStorage key ${key}:`, e);
          }
        }
      });

      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (key.startsWith('Web3Auth') || key.startsWith('openlogin') || key.startsWith('walletconnect')) {
          try {
            sessionStorage.removeItem(key);
          } catch (e) {
            console.warn(`Failed to remove sessionStorage key ${key}:`, e);
          }
        }
      });

      // Clear global Web3Auth references
      (window as any).web3auth = null;
      (window as any).web3authProvider = null;

      console.log('Web3Auth disconnect completed');
    } catch (error) {
      console.error('Web3Auth disconnect error:', error);
      throw error;
    }
  }
}