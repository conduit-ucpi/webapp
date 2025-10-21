/**
 * Dynamic.xyz provider implementation with DynamicWagmiConnector
 * Uses wagmi to bridge Dynamic wallets and get providers
 */

import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getWeb3Provider } from '@dynamic-labs/ethers-v6';
import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ethers } from "ethers";
import { mLog } from '../../../utils/mobileLogger';
import { getPublicClient } from '@wagmi/core';
import { wrapProviderWithMobileDeepLinks } from '../../../utils/mobileDeepLinkProvider';

export class DynamicProvider implements UnifiedProvider {
  private static instance: DynamicProvider | null = null;
  private config!: AuthConfig; // Definite assignment assertion - set in constructor or returned instance
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;
  private dynamicInstance: any = null;
  private dynamicWallet: any = null; // Store Dynamic wallet for signing operations

  constructor(config: AuthConfig) {
    // Singleton pattern: return existing instance if available
    if (DynamicProvider.instance) {
      mLog.info('DynamicProvider', 'Returning existing singleton instance from constructor');
      // Update config in case it changed
      DynamicProvider.instance.config = config;
      return DynamicProvider.instance;
    }

    mLog.info('DynamicProvider', 'Creating new singleton instance in constructor');
    this.config = config;
    DynamicProvider.instance = this;
  }

  /**
   * Get the singleton instance of DynamicProvider
   * This ensures the provider cache persists across React re-mounts
   */
  static getInstance(config: AuthConfig): DynamicProvider {
    return new DynamicProvider(config);
  }

  /**
   * Clear the singleton instance (primarily for testing)
   */
  static clearInstance(): void {
    mLog.info('DynamicProvider', 'Clearing singleton instance');
    DynamicProvider.instance = null;
  }

  getProviderName(): string {
    return 'dynamic';
  }

  async initialize(): Promise<void> {
    mLog.info('DynamicProvider', 'Initialize called');
    // Dynamic initialization happens via React context, not here
  }

