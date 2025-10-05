/**
 * Core authentication manager (framework-agnostic)
 * Orchestrates the entire auth flow
 */

import { AuthProvider, AuthState, AuthResult, AuthConfig, ProviderType } from '../types';
import { ProviderRegistry } from './ProviderRegistry';
import { TokenManager } from './TokenManager';

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
    console.log('🔧 AuthManager: Starting connection process');

    try {
      this.setState({ isLoading: true, error: null });

      // Get provider (either preferred or best available)
      const provider = preferredProvider
        ? this.providerRegistry.getProvider(preferredProvider)
        : this.providerRegistry.getBestProvider();

      if (!provider) {
        throw new Error('No auth provider available');
      }

      console.log(`🔧 AuthManager: Using provider: ${provider.getProviderName()}`);

      // Connect with the provider
      const providerResult = await provider.connect();

      // Store the successful provider
      this.currentProvider = provider;

      // Extract auth result
      const result: AuthResult = {
        success: true,
        provider: providerResult,
        token: provider.getToken() || undefined
      };

      // Update state
      this.setState({
        isConnected: true,
        isLoading: false,
        token: result.token,
        providerName: provider.getProviderName()
      });

      console.log('🔧 AuthManager: ✅ Connection successful');
      return result;

    } catch (error) {
      console.error('🔧 AuthManager: ❌ Connection failed:', error);

      this.setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
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
    // Check if we have a stored token and try to restore session
    const token = this.tokenManager.getToken();
    if (token) {
      console.log('🔧 AuthManager: Found stored token, attempting to restore session');
      // Implementation depends on backend integration
      // For now, we'll just check if any provider thinks it's connected

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