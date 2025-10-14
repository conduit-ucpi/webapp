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
    this.tokenManager = TokenManager.getInstance();
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

        // Update state
        this.setState({
          isConnected: true,
          isLoading: false,
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
   * Sign a message for backend authentication using a specific provider
   * Used when we have a provider from connection result but haven't set currentProvider yet
   */
  async signMessageWithProvider(provider: any, address: string): Promise<string> {
    try {
      mLog.info('AuthManager', 'Signing message with provided Dynamic provider', {
        hasProvider: !!provider,
        address,
        providerType: typeof provider,
        providerConstructor: provider?.constructor?.name,
        providerKeys: provider ? Object.getOwnPropertyNames(provider).slice(0, 10) : [],
        hasRequest: !!provider?.request,
        hasSend: !!provider?.send,
        hasGetSigner: !!provider?.getSigner,
        isEthersProvider: provider?.constructor?.name === 'BrowserProvider'
      });

      // Create message to sign
      const message = `Sign in to Conduit UCPI at ${Date.now()}`;

      // Try different provider interfaces
      if (provider) {
        // FIRST: Extract actual provider from Dynamic connector if needed
        let actualProvider = provider;

        // Check if this is a Dynamic connector (has _ethProviderHelper or similar properties)
        if (provider.constructor?.name === 'tk1' || provider._ethProviderHelper || provider.walletConnectorEventsEmitter) {
          mLog.info('AuthManager', 'Detected Dynamic connector, extracting actual provider');

          // Try to extract the real provider from Dynamic connector
          if (provider._ethProviderHelper && provider._ethProviderHelper.provider) {
            actualProvider = provider._ethProviderHelper.provider;
            mLog.info('AuthManager', 'Extracted provider from _ethProviderHelper');
          } else if (provider.connector && provider.connector.provider) {
            actualProvider = provider.connector.provider;
            mLog.info('AuthManager', 'Extracted provider from connector.provider');
          } else if (provider.provider) {
            actualProvider = provider.provider;
            mLog.info('AuthManager', 'Extracted provider from .provider');
          } else if (typeof window !== 'undefined' && (window as any).ethereum) {
            // Fallback to window.ethereum for MetaMask on mobile
            actualProvider = (window as any).ethereum;
            mLog.info('AuthManager', 'Fallback to window.ethereum');
          }

          mLog.debug('AuthManager', 'Provider extraction result', {
            originalType: provider.constructor?.name,
            extractedType: actualProvider?.constructor?.name,
            hasRequest: !!actualProvider?.request,
            hasGetSigner: !!actualProvider?.getSigner
          });
        }

        // SECOND: Try to create a proper ethers provider if we have a raw EIP-1193 provider
        if (typeof actualProvider.request === 'function' && !actualProvider.getSigner) {
          try {
            mLog.info('AuthManager', 'Detected raw EIP-1193 provider, wrapping in ethers');
            const ethersProvider = new ethers.BrowserProvider(actualProvider);
            const signer = await ethersProvider.getSigner();
            const signature = await signer.signMessage(message);
            mLog.info('AuthManager', '✅ Ethers-wrapped EIP-1193 signing successful');
            return signature;
          } catch (wrapError) {
            mLog.warn('AuthManager', 'Failed to wrap EIP-1193 provider in ethers', {
              error: wrapError instanceof Error ? wrapError.message : String(wrapError)
            });
          }
        }

        // THIRD: Try ethers provider directly if it already is one
        if (actualProvider.getSigner && typeof actualProvider.getSigner === 'function') {
          try {
            mLog.info('AuthManager', 'Attempting ethers provider.getSigner method');
            const signer = await actualProvider.getSigner();
            const signature = await signer.signMessage(message);
            mLog.info('AuthManager', '✅ Ethers provider signing successful');
            return signature;
          } catch (ethersError) {
            mLog.warn('AuthManager', 'Ethers provider.getSigner failed', {
              error: ethersError instanceof Error ? ethersError.message : String(ethersError)
            });
          }
        }

        // FOURTH: Try EIP-1193 provider (request method) directly
        if (typeof actualProvider.request === 'function') {
          try {
            mLog.info('AuthManager', 'Attempting EIP-1193 provider.request method');
            const signature = await actualProvider.request({
              method: 'personal_sign',
              params: [message, address]
            });
            mLog.info('AuthManager', '✅ EIP-1193 signing successful');
            return signature;
          } catch (requestError) {
            mLog.warn('AuthManager', 'EIP-1193 provider.request failed', {
              error: requestError instanceof Error ? requestError.message : String(requestError)
            });
          }
        }

        // FIFTH: Try legacy send method
        if (typeof actualProvider.send === 'function') {
          try {
            mLog.info('AuthManager', 'Attempting provider.send method');
            const signature = await actualProvider.send('personal_sign', [message, address]);
            mLog.info('AuthManager', '✅ Provider.send signing successful');
            return signature;
          } catch (sendError) {
            mLog.warn('AuthManager', 'Provider.send failed', {
              error: sendError instanceof Error ? sendError.message : String(sendError)
            });
          }
        }

        // LAST RESORT: Try window.ethereum if available
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            mLog.info('AuthManager', 'Attempting window.ethereum fallback');
            const signature = await (window as any).ethereum.request({
              method: 'personal_sign',
              params: [message, address]
            });
            mLog.info('AuthManager', '✅ Window.ethereum signing successful');
            return signature;
          } catch (windowError) {
            mLog.warn('AuthManager', 'Window.ethereum failed', {
              error: windowError instanceof Error ? windowError.message : String(windowError)
            });
          }
        }

        mLog.error('AuthManager', 'All provider interfaces failed or not supported', {
          originalHasRequest: !!provider.request,
          originalHasSend: !!provider.send,
          originalHasGetSigner: !!provider.getSigner,
          originalProviderType: typeof provider,
          originalProviderConstructor: provider?.constructor?.name,
          actualHasRequest: !!actualProvider.request,
          actualHasSend: !!actualProvider.send,
          actualHasGetSigner: !!actualProvider.getSigner,
          actualProviderType: typeof actualProvider,
          actualProviderConstructor: actualProvider?.constructor?.name,
          providerKeys: Object.keys(provider || {}),
          actualProviderKeys: Object.keys(actualProvider || {})
        });
        throw new Error('Provider does not support any known signing interface');
      } else {
        throw new Error('No provider provided');
      }
    } catch (error) {
      mLog.error('AuthManager', 'Failed to sign message with provider', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
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

      // Create the auth token in the standard format
      const authToken = btoa(JSON.stringify({
        type: 'signature_auth',
        walletAddress: this.state.address,
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

      // Fallback: Try using Dynamic's embedded wallet authentication for social login users
      if (this.state.providerName === 'dynamic') {
        mLog.info('AuthManager', 'Attempting Dynamic embedded wallet authentication');

        try {
          const userInfo = this.currentProvider?.getUserInfo?.();
          mLog.info('AuthManager', 'Dynamic user info analysis', {
            hasUserInfo: !!userInfo,
            userInfoKeys: userInfo ? Object.keys(userInfo) : [],
            hasEmail: !!(userInfo?.email),
            hasName: !!(userInfo?.name),
            hasIdToken: !!(userInfo?.idToken),
            idTokenType: userInfo?.idToken ? typeof userInfo.idToken : 'undefined',
            idTokenLength: userInfo?.idToken && typeof userInfo.idToken === 'string' ? userInfo.idToken.length : 0,
            idTokenPreview: userInfo?.idToken && typeof userInfo.idToken === 'string' ? `${userInfo.idToken.substring(0, 30)}...` : null
          });

          if (userInfo) {
            // Check if we have a proper JWT token (3 parts separated by dots)
            const potentialJwt = userInfo.idToken as string;
            const isValidJwt = potentialJwt &&
                              typeof potentialJwt === 'string' &&
                              potentialJwt.split('.').length === 3 &&
                              potentialJwt.length > 200 &&
                              !potentialJwt.startsWith('http'); // Ensure it's not a URL

            mLog.info('AuthManager', 'JWT validation results', {
              tokenValue: potentialJwt && typeof potentialJwt === 'string' ? `${potentialJwt.substring(0, 50)}...` : null,
              tokenLength: potentialJwt ? potentialJwt.length : 0,
              isString: typeof potentialJwt === 'string',
              hasDots: potentialJwt ? potentialJwt.split('.').length : 0,
              isValidLength: potentialJwt ? potentialJwt.length > 200 : false,
              isNotUrl: potentialJwt ? !potentialJwt.startsWith('http') : false,
              isValidJwt
            });

            if (isValidJwt) {
              mLog.info('AuthManager', 'Found valid JWT token, creating Dynamic JWT auth');

              const authToken = btoa(JSON.stringify({
                type: 'dynamic_jwt_auth',
                walletAddress: this.state.address,
                dynamicJwt: potentialJwt,
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

              mLog.info('AuthManager', '✅ Dynamic JWT authentication successful');
              return authToken;
            } else {
              mLog.warn('AuthManager', 'userInfo.idToken is not a valid JWT token, using embedded wallet auth', {
                tokenValue: potentialJwt && typeof potentialJwt === 'string' ? `${potentialJwt.substring(0, 50)}...` : null,
                tokenLength: potentialJwt ? potentialJwt.length : 0,
                isString: typeof potentialJwt === 'string',
                hasDots: potentialJwt ? potentialJwt.split('.').length : 0
              });

              // For embedded wallets without JWT, create a different auth token
              mLog.info('AuthManager', 'Creating embedded wallet auth token without JWT');

              const authToken = btoa(JSON.stringify({
                type: 'dynamic_embedded_auth',
                walletAddress: this.state.address,
                email: userInfo.email,
                name: userInfo.name,
                dynamicUserId: (userInfo as any).dynamicUserId || 'embedded_user',
                timestamp: Date.now(),
                issuer: 'dynamic_embedded_wallet',
                header: {
                  alg: 'EMBEDDED',
                  typ: 'DYNAMIC'
                },
                payload: {
                  sub: this.state.address,
                  iat: Math.floor(Date.now() / 1000),
                  iss: 'dynamic_embedded_wallet',
                  wallet_type: 'dynamic_embedded',
                  email: userInfo.email,
                  name: userInfo.name
                }
              }));

              mLog.info('AuthManager', '✅ Dynamic embedded wallet authentication successful');
              return authToken;
            }
          } else {
            mLog.warn('AuthManager', 'No Dynamic user info available for authentication');
          }
        } catch (fallbackError) {
          mLog.error('AuthManager', 'Dynamic embedded wallet authentication failed', {
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
   */
  async getEthersProvider(): Promise<ethers.BrowserProvider | null> {
    if (!this.currentProvider) {
      return null;
    }
    return this.currentProvider.getEthersProvider();
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