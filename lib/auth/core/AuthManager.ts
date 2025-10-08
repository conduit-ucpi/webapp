/**
 * Core authentication manager (framework-agnostic)
 * Orchestrates the entire auth flow
 */

import { AuthProvider, AuthState, AuthResult, AuthConfig, ProviderType } from '../types';
import { ProviderRegistry } from './ProviderRegistry';
import { TokenManager } from './TokenManager';
import { mLog } from '../../../utils/mobileLogger';

export class AuthManager {
  private static instance: AuthManager;
  private currentProvider: AuthProvider | null = null;
  private providerRegistry: ProviderRegistry;
  private tokenManager: TokenManager;
  private state: AuthState;
  private listeners: Array<(state: AuthState) => void> = [];

  private constructor() {
    this.providerRegistry = new ProviderRegistry();
    this.tokenManager = new TokenManager();
    this.state = {
      user: null,
      token: null,
      isConnected: false,
      isLoading: false,
      isInitialized: false,
      error: null,
      providerName: 'none'
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
  async connect(preferredProvider?: ProviderType): Promise<AuthResult> {
    mLog.info('AuthManager', 'Starting connection process', { preferredProvider });

    try {
      this.setState({ isLoading: true, error: null });

      // Get provider (either preferred or best available)
      const provider = preferredProvider
        ? this.providerRegistry.getProvider(preferredProvider)
        : this.providerRegistry.getBestProvider();

      if (!provider) {
        mLog.error('AuthManager', 'No auth provider available');
        throw new Error('No auth provider available');
      }

      mLog.info('AuthManager', 'Using provider', { providerName: provider.getProviderName() });

      // Force flush logs before connecting (in case connection hangs)
      await mLog.forceFlush();

      // Connect with the provider
      const providerResult = await provider.connect();

      // Store the successful provider
      this.currentProvider = provider;

      mLog.debug('AuthManager', 'Provider connect completed', {
        hasResult: !!providerResult,
        resultType: typeof providerResult,
        hasSuccess: providerResult && typeof providerResult === 'object' && 'success' in providerResult
      });

      // Check if the provider returned an AuthResult or just the raw provider
      let result: AuthResult;
      if (providerResult && typeof providerResult === 'object' && 'success' in providerResult) {
        // Provider returned an AuthResult object (mobile case)
        mLog.debug('AuthManager', 'Using AuthResult from provider', {
          success: providerResult.success,
          hasToken: !!providerResult.token,
          hasUser: !!providerResult.user,
          error: providerResult.error
        });
        result = providerResult;
      } else {
        // Provider returned the raw Web3Auth provider (normal case)
        mLog.debug('AuthManager', 'Creating AuthResult from raw provider');
        result = {
          success: true,
          provider: providerResult,
          token: provider.getToken() || undefined
        };
      }

      // Update state
      this.setState({
        isConnected: true,
        isLoading: false,
        token: result.token,
        user: result.user || null,
        providerName: provider.getProviderName()
      });

      mLog.info('AuthManager', '✅ Connection successful', {
        hasToken: !!result.token,
        hasUser: !!result.user,
        providerName: provider.getProviderName()
      });

      // Force flush logs after successful connection
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

      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };

      // Force flush logs on error
      await mLog.forceFlush();
      return errorResult;
    }
  }

  /**
   * Disconnect current session
   */
  async disconnect(): Promise<void> {
    console.log('🔧 AuthManager: Disconnecting');

    try {
      if (this.currentProvider) {
        await this.currentProvider.disconnect();
      }

      // Clear tokens
      this.tokenManager.clearToken();

      // Reset state
      this.setState({
        user: null,
        token: null,
        isConnected: false,
        error: null,
        providerName: 'none'
      });

      this.currentProvider = null;

      console.log('🔧 AuthManager: ✅ Disconnected successfully');
    } catch (error) {
      console.error('🔧 AuthManager: ❌ Disconnect failed:', error);
    }
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
  getCurrentProvider(): AuthProvider | null {
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
    return this.currentProvider.signMessage(message);
  }

  /**
   * Get ethers provider from current provider
   */
  async getEthersProvider(): Promise<any> {
    if (!this.currentProvider) {
      throw new Error('No provider connected');
    }
    return this.currentProvider.getEthersProvider();
  }

  private setState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };

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
            hasToken: !!result.token,
            hasUser: !!result.user,
            error: result.error
          });

          if (result.success) {
            this.currentProvider = primaryProvider;
            this.setState({
              isConnected: true,
              isLoading: false,
              token: result.token,
              user: result.user,
              providerName: primaryProvider.getProviderName()
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
          this.setState({
            isConnected: true,
            token,
            providerName: provider.getProviderName()
          });
          console.log(`🔧 AuthManager: Restored session with ${provider.getProviderName()}`);
          break;
        }
      }
    }
  }
}