  async connect(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Connect called - opening Dynamic modal');

    try {
      // Check if this is an OAuth redirect first
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

      mLog.info('DynamicProvider', 'OAuth redirect check', {
        currentUrl: window.location.href,
        hasOAuthCode: urlParams.has('dynamicOauthCode'),
        hasOAuthState: urlParams.has('dynamicOauthState'),
        isOAuthRedirect,
        hasStoredResult: !!(typeof window !== 'undefined' && (window as any).dynamicOAuthResult)
      });

      // Check for stored OAuth result first (simpler approach)
      if (typeof window !== 'undefined' && (window as any).dynamicOAuthResult) {
        const result = (window as any).dynamicOAuthResult;
        mLog.info('DynamicProvider', 'Found stored OAuth result, using immediately', {
          hasResult: !!result,
          hasAddress: !!(result?.address),
          hasProvider: !!(result?.provider)
        });

        if (result && result.address) {
          this.currentAddress = result.address;
          await this.setupEthersProvider(result.wallet);

          // Clear the stored result
          delete (window as any).dynamicOAuthResult;

          const connectionResult = {
            success: true,
            address: result.address,
            capabilities: this.getCapabilities()
          };

          mLog.info('DynamicProvider', 'OAuth stored result connection successful', connectionResult);
          return connectionResult;
        }
      }

      if (isOAuthRedirect) {
        mLog.info('DynamicProvider', 'OAuth redirect detected, checking for stored result');

        // Check if the result is already available
        if (typeof window !== 'undefined' && (window as any).dynamicOAuthResult) {
          const result = (window as any).dynamicOAuthResult;
          mLog.info('DynamicProvider', 'Found stored OAuth result, using immediately', {
            hasResult: !!result,
            hasAddress: !!(result?.address),
            hasProvider: !!(result?.provider)
          });

          if (result && result.address) {
            this.currentAddress = result.address;
            await this.setupEthersProvider(result.wallet);

            // Clear the stored result
            delete (window as any).dynamicOAuthResult;

            const connectionResult = {
              success: true,
              address: result.address,
              capabilities: this.getCapabilities()
            };

            mLog.info('DynamicProvider', 'OAuth redirect connection successful (immediate)', connectionResult);
            return connectionResult;
          }
        }

        // If result is not available yet, wait for it
        mLog.info('DynamicProvider', 'OAuth result not ready, waiting for wallet connection');

        // Return a promise that will be resolved by the OAuth redirect handler
        return new Promise((resolve, reject) => {
          // Set up OAuth redirect handler
          if (typeof window !== 'undefined') {
            (window as any).dynamicOAuthRedirectHandler = async (result: any) => {
              mLog.info('DynamicProvider', 'OAuth redirect handler called', {
                hasResult: !!result,
                hasAddress: !!(result?.address),
                hasProvider: !!(result?.provider)
              });

              if (result && result.address) {
                this.currentAddress = result.address;
                await this.setupEthersProvider(result.wallet);

                const connectionResult = {
                  success: true,
                  address: result.address,
                  capabilities: this.getCapabilities()
                };

                mLog.info('DynamicProvider', 'OAuth redirect connection successful', connectionResult);
                resolve(connectionResult);
              } else {
                resolve({
                  success: false,
                  error: 'OAuth redirect failed - no address',
                  capabilities: this.getCapabilities()
                });
              }
            };

            // Also check periodically if the result becomes available
            let checkCount = 0;
            const checkInterval = setInterval(async () => {
              checkCount++;
              if ((window as any).dynamicOAuthResult) {
                clearInterval(checkInterval);
                const result = (window as any).dynamicOAuthResult;
                delete (window as any).dynamicOAuthResult;

                mLog.info('DynamicProvider', 'Found OAuth result via polling', {
                  checkCount,
                  hasAddress: !!(result?.address)
                });

                if (result && result.address) {
                  this.currentAddress = result.address;
                  await this.setupEthersProvider(result.wallet);

                  resolve({
                    success: true,
                    address: result.address,
                    capabilities: this.getCapabilities()
                  });
                } else {
                  resolve({
                    success: false,
                    error: 'OAuth result found but invalid',
                    capabilities: this.getCapabilities()
                  });
                }
              } else if (checkCount >= 50) { // 5 seconds max
                clearInterval(checkInterval);
                reject(new Error('OAuth redirect timeout - no result found'));
              }
            }, 100);
          }

          // Set up timeout
          setTimeout(() => {
            reject(new Error('OAuth redirect timeout'));
          }, 10000); // 10 second timeout for OAuth redirect
        });
      }

      // Normal login flow
      // Dynamic SDK is handled through React hooks, so we need to trigger the modal
      // This will be coordinated with the React component
      if (typeof window !== 'undefined' && (window as any).dynamicLogin) {
        mLog.info('DynamicProvider', 'Calling dynamicLogin function...');
        const result = await (window as any).dynamicLogin();

        mLog.info('DynamicProvider', 'Dynamic login result received', {
          hasResult: !!result,
          hasAddress: !!(result?.address),
          hasProvider: !!(result?.provider)
        });

        if (result && result.address) {
          this.currentAddress = result.address;
          await this.setupEthersProvider(result.wallet);

          const connectionResult = {
            success: true,
            address: result.address,
            capabilities: this.getCapabilities()
          };

          mLog.info('DynamicProvider', 'Connection successful', connectionResult);
          return connectionResult;
        } else {
          mLog.error('DynamicProvider', 'Invalid result from dynamicLogin', { result });
        }
      } else {
        mLog.error('DynamicProvider', 'dynamicLogin function not available on window');
      }

      return {
        success: false,
        error: 'Dynamic login not available or failed',
        capabilities: this.getCapabilities()
      };

    } catch (error) {
      mLog.error('DynamicProvider', 'Connection failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        capabilities: this.getCapabilities()
      };
    }
  }

