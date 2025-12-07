/**
 * Core authentication manager (framework-agnostic)
 * Orchestrates the entire auth flow using unified providers
 */

import { AuthConfig, ProviderType } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  AuthState,
  AuthUser
} from '../types/unified-provider';
import { ProviderRegistry } from './ProviderRegistry';
import { TokenManager } from './TokenManager';
import { mLog } from '../../../utils/mobileLogger';
import { ethers } from 'ethers';

export class AuthManager {
  private static instance: AuthManager;
  private currentProvider: UnifiedProvider | null = null;
  private providerRegistry: ProviderRegistry;
  private tokenManager: TokenManager;
  private state: AuthState;
  private listeners: Array<(state: AuthState) => void> = [];
  private isConnectInProgress: boolean = false;

  private constructor() {
    this.providerRegistry = new ProviderRegistry();
    this.tokenManager = new TokenManager();
    this.state = {
      isConnected: false,
      isLoading: false,
      isInitialized: false,
      isAuthenticated: false,
      address: null,
      providerName: null,
      capabilities: null,
      error: null
    };
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Initialize the auth manager with configuration
   */
  async initialize(config: AuthConfig): Promise<void> {
    console.log('🔧 AuthManager: Initializing with config');

    try {
      this.setState({ isLoading: true, error: null });

      // Register available providers
      await this.providerRegistry.initialize(config);

      // Check for existing session
      await this.restoreSession();

      this.setState({
        isInitialized: true,
        isLoading: false
      });

      console.log('🔧 AuthManager: ✅ Initialized successfully');
    } catch (error) {
      console.error('🔧 AuthManager: ❌ Initialization failed:', error);
      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      });
    }
  }

  /**
   * Connect using the best available provider
   */
  async connect(preferredProvider?: ProviderType): Promise<ConnectionResult> {
    // Prevent multiple simultaneous connection attempts at the manager level
    if (this.isConnectInProgress) {
      mLog.warn('AuthManager', 'Connection already in progress, blocking duplicate attempt');
      return {
        success: false,
        error: 'Connection already in progress',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      };
    }

    this.isConnectInProgress = true;
    mLog.info('AuthManager', 'Starting connection process', { preferredProvider });

    try {
      this.setState({ isLoading: true, error: null });

      // Get provider (either preferred or best available)
      const provider = preferredProvider
        ? this.providerRegistry.getProvider(preferredProvider)
        : this.providerRegistry.getBestProvider();

      if (!provider) {
        mLog.error('AuthManager', 'No auth provider available');
        return {
          success: false,
          error: 'No auth provider available',
          capabilities: {
            canSign: false,
            canTransact: false,
            canSwitchWallets: false,
            isAuthOnly: true
          }
        };
      }

      mLog.info('AuthManager', 'Using provider', { providerName: provider.getProviderName() });

      // Force flush logs before connecting (in case connection hangs)
      await mLog.forceFlush();

      // Connect with the unified provider
      const result = await provider.connect();

      if (result.success) {
        // Store the successful provider
        this.currentProvider = provider;

        // Update state - keep isLoading true, it will be cleared by authenticateBackend
        this.setState({
          isConnected: true,
          // Don't set isLoading: false here - let authenticateBackend control it
          address: result.address || null,
          providerName: provider.getProviderName(),
          capabilities: result.capabilities,
          error: null
        });

        mLog.info('AuthManager', '✅ Connection successful', {
          address: result.address,
          providerName: provider.getProviderName(),
          capabilities: result.capabilities
        });
      } else {
        this.setState({
          isLoading: false,
          error: result.error || 'Connection failed'
        });

        mLog.error('AuthManager', '❌ Connection failed', {
          error: result.error
        });
      }

      // Force flush logs after connection attempt
      await mLog.forceFlush();
      return result;

    } catch (error) {
      mLog.error('AuthManager', '❌ Connection failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });

      const errorResult: ConnectionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      };

      // Force flush logs on error
      await mLog.forceFlush();
      return errorResult;
    } finally {
      this.isConnectInProgress = false;
    }
  }

  /**
   * Sign a message for backend authentication
   * This is called AFTER successful connection to authenticate with backend
   */
  async signMessageForAuth(): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No provider connected');
    }

    if (!this.state.address) {
      throw new Error('No wallet address available');
    }

    // Generate authentication message with timestamp and nonce
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);
    const message = `Authenticate wallet ${this.state.address} at ${timestamp} with nonce ${nonce}`;

    mLog.info('AuthManager', 'Signing message for backend authentication', {
      address: this.state.address,
      providerName: this.state.providerName
    });

    try {
      // Use the provider's signMessage method (which handles mobile MetaMask workaround internally)
      const signature = await this.currentProvider.signMessage(message);

      // Try to get user info (email, name) from provider if available
      let userInfo = null;
      try {
        userInfo = this.currentProvider?.getUserInfo?.();
        if (userInfo) {
          mLog.info('AuthManager', 'Including user info from provider in signature_auth token', {
            hasEmail: !!userInfo.email,
            hasName: !!userInfo.name
          });
        }
      } catch (userInfoError) {
        mLog.debug('AuthManager', 'Could not get user info from provider', {
          error: userInfoError instanceof Error ? userInfoError.message : String(userInfoError)
        });
      }

      // Create the auth token in the standard format
      const authToken = btoa(JSON.stringify({
        type: 'signature_auth',
        walletAddress: this.state.address,
        message,
        signature,
        timestamp,
        nonce,
        issuer: 'web3auth_unified',
        // Include email and name if available from provider (e.g., Dynamic passwordless)
        email: userInfo?.email,
        name: userInfo?.name,
        header: {
          alg: 'ECDSA',
          typ: 'SIG'
        },
        payload: {
          sub: this.state.address,
          iat: Math.floor(timestamp / 1000),
          iss: 'web3auth_unified',
          wallet_type: this.state.providerName
        }
      }));

      mLog.info('AuthManager', '✅ Message signed successfully for backend auth');
      return authToken;

    } catch (error) {
      mLog.error('AuthManager', 'Failed to sign message for auth', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback: Try using Dynamic's JWT token for social login users
      if (this.state.providerName === 'dynamic') {
        mLog.info('AuthManager', 'Attempting Dynamic JWT fallback authentication');

        try {
          const userInfo = this.currentProvider?.getUserInfo?.();
          if (userInfo && userInfo.idToken) {
            mLog.info('AuthManager', 'Using Dynamic JWT token for authentication');

            // Create auth token using Dynamic's JWT instead of signature
            const authToken = btoa(JSON.stringify({
              type: 'dynamic_jwt_auth',
              walletAddress: this.state.address,
              dynamicJwt: userInfo.idToken,
              email: userInfo.email,
              name: userInfo.name,
              dynamicUserId: (userInfo as any).dynamicUserId,
              timestamp: Date.now(),
              issuer: 'dynamic_social_login',
              header: {
                alg: 'JWT',
                typ: 'DYNAMIC'
              },
              payload: {
                sub: this.state.address,
                iat: Math.floor(Date.now() / 1000),
                iss: 'dynamic_social_login',
                wallet_type: 'dynamic_embedded'
              }
            }));

            mLog.info('AuthManager', '✅ Dynamic JWT fallback authentication successful');
            return authToken;
          } else {
            mLog.warn('AuthManager', 'No Dynamic JWT token available for fallback');
          }
        } catch (fallbackError) {
          mLog.error('AuthManager', 'Dynamic JWT fallback failed', {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          });
        }
      }

      throw error;
    }
  }

  /**
   * Disconnect current session
   */
  async disconnect(): Promise<void> {
    console.log('🔧 AuthManager: Disconnecting');
    this.isConnectInProgress = false; // Reset connection flag on disconnect

    try {
      if (this.currentProvider) {
        await this.currentProvider.disconnect();
      }

      // Clear tokens
      this.tokenManager.clearToken();

      // Clear Web3Service state to prevent stale provider data
      try {
        const { Web3Service } = await import('../../web3');
        // Check if instance exists (don't create a new one if it doesn't)
        if ((Web3Service as any).instance) {
          const web3Service = (Web3Service as any).instance;
          web3Service.clearState();
          console.log('🔧 AuthManager: Cleared Web3Service state');
        }
      } catch (error) {
        console.warn('🔧 AuthManager: Could not clear Web3Service:', error);
      }

      // Reset state
      this.setState({
        isConnected: false,
        isAuthenticated: false,
        address: null,
        providerName: null,
        capabilities: null,
        error: null
      });

      this.currentProvider = null;

      console.log('🔧 AuthManager: ✅ Disconnected successfully');
    } catch (error) {
      console.error('🔧 AuthManager: ❌ Disconnect failed:', error);
    }
  }

  /**
   * Switch wallet (if supported by current provider)
   */
  async switchWallet(): Promise<ConnectionResult> {
    if (!this.currentProvider) {
      return {
        success: false,
        error: 'No provider connected',
        capabilities: {
          canSign: false,
          canTransact: false,
          canSwitchWallets: false,
          isAuthOnly: true
        }
      };
    }

    if (!this.currentProvider.switchWallet) {
      return {
        success: false,
        error: 'Current provider does not support wallet switching',
        capabilities: this.currentProvider.getCapabilities()
      };
    }

    const result = await this.currentProvider.switchWallet();

    if (result.success) {
      // Update state with new connection info
      this.setState({
        address: result.address || null,
        capabilities: result.capabilities
      });
    }

    return result;
  }

  /**
   * Manually request authentication from the provider
   * Used as fallback when auto-authentication doesn't complete
   */
  async requestAuthentication(): Promise<boolean> {
    if (!this.currentProvider) {
      console.error('[AuthManager] Cannot request authentication - no provider connected');
      return false;
    }

    if (!this.currentProvider.requestAuthentication) {
      console.warn('[AuthManager] Current provider does not support manual authentication request');
      return false;
    }

    console.log('[AuthManager] Requesting manual authentication from provider');
    return await this.currentProvider.requestAuthentication();
  }

  /**
   * Show wallet management UI
   * Opens the provider's wallet management interface if supported
   */
  async showWalletUI(): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('Cannot show wallet UI - no provider connected');
    }

    // Check if the provider supports showWalletUI
    if (typeof (this.currentProvider as any).showWalletUI !== 'function') {
      throw new Error('Current provider does not support wallet UI');
    }

    console.log('[AuthManager] Opening wallet management UI from provider');
    await (this.currentProvider as any).showWalletUI();
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): UnifiedProvider | null {
    return this.currentProvider;
  }

  /**
   * Check if user is connected
   */
  isConnected(): boolean {
    return this.state.isConnected && this.currentProvider?.isConnected() === true;
  }

  /**
   * Sign a message with current provider
   */
  async signMessage(message: string): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No provider connected');
    }

    // Check capabilities
    if (!this.state.capabilities?.canSign) {
      throw new Error('Current provider does not support message signing');
    }

    return this.currentProvider.signMessage(message);
  }

  /**
   * Get ethers provider from current provider (single instance)
   * This awaits provider setup to avoid race conditions on page load/refresh
   *
   * CRITICAL FIX: Lazy-initialize currentProvider if null but a provider is connected
   * This fixes the session auto-restore timing bug where:
   * 1. restoreSession() runs before Dynamic finishes auto-restore
   * 2. provider.isConnected() = false, so currentProvider is not set
   * 3. Later, Dynamic finishes auto-restore (primaryWalletChanged fires)
   * 4. Balance loading calls getEthersProvider() but currentProvider is still null
   * 5. Without this fix: returns null → "Wallet not connected" error
   * 6. With this fix: finds the connected provider and initializes it
   */
  async getEthersProvider(): Promise<ethers.BrowserProvider | null> {
    // If currentProvider not set, try to find a connected provider (lazy init)
    if (!this.currentProvider) {
      mLog.info('AuthManager', 'currentProvider is null, checking for connected providers (lazy init)');

      const providers = this.providerRegistry.getAllProviders();
      for (const provider of providers) {
        if (provider.isConnected()) {
          this.currentProvider = provider;

          // Update state to reflect the connection
          let address: string | null = null;
          try {
            address = await provider.getAddress();
          } catch (error) {
            mLog.warn('AuthManager', 'Could not get address during lazy init', {
              error: error instanceof Error ? error.message : String(error)
            });
          }

          this.setState({
            isConnected: true,
            address,
            providerName: provider.getProviderName(),
            capabilities: provider.getCapabilities()
          });

          mLog.info('AuthManager', '✅ Lazy-initialized currentProvider from connected provider', {
            providerName: provider.getProviderName(),
            address
          });
          break;
        }
      }

      // Still no provider? Return null
      if (!this.currentProvider) {
        mLog.warn('AuthManager', 'No connected provider found for lazy init');
        return null;
      }
    }

    // Use async version to ensure provider is ready (fixes page load race condition)
    return await this.currentProvider.getEthersProviderAsync();
  }

  /**
   * Get current wallet address
   */
  async getAddress(): Promise<string | null> {
    if (!this.currentProvider) {
      return null;
    }

    try {
      return await this.currentProvider.getAddress();
    } catch {
      return null;
    }
  }

  setState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };

    // CRITICAL FIX: Expose wallet address on window for Web3Service
    // This prevents Web3Service from querying the provider which might have a stale cached address
    // from Dynamic SDK's WalletClient caching issue
    if (typeof window !== 'undefined') {
      if (this.state.address) {
        (window as any).authUser = {
          walletAddress: this.state.address,
          providerName: this.state.providerName,
          isConnected: this.state.isConnected,
          isAuthenticated: this.state.isAuthenticated
        };
      } else {
        // Clear authUser when disconnected
        delete (window as any).authUser;
      }
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.warn('🔧 AuthManager: Listener error:', error);
      }
    });
  }

  private async restoreSession(): Promise<void> {
    mLog.info('AuthManager', 'Starting restoreSession...');

    // Check for Dynamic OAuth redirect parameters
    const isDynamicOAuthRedirect = typeof window !== 'undefined' &&
      (window.location.search.includes('dynamicOauthCode=') ||
       window.location.search.includes('dynamicOauthState='));

    mLog.debug('AuthManager', 'Dynamic OAuth redirect check', {
      isDynamicOAuthRedirect,
      urlParams: typeof window !== 'undefined' ? window.location.search : ''
    });

    if (isDynamicOAuthRedirect) {
      mLog.info('AuthManager', 'Dynamic OAuth redirect detected - attempting to complete authentication');

      // Try to connect with Dynamic provider to complete the OAuth flow
      const providers = this.providerRegistry.getAllProviders();
      const dynamicProvider = providers.find(p => p.getProviderName() === 'dynamic');

      if (dynamicProvider) {
        try {
          mLog.info('AuthManager', 'Attempting Dynamic OAuth completion');
          this.setState({ isLoading: true });

          // Check if Dynamic is already connected (it should be after OAuth redirect)
          if (dynamicProvider.isConnected()) {
            mLog.info('AuthManager', 'Dynamic is already connected, updating AuthManager state');

            const address = await dynamicProvider.getAddress();

            this.currentProvider = dynamicProvider;
            this.setState({
              isConnected: true,
              isLoading: false,
              address: address || null,
              providerName: dynamicProvider.getProviderName(),
              capabilities: dynamicProvider.getCapabilities(),
              error: null
            });

            mLog.info('AuthManager', '✅ Dynamic OAuth authentication state updated', {
              address,
              providerName: dynamicProvider.getProviderName()
            });

            // Force flush logs immediately on success
            await mLog.forceFlush();
            return;
          } else {
            mLog.warn('AuthManager', 'Dynamic provider not connected despite OAuth redirect');

            // Try to connect explicitly
            const result = await dynamicProvider.connect();
            if (result.success) {
              this.currentProvider = dynamicProvider;
              this.setState({
                isConnected: true,
                isLoading: false,
                address: result.address || null,
                providerName: dynamicProvider.getProviderName(),
                capabilities: result.capabilities,
                error: null
              });
              mLog.info('AuthManager', '✅ Dynamic OAuth connection completed successfully');
              await mLog.forceFlush();
              return;
            } else {
              mLog.error('AuthManager', 'Dynamic provider connect failed after OAuth', { error: result.error });
            }
          }
        } catch (error) {
          mLog.error('AuthManager', 'Dynamic OAuth completion failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        } finally {
          this.setState({ isLoading: false });
        }
      } else {
        mLog.error('AuthManager', 'No Dynamic provider found for OAuth redirect completion');
      }

      // Force flush logs on Dynamic OAuth redirect attempts
      await mLog.forceFlush();
    }

    // MOBILE ENHANCEMENT: Check for redirect parameters indicating completed auth (even without stored token)
    const isMobile = typeof window !== 'undefined' && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const urlParams = typeof window !== 'undefined' ? window.location.search : '';

    mLog.debug('AuthManager', 'Mobile check', { isMobile, currentUrl, urlParams });

    const hasRedirectParams = typeof window !== 'undefined' &&
      (window.location.search.includes('code=') ||
       window.location.search.includes('state=') ||
       window.location.search.includes('access_token='));

    mLog.debug('AuthManager', 'Redirect params check', { hasRedirectParams, urlParams });

    if (isMobile && hasRedirectParams) {
      mLog.info('AuthManager', 'Mobile redirect detected - attempting to complete authentication');
      mLog.debug('AuthManager', 'URL search params', { searchParams: window.location.search });

      // Try to connect with the primary provider to complete the mobile flow
      const providers = this.providerRegistry.getAllProviders();
      mLog.debug('AuthManager', 'Available providers', { providerNames: providers.map(p => p.getProviderName()) });

      const primaryProvider = providers.find(p => p.getProviderName().includes('web3auth'));
      mLog.debug('AuthManager', 'Primary provider found', { providerName: primaryProvider?.getProviderName() });

      if (primaryProvider) {
        try {
          mLog.info('AuthManager', 'Attempting mobile auth completion with Web3Auth');
          this.setState({ isLoading: true });

          const result = await primaryProvider.connect();
          mLog.debug('AuthManager', 'Provider connect result', {
            success: result.success,
            address: result.address,
            error: result.error
          });

          if (result.success) {
            this.currentProvider = primaryProvider;
            this.setState({
              isConnected: true,
              isLoading: false,
              address: result.address || null,
              providerName: primaryProvider.getProviderName(),
              capabilities: result.capabilities,
              error: null
            });
            mLog.info('AuthManager', '✅ Mobile authentication completed successfully');

            // Clean up URL parameters
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('code');
              url.searchParams.delete('state');
              url.searchParams.delete('access_token');
              const cleanUrl = url.toString();
              mLog.debug('AuthManager', 'Cleaning URL', { from: window.location.href, to: cleanUrl });
              window.history.replaceState({}, '', cleanUrl);
            }

            // Force flush logs immediately on success
            await mLog.forceFlush();
            return;
          } else {
            mLog.error('AuthManager', 'Provider connect failed', { error: result.error });
            this.setState({ isLoading: false, error: result.error });
          }
        } catch (error) {
          mLog.error('AuthManager', 'Mobile auth completion failed', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          this.setState({ isLoading: false, error: error instanceof Error ? error.message : 'Mobile auth failed' });
        }
      } else {
        mLog.error('AuthManager', 'No Web3Auth provider found for mobile redirect completion');
      }

      // Force flush logs on mobile redirect attempts
      await mLog.forceFlush();
    }

    // Check if we have a stored token and try to restore session
    const token = this.tokenManager.getToken();
    if (token) {
      console.log('🔧 AuthManager: Found stored token, attempting to restore session');

      // Standard session restoration
      const providers = this.providerRegistry.getAllProviders();
      for (const provider of providers) {
        if (provider.isConnected()) {
          this.currentProvider = provider;

          // Get address if possible
          let address: string | null = null;
          try {
            address = await provider.getAddress();
          } catch {}

          // CRITICAL FIX: Ensure ethers provider is initialized during session restore
          // This prevents "Wallet not connected" errors when:
          // - User navigates to a page after auth
          // - Dynamic SDK auto-restores wallet session
          // - isConnected becomes true
          // - BUT setupEthersProvider() was never called (provider cache empty)
          // - Any code using getEthersProvider() fails
          mLog.info('AuthManager', 'Ensuring ethers provider is initialized during session restore');
          try {
            await provider.getEthersProviderAsync();
            mLog.info('AuthManager', '✅ Ethers provider initialized successfully');
          } catch (error) {
            mLog.error('AuthManager', '❌ Failed to initialize ethers provider during restore', {
              error: error instanceof Error ? error.message : String(error)
            });
          }

          this.setState({
            isConnected: true,
            isAuthenticated: true, // If we have a token, we were authenticated
            address,
            providerName: provider.getProviderName(),
            capabilities: provider.getCapabilities()
          });
          console.log(`🔧 AuthManager: Restored session with ${provider.getProviderName()}`);
          break;
        }
      }
    }
  }
}