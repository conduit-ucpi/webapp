/**
 * WalletConnect provider implementation using Reown AppKit
 * Direct WalletConnect integration for wallets that work better without Dynamic abstraction
 */

import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ReownWalletConnectProvider } from '../../../components/auth/reownWalletConnect';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';

export class WalletConnectProvider implements UnifiedProvider {
  private reownProvider: ReownWalletConnectProvider;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;

  constructor(config: AuthConfig) {
    mLog.info('WalletConnectProvider', 'Initializing WalletConnect provider');
    this.reownProvider = new ReownWalletConnectProvider({
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      walletConnectProjectId: config.walletConnectProjectId,
    });
  }

  getProviderName(): string {
    return 'walletconnect';
  }

  async initialize(): Promise<void> {
    mLog.info('WalletConnectProvider', 'Initialize called');
    await this.reownProvider.initialize();
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('WalletConnectProvider', 'Connect called - opening WalletConnect modal');

    // Reset SIWX verification state for new connection attempt
    const { SIWXVerificationState } = await import('../siwx-config');
    SIWXVerificationState.getInstance().reset();
    mLog.info('WalletConnectProvider', 'Reset SIWX verification state for new connection');

    try {
      const result = await this.reownProvider.connect();

      if (result.success && result.user?.walletAddress) {
        this.currentAddress = result.user.walletAddress;

        // Create ethers provider from the wallet provider
        if (result.provider) {
          this.cachedEthersProvider = new ethers.BrowserProvider(result.provider);
        }

        mLog.info('WalletConnectProvider', 'Connection successful', {
          address: this.currentAddress
        });

        // SIWX Automatic + Manual Fallback Strategy:
        // 1. Give SIWX a moment to complete automatically (it should with required:true)
        // 2. Check if backend session was created
        // 3. If not, manually trigger SIWE signing as fallback
        if (this.currentAddress) {
          await this.ensureBackendAuthentication(this.currentAddress);
        }

        return {
          success: true,
          address: this.currentAddress || undefined,
          capabilities: this.getCapabilities()
        };
      }

      return {
        success: false,
        error: result.error || 'Connection failed',
        capabilities: this.getCapabilities()
      };
    } catch (error) {
      mLog.error('WalletConnectProvider', 'Connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: this.getCapabilities()
      };
    }
  }