  private async setupEthersProvider(dynamicWallet: any) {
    if (!dynamicWallet) {
      mLog.warn('DynamicProvider', 'No Dynamic wallet provided');
      return;
    }

    try {
      // Store Dynamic wallet reference for signing operations
      this.dynamicWallet = dynamicWallet;

      mLog.info('DynamicProvider', 'Setting up provider using Dynamic toolkit', {
        walletType: dynamicWallet.connector?.name,
        walletKey: dynamicWallet.key
      });

      // Try Dynamic's toolkit first (works for embedded wallets)
      try {
        const web3Provider = await this.retryGetWeb3Provider(dynamicWallet);
        if (web3Provider) {
          this.cachedEthersProvider = web3Provider as ethers.BrowserProvider;
          mLog.info('DynamicProvider', '✅ Ethers provider created successfully via Dynamic toolkit');
          return;
        }
      } catch (toolkitError) {
        mLog.warn('DynamicProvider', 'Dynamic toolkit failed, using connector.getWalletClient() fallback', {
          error: toolkitError instanceof Error ? toolkitError.message : String(toolkitError)
        });
      }

      // Fallback 2: Use connector.getWalletClient() directly (same approach that works for signing!)
      // NOTE: We used to try wagmi's getPublicClient() here, but it created a JsonRpcProvider
      // with NO wallet connection, which failed for balance reading and transactions.
      // This direct connector approach works for BOTH signing AND balance reading.
      mLog.info('DynamicProvider', '🔧 Using connector.getWalletClient() fallback (unified approach for signing + balance reading)');

      const connector = dynamicWallet.connector;
      if (!connector) {
        throw new Error('No connector available on Dynamic wallet');
      }

      mLog.info('DynamicProvider', '🔍 Connector details', {
        hasConnector: !!connector,
        connectorName: connector.name,
        hasGetWalletClient: !!connector.getWalletClient,
        hasProvider: !!connector.provider,
      });

      // Get the EIP-1193 provider from the connector (same as signing method)
      const eip1193Provider = await connector.getWalletClient?.() || connector.provider;

      if (!eip1193Provider) {
        throw new Error('No EIP-1193 provider available from connector (all fallbacks exhausted)');
      }

      mLog.info('DynamicProvider', '✅ Got EIP-1193 provider from connector, wrapping for mobile deep links');

      // Wrap provider with mobile deep link support (same as signing)
      const wrappedProvider = wrapProviderWithMobileDeepLinks(eip1193Provider, connector);

      // Create ethers BrowserProvider (same as signing)
      this.cachedEthersProvider = new ethers.BrowserProvider(wrappedProvider);

      mLog.info('DynamicProvider', '✅ Ethers provider created successfully via connector.getWalletClient()');
      mLog.info('DynamicProvider', '📝 Unified provider approach: signing + balance reading + transactions all use the same wallet connection');

    } catch (error) {
      mLog.error('DynamicProvider', 'Failed to create ethers provider', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async retryGetWeb3Provider(dynamicWallet: any, maxRetries: number = 5): Promise<any> {
    const delays = [100, 200, 400, 800, 1600]; // Exponential backoff in ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        mLog.info('DynamicProvider', `Attempting to get Web3Provider (attempt ${attempt + 1}/${maxRetries})`);
        const provider = await getWeb3Provider(dynamicWallet);

        if (provider) {
          mLog.info('DynamicProvider', `✅ Successfully got Web3Provider on attempt ${attempt + 1}`);
          return provider;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Check if this is the "Unable to retrieve PublicClient" error
        if (errorMsg.includes('Unable to retrieve PublicClient')) {
          if (attempt < maxRetries - 1) {
            const delay = delays[attempt];
            mLog.warn('DynamicProvider', `PublicClient not ready yet, waiting ${delay}ms before retry ${attempt + 2}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            mLog.error('DynamicProvider', `Failed to get PublicClient after ${maxRetries} attempts`);
            throw error;
          }
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw new Error(`Failed to get Web3Provider after ${maxRetries} attempts`);
  }

  async disconnect(): Promise<void> {
    mLog.info('DynamicProvider', 'Disconnecting');

    if (typeof window !== 'undefined' && (window as any).dynamicLogout) {
      await (window as any).dynamicLogout();
    }

    // Clear all cached state
    this.cachedEthersProvider = null;
    this.currentAddress = null;

    // Clear window state that might persist
    if (typeof window !== 'undefined') {
      delete (window as any).dynamicOAuthResult;
      delete (window as any).dynamicWallet;
      // Note: dynamicUser and dynamicAuthToken are managed by DynamicWrapper
    }

    mLog.info('DynamicProvider', 'Cleared all cached provider state');
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Switching wallet');
    
    // First disconnect
    await this.disconnect();
    
    // Then reconnect
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.dynamicWallet) {
      throw new Error('No Dynamic wallet available for signing');
    }

    try {
      // Get signer directly from wallet connector's provider to bypass Dynamic's broken getSigner()
      mLog.info('DynamicProvider', 'Creating signer directly from wallet connector');

      const connector = this.dynamicWallet.connector;
      if (!connector) {
        throw new Error('No connector available on Dynamic wallet');
      }

      // Log connector structure to find WalletConnect session
      mLog.info('DynamicProvider', '🔍 Connector structure:', {
        connectorKeys: Object.keys(connector).slice(0, 30),
        hasProvider: !!connector.provider,
        hasGetWalletClient: !!connector.getWalletClient,
        providerKeys: connector.provider ? Object.keys(connector.provider).slice(0, 20) : []
      });

      // Get the EIP-1193 provider from the connector
      const eip1193Provider = await connector.getWalletClient?.() || connector.provider;

      if (!eip1193Provider) {
        throw new Error('No provider available from wallet connector');
      }

      // Wrap provider with mobile deep link support BEFORE creating ethers provider
      // This ensures mobile wallets automatically open when signing is requested
      // Pass connector as well so wrapper can check connector.provider
      const wrappedProvider = wrapProviderWithMobileDeepLinks(eip1193Provider, connector);

      // Create ethers provider and signer
      const browserProvider = new ethers.BrowserProvider(wrappedProvider);
      const signer = await browserProvider.getSigner();

      if (!signer) {
        throw new Error('Failed to get signer from wallet provider');
      }

      mLog.info('DynamicProvider', 'Signing message with direct signer', {
        message: message.substring(0, 50) + '...',
        signerAddress: await signer.getAddress()
      });

      const signature = await signer.signMessage(message);
      mLog.info('DynamicProvider', '✅ Message signed successfully');
      return signature;

    } catch (signingError) {
      mLog.error('DynamicProvider', 'Message signing failed', {
        error: signingError instanceof Error ? signingError.message : String(signingError),
        errorCode: (signingError as any)?.code,
        stack: signingError instanceof Error ? signingError.stack : undefined
      });

      // Check if this is a passkey/MFA issue for social login users
      const errorCode = (signingError as any)?.code;
      const errorMessage = signingError instanceof Error ? signingError.message : String(signingError);

      if (errorCode === -32603 || errorMessage.toLowerCase().includes('unknown_error')) {
        throw new Error('Dynamic embedded wallet signing failed: Social login users need to set up a passkey for message signing. This will fall back to JWT authentication.');
      }

      throw signingError;
    }
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    if (!this.dynamicWallet) {
      throw new Error('No Dynamic wallet available for signing');
    }

    try {
      // Get signer directly from wallet connector's provider to bypass Dynamic's broken getSigner()
      mLog.info('DynamicProvider', 'Creating signer directly from wallet connector');

      const connector = this.dynamicWallet.connector;
      if (!connector) {
        throw new Error('No connector available on Dynamic wallet');
      }

      // Log connector structure to find WalletConnect session
      mLog.info('DynamicProvider', '🔍 Connector structure:', {
        connectorKeys: Object.keys(connector).slice(0, 30),
        hasProvider: !!connector.provider,
        hasGetWalletClient: !!connector.getWalletClient,
        providerKeys: connector.provider ? Object.keys(connector.provider).slice(0, 20) : []
      });

      // Get the EIP-1193 provider from the connector
      const eip1193Provider = await connector.getWalletClient?.() || connector.provider;

      if (!eip1193Provider) {
        throw new Error('No provider available from wallet connector');
      }

      // Wrap provider with mobile deep link support BEFORE creating ethers provider
      // This ensures mobile wallets automatically open when signing is requested
      // Pass connector as well so wrapper can check connector.provider
      const wrappedProvider = wrapProviderWithMobileDeepLinks(eip1193Provider, connector);

      // Create ethers provider and signer
      const browserProvider = new ethers.BrowserProvider(wrappedProvider);
      const signer = await browserProvider.getSigner();

      if (!signer) {
        throw new Error('Failed to get signer from wallet provider');
      }

      const tx = {
        to: params.to,
        data: params.data,
        value: params.value ? BigInt(params.value) : undefined,
        gasLimit: params.gasLimit ? BigInt(params.gasLimit.toString()) : undefined,
        gasPrice: params.gasPrice ? BigInt(params.gasPrice.toString()) : undefined,
        nonce: typeof params.nonce === 'string' ? parseInt(params.nonce) : params.nonce,
        chainId: params.chainId
      };

      mLog.info('DynamicProvider', 'Signing transaction with direct signer');
      const signedTx = await signer.signTransaction(tx);
      mLog.info('DynamicProvider', '✅ Transaction signed successfully');
      return signedTx;

    } catch (error) {
      mLog.error('DynamicProvider', 'Transaction signing failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get the ethers provider, setting it up if needed
   * This is the async version that ensures the provider is ready
   */
  async getEthersProviderAsync(): Promise<ethers.BrowserProvider | null> {
    mLog.info('DynamicProvider', 'getEthersProviderAsync() called', {
      hasCachedProvider: !!this.cachedEthersProvider,
      hasDynamicWallet: !!this.dynamicWallet,
      currentAddress: this.currentAddress
    });

    // If we already have a cached provider, return it
    if (this.cachedEthersProvider) {
      mLog.info('DynamicProvider', '✅ Returning cached ethers provider');
      return this.cachedEthersProvider;
    }

    // Provider not cached - try to set it up from Dynamic wallet
    mLog.warn('DynamicProvider', '⚠️ Provider not cached, attempting to restore from Dynamic wallet');

    // Check if Dynamic has a connected wallet
    const dynamicWallet = (window as any).dynamicWallet;
    if (dynamicWallet) {
      mLog.info('DynamicProvider', '🔧 Found Dynamic wallet, setting up ethers provider');
      try {
        await this.setupEthersProvider(dynamicWallet);
        mLog.info('DynamicProvider', '✅ Provider setup complete after page refresh');
        return this.cachedEthersProvider;
      } catch (error) {
        mLog.error('DynamicProvider', '❌ Failed to setup provider from Dynamic wallet', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      mLog.warn('DynamicProvider', '⚠️ No Dynamic wallet found - provider cannot be initialized');
    }

    return null;
  }

  /**
   * Get the ethers provider (sync version for backwards compatibility)
   * @deprecated Use getEthersProviderAsync() instead to ensure provider is set up
   */
  getEthersProvider(): ethers.BrowserProvider | null {
    mLog.info('DynamicProvider', 'getEthersProvider() called (sync)', {
      hasCachedProvider: !!this.cachedEthersProvider,
      cachedProviderType: this.cachedEthersProvider ? this.cachedEthersProvider.constructor.name : 'null',
      hasDynamicWallet: !!this.dynamicWallet,
      currentAddress: this.currentAddress
    });

    if (!this.cachedEthersProvider) {
      mLog.warn('DynamicProvider', '⚠️ getEthersProvider() returning null - provider not initialized!', {
        possibleReasons: [
          'Page was refreshed and provider cache was lost',
          'Use getEthersProviderAsync() instead to auto-restore provider',
          'connect() was never called',
          'setupEthersProvider() failed during login'
        ]
      });
    }

    return this.cachedEthersProvider;
  }

  async getAddress(): Promise<string> {
    if (this.currentAddress) {
      return this.currentAddress as string;
    }

    // Check for OAuth result or Dynamic user state
    if (typeof window !== 'undefined') {
      const oAuthResult = (window as any).dynamicOAuthResult;
      if (oAuthResult && oAuthResult.address) {
        this.currentAddress = oAuthResult.address;
        return oAuthResult.address;
      }

      const dynamicUser = (window as any).dynamicUser;
      if (dynamicUser && dynamicUser.walletAddress) {
        this.currentAddress = dynamicUser.walletAddress;
        return dynamicUser.walletAddress;
      }
    }

    if (!this.cachedEthersProvider) {
      throw new Error('No provider connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    const address = await signer.getAddress();
    this.currentAddress = address;
    return address;
  }

  isConnected(): boolean {
    // First check internal cache
    if (this.cachedEthersProvider && this.currentAddress) {
      return true;
    }

    // Check if Dynamic is actually connected via the global window state
    if (typeof window !== 'undefined') {
      // Check if there's a stored OAuth result (for OAuth redirects)
      const oAuthResult = (window as any).dynamicOAuthResult;
      if (oAuthResult && oAuthResult.address) {
        mLog.debug('DynamicProvider', 'Found OAuth result with address', {
          address: oAuthResult.address
        });

        // Update internal state if we found a valid OAuth result
        this.currentAddress = oAuthResult.address;
        if (oAuthResult.wallet) {
          this.setupEthersProvider(oAuthResult.wallet);
        }
        return true;
      }

      // Check if Dynamic has a connected wallet via the bridge
      // The DynamicWrapper component stores user info and auth tokens
      const dynamicUser = (window as any).dynamicUser;
      const dynamicAuthToken = (window as any).dynamicAuthToken;

      if (dynamicUser && (dynamicUser.walletAddress || dynamicAuthToken)) {
        mLog.debug('DynamicProvider', 'Found Dynamic user with wallet', {
          hasUser: !!dynamicUser,
          hasWalletAddress: !!dynamicUser.walletAddress,
          hasAuthToken: !!dynamicAuthToken
        });

        // Update internal state
        if (dynamicUser.walletAddress && !this.currentAddress) {
          this.currentAddress = dynamicUser.walletAddress;
        }

        // Also check if we can get provider from the dynamic wallet
        const dynamicWallet = (window as any).dynamicWallet;
        if (dynamicWallet && !this.cachedEthersProvider) {
          this.setupEthersProvider(dynamicWallet);
        }

        return true;
      }

      // CRITICAL FIX: Check for wallet connection even without user info
      // MetaMask and other external wallets don't provide user object
      // but they DO set window.dynamicWallet when connected
      const dynamicWallet = (window as any).dynamicWallet;
      if (dynamicWallet && dynamicWallet.address) {
        mLog.debug('DynamicProvider', 'Found Dynamic wallet without user info (external wallet)', {
          hasWallet: !!dynamicWallet,
          address: dynamicWallet.address,
          walletKey: dynamicWallet.key
        });

        // Update internal state
        if (dynamicWallet.address && !this.currentAddress) {
          this.currentAddress = dynamicWallet.address;
        }

        // Set up provider if not cached
        if (!this.cachedEthersProvider) {
          this.setupEthersProvider(dynamicWallet);
        }

        return true;
      }
    }

    return false;
  }

  getUserInfo(): { email?: string; idToken?: string; name?: string } | null {
    // Dynamic provides user info through its React context
    if (typeof window !== 'undefined' && (window as any).dynamicUser) {
      const user = (window as any).dynamicUser;

      mLog.info('DynamicProvider', 'Retrieved Dynamic user info', {
        hasUser: !!user,
        hasEmail: !!(user?.email),
        hasVerifiedCredentials: !!(user?.verifiedCredentials),
        credentialCount: user?.verifiedCredentials?.length || 0,
        userKeys: Object.keys(user || {}),
        accessToken: user?.accessToken ? 'present' : 'missing',
        authToken: user?.authToken ? 'present' : 'missing',
        token: user?.token ? 'present' : 'missing',
        jwt: user?.jwt ? 'present' : 'missing',
        // Log all properties to find the JWT token
        allUserProps: user ? Object.keys(user).reduce((acc, key) => {
          acc[key] = typeof user[key] === 'string' && user[key].length > 100 ? `${user[key].substring(0, 50)}...` : user[key];
          return acc;
        }, {} as any) : null
      });

      // Get JWT token using official Dynamic.xyz methods
      let idToken = null;

      // Method 1: Try to access getAuthToken from window (set by DynamicWrapper)
      if (typeof window !== 'undefined' && (window as any).dynamicGetAuthToken) {
        try {
          idToken = (window as any).dynamicGetAuthToken();

          if (idToken) {
            mLog.info('DynamicProvider', 'Retrieved JWT token using getAuthToken from window', {
              hasToken: true,
              tokenLength: idToken.length
            });
          } else {
            mLog.info('DynamicProvider', 'getAuthToken returned undefined - user may not be logged in');
          }
        } catch (tokenError) {
          mLog.warn('DynamicProvider', 'Failed to call getAuthToken from window', {
            error: tokenError instanceof Error ? tokenError.message : String(tokenError)
          });
        }
      } else {
        mLog.info('DynamicProvider', 'getAuthToken not available on window', {
          hasFunction: !!(typeof window !== 'undefined' && (window as any).dynamicGetAuthToken),
          dynamicWindowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('dynamic')) : []
        });
      }

      // Method 2: Try official localStorage keys from documentation
      if (!idToken && typeof window !== 'undefined') {
        // Check primary token location
        const primaryToken = localStorage.getItem('dynamic_authentication_token');
        const minifiedToken = localStorage.getItem('dynamic_min_authentication_token');

        mLog.info('DynamicProvider', 'Checking official localStorage keys', {
          hasPrimaryToken: !!primaryToken,
          hasMinifiedToken: !!minifiedToken,
          primaryTokenLength: primaryToken ? primaryToken.length : 0,
          minifiedTokenLength: minifiedToken ? minifiedToken.length : 0,
          primaryTokenPreview: primaryToken ? `${primaryToken.substring(0, 20)}...` : null,
          minifiedTokenPreview: minifiedToken ? `${minifiedToken.substring(0, 20)}...` : null
        });

        if (primaryToken) {
          mLog.info('DynamicProvider', 'Using primary token from localStorage');
          idToken = primaryToken;
        } else if (minifiedToken) {
          mLog.info('DynamicProvider', 'Using minified token from localStorage');
          idToken = minifiedToken;
        }
      }

      // Method 3: Fallback to legacy approaches
      if (!idToken) {
        mLog.info('DynamicProvider', 'Official methods failed, trying legacy approaches');

        try {
          // Get all localStorage keys
          const allStorageKeys = Object.keys(localStorage);
          const dynamicKeys = allStorageKeys.filter(key =>
            key.toLowerCase().includes('dynamic') ||
            key.toLowerCase().includes('auth') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('jwt')
          );

          mLog.info('DynamicProvider', 'localStorage auth-related keys', {
            allAuthKeys: dynamicKeys,
            values: dynamicKeys.reduce((acc, key) => {
              const value = localStorage.getItem(key);
              // Only show first/last chars for security, but also show if it might contain a JWT
              const preview = value ? `${value.substring(0, 8)}...${value.substring(value.length - 8)}` : null;
              const mightContainJWT = value ? (value.includes('eyJ') || value.includes('.')) : false;
              acc[key] = { preview, length: value?.length || 0, mightContainJWT };
              return acc;
            }, {} as any)
          });

          // Try common Dynamic token storage keys (direct JWTs)
          const tokenKeys = [
            'dynamic_authentication_token',
            'dynamic_min_authentication_token',
            'dynamic-token',
            'dynamic_token',
            'dynamic_auth_token',
            'dynamic_jwt',
            '@dynamic-labs/sdk-react-core:authentication',
            '@dynamic-labs/sdk:auth',
            'dynamic_user_session',
            'dynamic_session_token'
          ];

          for (const key of tokenKeys) {
            const token = localStorage.getItem(key);
            if (token) {
              // Validate it looks like a JWT (has 3 parts separated by dots)
              if (token.split('.').length === 3) {
                idToken = token;
                mLog.info('DynamicProvider', 'Found JWT token in localStorage', {
                  key,
                  tokenLength: token.length,
                  tokenStart: token.substring(0, 20) + '...'
                });
                break;
              } else {
                mLog.debug('DynamicProvider', 'Found token but not JWT format', {
                  key,
                  tokenLength: token.length
                });
              }
            }
          }

          // If still no token, examine Dynamic session data for embedded JWTs
          if (!idToken) {
            for (const key of dynamicKeys) {
              const value = localStorage.getItem(key);
              if (value) {
                try {
                  // Check if it's a direct JWT first
                  if (value.split('.').length === 3 && value.length > 100) {
                    idToken = value;
                    mLog.info('DynamicProvider', 'Found JWT-like token', {
                      key,
                      tokenLength: value.length
                    });
                    break;
                  }

                  // Try to parse as JSON if it looks like base64 or JSON
                  let parsed = null;
                  if (value.startsWith('"') && value.endsWith('"')) {
                    // Might be JSON-encoded string, try to parse twice
                    try {
                      const firstParse = JSON.parse(value);
                      if (typeof firstParse === 'string') {
                        // Try to parse again
                        parsed = JSON.parse(firstParse);
                      } else {
                        parsed = firstParse;
                      }
                    } catch {
                      // Just try once
                      parsed = JSON.parse(value);
                    }
                  } else if (value.startsWith('{') || value.startsWith('[')) {
                    // Looks like JSON
                    parsed = JSON.parse(value);
                  } else if (value.length > 20 && !value.includes(' ')) {
                    // Might be base64, try to decode
                    try {
                      const decoded = atob(value);
                      if (decoded.startsWith('{')) {
                        parsed = JSON.parse(decoded);
                      }
                    } catch {
                      // Not base64 or not JSON
                    }
                  }

                  // If we have parsed data, look for JWT tokens inside
                  if (parsed && typeof parsed === 'object') {
                    const searchForJWT = (obj: any, path = ''): string | null => {
                      if (typeof obj === 'string' && obj.split('.').length === 3 && obj.length > 100) {
                        mLog.info('DynamicProvider', 'Found embedded JWT token', {
                          key,
                          path,
                          tokenLength: obj.length
                        });
                        return obj;
                      }

                      if (typeof obj === 'object' && obj !== null) {
                        for (const [k, v] of Object.entries(obj)) {
                          const result = searchForJWT(v, path ? `${path}.${k}` : k);
                          if (result) return result;
                        }
                      }

                      return null;
                    };

                    const foundToken = searchForJWT(parsed);
                    if (foundToken) {
                      idToken = foundToken;
                      break;
                    }
                  }
                } catch (parseError) {
                  // Skip this key if we can't parse it
                  mLog.debug('DynamicProvider', 'Could not parse storage value', {
                    key,
                    error: parseError instanceof Error ? parseError.message : String(parseError)
                  });
                }
              }
            }
          }

          if (!idToken) {
            mLog.warn('DynamicProvider', 'No JWT token found in localStorage');
          }
        } catch (storageError) {
          mLog.warn('DynamicProvider', 'Failed to access localStorage', {
            error: storageError instanceof Error ? storageError.message : String(storageError)
          });
        }
      }

      // Method 3: Check if token is available directly on user object or window
      if (!idToken && user) {
        const userTokenFields = ['accessToken', 'authToken', 'token', 'jwt', 'idToken'];
        for (const field of userTokenFields) {
          if (user[field] && typeof user[field] === 'string' && user[field].split('.').length === 3) {
            idToken = user[field];
            mLog.info('DynamicProvider', 'Found JWT token on user object', {
              field,
              tokenLength: idToken.length
            });
            break;
          }
        }
      }

      // Method 4: Check if Dynamic bridge exposed an auth token directly
      if (!idToken && typeof window !== 'undefined' && (window as any).dynamicAuthToken) {
        const token = (window as any).dynamicAuthToken;
        if (typeof token === 'string' && token.split('.').length === 3) {
          idToken = token;
          mLog.info('DynamicProvider', 'Found JWT token from Dynamic bridge', {
            tokenLength: idToken.length
          });
        }
      }

      // Log all user properties to find JWT token if we still don't have one
      if (!idToken) {
        mLog.info('DynamicProvider', 'All user properties', user || {});
      }

      // Extract email and other info from Dynamic user
      return {
        email: user?.email,
        name: user?.firstName || user?.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        idToken: idToken // Dynamic's JWT token
      };
    }
    return null;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canSign: true,
      canTransact: true,
      canSwitchWallets: true,
      isAuthOnly: false
    };
  }
}