  async disconnect(): Promise<void> {
    mLog.info('WalletConnectProvider', 'Disconnecting');
    await this.reownProvider.disconnect();
    this.cachedEthersProvider = null;
    this.currentAddress = null;
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('WalletConnectProvider', 'Switch wallet called - disconnecting and reconnecting');
    await this.disconnect();
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    mLog.info('WalletConnectProvider', 'Sign message requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    // For embedded wallets (social login), we can't use getSigner() as it calls eth_requestAccounts
    // Instead, use personal_sign directly via the provider
    try {
      const walletProvider = this.reownProvider.getProvider();
      const address = await this.getAddress();

      mLog.info('WalletConnectProvider', 'Signing with personal_sign (works with embedded wallets)', {
        address,
        messageLength: message.length
      });

      // personal_sign expects hex-encoded message
      // Convert string to hex: "Hello" -> "0x48656c6c6f"
      const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');

      mLog.info('WalletConnectProvider', 'Message hex-encoded for personal_sign', {
        originalLength: message.length,
        hexLength: hexMessage.length
      });

      // Use personal_sign directly - works with both regular wallets and embedded wallets
      const signature = await walletProvider.request({
        method: 'personal_sign',
        params: [hexMessage, address]
      });

      return signature;
    } catch (error) {
      mLog.error('WalletConnectProvider', 'Failed to sign message', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    mLog.info('WalletConnectProvider', 'Sign transaction requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    const signedTx = await signer.signTransaction({
      to: params.to,
      value: params.value,
      data: params.data,
      gasLimit: params.gasLimit,
    });

    return signedTx;
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    mLog.info('WalletConnectProvider', 'Send transaction requested');

    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    const response = await signer.sendTransaction({
      to: tx.to,
      value: tx.value,
      data: tx.data,
      gasLimit: tx.gasLimit,
    });

    return response.hash;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
    return this.cachedEthersProvider;
  }

  async getEthersProviderAsync(): Promise<ethers.BrowserProvider | null> {
    mLog.info('WalletConnectProvider', 'Get ethers provider requested (async)');
    return this.cachedEthersProvider;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    };
  }

  isConnected(): boolean {
    return this.reownProvider.isConnected();
  }

  async getAddress(): Promise<string> {
    if (!this.currentAddress) {
      throw new Error('No address available - not connected');
    }
    return this.currentAddress;
  }

  async getChainId(): Promise<number> {
    if (!this.cachedEthersProvider) {
      throw new Error('No provider available - not connected');
    }

    const network = await this.cachedEthersProvider.getNetwork();
    return Number(network.chainId);
  }

  /**
   * Manually request SIWX authentication
   * Used as fallback when auto-authentication during connection doesn't complete
   */
  async requestAuthentication(): Promise<boolean> {
    mLog.info('WalletConnectProvider', 'Requesting manual SIWX authentication');
    return await this.reownProvider.requestAuthentication();
  }

  /**
   * Show the Reown wallet management UI
   * Opens the AppKit modal with the account view
   */
  async showWalletUI(): Promise<void> {
    mLog.info('WalletConnectProvider', 'Opening Reown wallet management UI');

    if (!this.isConnected()) {
      throw new Error('Cannot show wallet UI - not connected');
    }

    // Access the internal reownProvider to get the appKit instance
    const appKit = (this.reownProvider as any).appKit;

    if (!appKit) {
      throw new Error('AppKit not initialized');
    }

    // Open the account view in the AppKit modal
    await appKit.open({ view: 'Account' });
  }

  /**
   * Get user info from embedded wallet (email, name, etc.)
   * Only available for social login / embedded wallet users
   */
  getUserInfo(): Record<string, unknown> | null {
    try {
      // Access the internal appKit instance
      const appKit = (this.reownProvider as any).appKit;

      if (!appKit) {
        mLog.debug('WalletConnectProvider', 'AppKit not initialized, cannot get user info');
        return null;
      }

      // Try to get the AppKit account state
      // The appKit instance should have methods to access account info
      const accountState = appKit.getState?.() || appKit.state;

      if (!accountState) {
        mLog.debug('WalletConnectProvider', 'No account state available');
        return null;
      }

      // Extract embedded wallet info if available
      const embeddedWalletInfo = accountState.embeddedWalletInfo;

      if (!embeddedWalletInfo || !embeddedWalletInfo.user) {
        mLog.debug('WalletConnectProvider', 'No embedded wallet info - user likely connected with external wallet');
        return null;
      }

      const userInfo: Record<string, unknown> = {};

      if (embeddedWalletInfo.user.email) {
        userInfo.email = embeddedWalletInfo.user.email;
      }

      if (embeddedWalletInfo.user.username) {
        userInfo.name = embeddedWalletInfo.user.username;
      }

      if (embeddedWalletInfo.authProvider) {
        userInfo.authProvider = embeddedWalletInfo.authProvider;
      }

      if (Object.keys(userInfo).length > 0) {
        mLog.info('WalletConnectProvider', 'Retrieved user info from embedded wallet', {
          hasEmail: !!userInfo.email,
          hasName: !!userInfo.name,
          authProvider: userInfo.authProvider
        });
        return userInfo;
      }

      return null;
    } catch (error) {
      mLog.error('WalletConnectProvider', 'Error getting user info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Ensure backend SIWE session exists after wallet connection
   *
   * Strategy:
   * 1. Check if SIWX verify has been called and what the result was
   * 2. If verify succeeded, we're done
   * 3. If verify hasn't been called yet, wait briefly and check again
   * 4. If verify failed or timed out, do manual sign + verify
   */
  private async ensureBackendAuthentication(address: string): Promise<void> {
    mLog.info('WalletConnectProvider', '🔐 Checking SIWX verification status...');

    // Import the verification state tracker
    const { SIWXVerificationState } = await import('../siwx-config');
    const verificationState = SIWXVerificationState.getInstance();

    // Step 1: Wait for SIWX verify to be called (with timeout)
    const maxWaitTime = 5000; // Wait up to 5 seconds for verify to be called
    const pollInterval = 200; // Check every 200ms
    const startTime = Date.now();

    while (!verificationState.verificationAttempted && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Step 2: Check the verification result
    if (verificationState.verificationAttempted) {
      if (verificationState.verificationSucceeded) {
        mLog.info('WalletConnectProvider', '✅ SIWX auto-verify succeeded!', {
          address,
          timeTaken: verificationState.verificationTimestamp - startTime
        });
        return; // Success! SIWX worked automatically
      } else {
        mLog.warn('WalletConnectProvider', '⚠️ SIWX auto-verify was attempted but failed', {
          address
        });
        // Fall through to manual signing
      }
    } else {
      mLog.warn('WalletConnectProvider', `⚠️ SIWX auto-verify not attempted within ${maxWaitTime}ms`, {
        address
      });
      // Fall through to manual signing
    }

    // Step 3: Check if manual signing is already in progress
    if (verificationState.manualSigningInProgress) {
      mLog.warn('WalletConnectProvider', '⏳ Manual signing already in progress, waiting for it to complete...');

      // Wait for the in-progress manual signing to complete (up to 60 seconds for mobile)
      const manualSignTimeout = 60000;
      const manualSignStart = Date.now();

      while (verificationState.manualSigningInProgress && (Date.now() - manualSignStart) < manualSignTimeout) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Check if it succeeded
      if (verificationState.verificationSucceeded) {
        mLog.info('WalletConnectProvider', '✅ Manual signing completed successfully');
        return;
      } else {
        mLog.error('WalletConnectProvider', '❌ Manual signing failed or timed out');
        throw new Error('Manual signing failed');
      }
    }

    // Step 4: SIWX auto-verify failed or didn't happen - trigger manual sign + verify
    mLog.warn('WalletConnectProvider', '🔄 Triggering manual sign + verify fallback...');
    verificationState.setManualSigningInProgress(true);

    try {
      // Fetch nonce from backend (GET request, same as SIWX messenger)
      const nonceResponse = await fetch('/api/auth/siwe/nonce', {
        credentials: 'include'
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to fetch nonce');
      }

      const { nonce } = await nonceResponse.json();
      mLog.info('WalletConnectProvider', '✅ Nonce fetched from backend', { nonceLength: nonce?.length });

      // Create SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const chainId = 8453; // Base mainnet
      const issuedAt = new Date().toISOString();

      const message = `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Conduit UCPI

URI: ${origin}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;

      mLog.info('WalletConnectProvider', '📝 SIWE message created', {
        messageLength: message.length
      });

      // Sign the message
      const signature = await this.signMessage(message);
      mLog.info('WalletConnectProvider', '✅ Message signed', {
        signatureLength: signature.length
      });

      // Verify with backend
      const verifyResponse = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature })
      });

      if (!verifyResponse.ok) {
        verificationState.setManualSigningInProgress(false);
        throw new Error(`Verification failed: ${verifyResponse.status}`);
      }

      mLog.info('WalletConnectProvider', '✅ Manual SIWE authentication successful!');
      verificationState.setManualSigningInProgress(false);
    } catch (error) {
      mLog.error('WalletConnectProvider', '❌ Manual SIWE authentication failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      verificationState.setManualSigningInProgress(false);
      // Don't throw - let the app handle missing auth via session checks
    }
  }
}
