/**
 * Dynamic.xyz provider implementation
 * A modern, reliable wallet connection solution that handles mobile properly
 */

import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { AuthConfig } from '../types';
import {
  UnifiedProvider,
  ConnectionResult,
  ProviderCapabilities,
  TransactionRequest
} from '../types/unified-provider';
import { ethers } from "ethers";
import { getWeb3Provider, getSigner } from '@dynamic-labs/ethers-v6';
import { mLog } from '../../../utils/mobileLogger';

export class DynamicProvider implements UnifiedProvider {
  private config: AuthConfig;
  private cachedEthersProvider: ethers.BrowserProvider | null = null;
  private currentAddress: string | null = null;
  private dynamicInstance: any = null;

  constructor(config: AuthConfig) {
    this.config = config;
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
          await this.setupEthersProvider(result.wallet || result.provider);

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
            this.setupEthersProvider(result.wallet || result.provider);

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
            (window as any).dynamicOAuthRedirectHandler = (result: any) => {
              mLog.info('DynamicProvider', 'OAuth redirect handler called', {
                hasResult: !!result,
                hasAddress: !!(result?.address),
                hasProvider: !!(result?.provider)
              });

              if (result && result.address) {
                this.currentAddress = result.address;
                this.setupEthersProvider(result.wallet || result.provider);

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
            const checkInterval = setInterval(() => {
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
                  this.setupEthersProvider(result.wallet || result.provider);

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
          await this.setupEthersProvider(result.wallet || result.provider);

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
    if (dynamicWallet) {
      try {
        mLog.debug('DynamicProvider', 'Setting up ethers provider with comprehensive approach', {
          walletType: typeof dynamicWallet,
          walletName: dynamicWallet?.connector?.name,
          hasWalletConnector: !!dynamicWallet?.connector,
          connectorType: typeof dynamicWallet?.connector,
          hasConnectorProvider: !!(dynamicWallet?.connector as any)?.provider,
          hasConnectorEthersProvider: !!(dynamicWallet?.connector as any)?.ethersProvider
        });

        // Try comprehensive provider extraction matching DynamicWrapper logic
        let extractedProvider = await this.extractProviderFromDynamicWallet(dynamicWallet);

        if (extractedProvider) {
          // Try to create ethers provider from extracted provider
          try {
            const ethersProvider = new ethers.BrowserProvider(extractedProvider);
            this.cachedEthersProvider = ethersProvider;
            mLog.info('DynamicProvider', '✅ Ethers provider created from extracted provider', {
              providerType: typeof extractedProvider,
              providerConstructor: extractedProvider.constructor?.name
            });
            return;
          } catch (ethersError) {
            mLog.warn('DynamicProvider', 'Failed to create ethers provider from extracted provider', {
              error: ethersError instanceof Error ? ethersError.message : String(ethersError),
              providerType: typeof extractedProvider
            });
          }
        }

        // Fallback: Try Dynamic's V3 ethers integration
        mLog.debug('DynamicProvider', 'Trying Dynamic V3 getWeb3Provider as fallback');
        const web3Provider = await getWeb3Provider(dynamicWallet);

        if (web3Provider) {
          this.cachedEthersProvider = web3Provider;
          mLog.info('DynamicProvider', '✅ Ethers provider created using Dynamic V3 ethers integration');
          return;
        }

        // Final fallback: Try legacy extraction methods
        mLog.warn('DynamicProvider', 'All primary methods failed, trying legacy fallbacks');
        await this.tryEthersProviderFallbacks(dynamicWallet);

      } catch (providerError) {
        mLog.error('DynamicProvider', 'Exception while setting up ethers provider', {
          error: providerError instanceof Error ? providerError.message : String(providerError),
          stack: providerError instanceof Error ? providerError.stack : undefined
        });

        // Try fallback methods even if primary approach throws
        try {
          await this.tryEthersProviderFallbacks(dynamicWallet);
        } catch (fallbackError) {
          mLog.error('DynamicProvider', 'All ethers provider fallbacks failed', {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          });
        }
      }
    } else {
      mLog.warn('DynamicProvider', 'No Dynamic wallet passed to setupEthersProvider');
    }
  }

  private async extractProviderFromDynamicWallet(dynamicWallet: any): Promise<any | null> {
    mLog.debug('DynamicProvider', 'Extracting provider from Dynamic wallet', {
      hasWallet: !!dynamicWallet,
      hasConnector: !!dynamicWallet?.connector,
      connectorName: dynamicWallet?.connector?.name,
      connectorType: typeof dynamicWallet?.connector
    });

    if (!dynamicWallet?.connector) {
      mLog.warn('DynamicProvider', 'No connector found on Dynamic wallet');
      return null;
    }

    try {
      // Match the logic from DynamicWrapper (lines 120-126)
      // Try to get ethers provider first
      if ((dynamicWallet.connector as any)?.ethersProvider) {
        mLog.info('DynamicProvider', 'Found ethersProvider on connector');
        return (dynamicWallet.connector as any).ethersProvider;
      }

      if ((dynamicWallet.connector as any)?.provider) {
        mLog.info('DynamicProvider', 'Found provider on connector');
        return (dynamicWallet.connector as any).provider;
      }

      if (dynamicWallet.connector) {
        mLog.info('DynamicProvider', 'Using connector itself as provider');
        return dynamicWallet.connector;
      }

      mLog.warn('DynamicProvider', 'No suitable provider found on connector');
      return null;

    } catch (error) {
      mLog.error('DynamicProvider', 'Error while extracting provider from Dynamic wallet', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  private async tryEthersProviderFallbacks(dynamicWallet: any) {
    mLog.info('DynamicProvider', 'Trying ethers provider fallback methods');

    // Fallback 1: Try to use connector provider directly
    if (dynamicWallet?.connector?.provider) {
      try {
        mLog.debug('DynamicProvider', 'Fallback 1: Using connector provider directly');
        const provider = new ethers.BrowserProvider(dynamicWallet.connector.provider);
        this.cachedEthersProvider = provider;
        mLog.info('DynamicProvider', '✅ Fallback 1 successful: Created ethers provider from connector');
        return;
      } catch (connectorError) {
        mLog.warn('DynamicProvider', 'Fallback 1 failed', {
          error: connectorError instanceof Error ? connectorError.message : String(connectorError)
        });
      }
    }

    // Fallback 2: Try accessing embedded provider
    if (dynamicWallet?.connector?.getProvider) {
      try {
        mLog.debug('DynamicProvider', 'Fallback 2: Using getProvider method');
        const providerResult = await dynamicWallet.connector.getProvider();
        if (providerResult) {
          const provider = new ethers.BrowserProvider(providerResult);
          this.cachedEthersProvider = provider;
          mLog.info('DynamicProvider', '✅ Fallback 2 successful: Created ethers provider from getProvider');
          return;
        }
      } catch (getProviderError) {
        mLog.warn('DynamicProvider', 'Fallback 2 failed', {
          error: getProviderError instanceof Error ? getProviderError.message : String(getProviderError)
        });
      }
    }

    // Fallback 3: Check for window.ethereum as a last resort
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        mLog.debug('DynamicProvider', 'Fallback 3: Using window.ethereum');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        this.cachedEthersProvider = provider;
        mLog.info('DynamicProvider', '✅ Fallback 3 successful: Created ethers provider from window.ethereum');
        return;
      } catch (windowEthereumError) {
        mLog.warn('DynamicProvider', 'Fallback 3 failed', {
          error: windowEthereumError instanceof Error ? windowEthereumError.message : String(windowEthereumError)
        });
      }
    }

    mLog.error('DynamicProvider', 'All fallback methods exhausted - no ethers provider available');
    throw new Error('Unable to create ethers provider - all methods failed');
  }


  async disconnect(): Promise<void> {
    mLog.info('DynamicProvider', 'Disconnecting and clearing all cached state');

    if (typeof window !== 'undefined' && (window as any).dynamicLogout) {
      await (window as any).dynamicLogout();
    }

    // Clear all cached state
    this.cachedEthersProvider = null;
    this.currentAddress = null;

    // Also clear any OAuth results that might be cached
    if (typeof window !== 'undefined') {
      delete (window as any).dynamicOAuthResult;
    }

    mLog.info('DynamicProvider', 'All cached state cleared');
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Switching wallet');
    
    // First disconnect
    await this.disconnect();
    
    // Then reconnect
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    try {
      // Check if we're on mobile and have primaryWallet available
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const primaryWallet = typeof window !== 'undefined' ? (window as any).dynamicPrimaryWallet : null;

      mLog.info('DynamicProvider', 'Starting message signing process', {
        message: message.substring(0, 50) + '...',
        isMobile,
        hasPrimaryWallet: !!primaryWallet,
        hasCachedProvider: !!this.cachedEthersProvider
      });

      // On mobile with external wallets (like MetaMask), use Dynamic's primaryWallet.signMessage()
      // for proper mobile redirect handling
      if (isMobile && primaryWallet && primaryWallet.signMessage) {
        try {
          mLog.info('DynamicProvider', 'Using Dynamic primaryWallet for mobile signing');
          const signature = await primaryWallet.signMessage(message);
          mLog.info('DynamicProvider', '✅ Mobile signing successful via primaryWallet');
          return signature;
        } catch (primaryWalletError) {
          mLog.warn('DynamicProvider', 'primaryWallet signing failed, falling back to ethers', {
            error: primaryWalletError instanceof Error ? primaryWalletError.message : String(primaryWalletError)
          });
          // Continue to ethers fallback
        }
      }

      // Desktop or mobile fallback: use standard ethers signing
      if (!this.cachedEthersProvider) {
        throw new Error('No ethers provider available for signing');
      }

      mLog.info('DynamicProvider', 'Using ethers provider for signing');
      const signer = await this.cachedEthersProvider.getSigner();
      const signature = await signer.signMessage(message);

      mLog.info('DynamicProvider', '✅ Message signed successfully via ethers');
      return signature;

    } catch (signingError) {
      mLog.error('DynamicProvider', 'Message signing failed', {
        error: signingError instanceof Error ? signingError.message : String(signingError),
        errorCode: (signingError as any)?.code,
        stack: signingError instanceof Error ? signingError.stack : undefined
      });

      // Check if this is a passkey/MFA issue
      const errorCode = (signingError as any)?.code;
      const errorMessage = signingError instanceof Error ? signingError.message : String(signingError);

      if (errorCode === -32603 || errorMessage.toLowerCase().includes('unknown_error')) {
        throw new Error('Dynamic embedded wallet signing failed: Social login users need to set up a passkey for message signing. This will fall back to JWT authentication.');
      }

      throw signingError;
    }
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    const signer = await this.cachedEthersProvider.getSigner();

    const tx = {
      to: params.to,
      data: params.data,
      value: params.value ? BigInt(params.value) : undefined,
      gasLimit: params.gasLimit ? BigInt(params.gasLimit.toString()) : undefined,
      gasPrice: params.gasPrice ? BigInt(params.gasPrice.toString()) : undefined,
      nonce: typeof params.nonce === 'string' ? parseInt(params.nonce) : params.nonce,
      chainId: params.chainId
    };

    const signedTx = await signer.signTransaction(tx);
    return signedTx;
  }

  getEthersProvider(): ethers.BrowserProvider | null {
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

      // Check for primaryWallet address
      const primaryWallet = (window as any).dynamicPrimaryWallet;
      if (primaryWallet && primaryWallet.address) {
        this.currentAddress = primaryWallet.address;
        return primaryWallet.address;
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
        if (oAuthResult.provider || oAuthResult.wallet) {
          // Note: This is synchronous check, so we don't await here
          // The provider will be set up later when needed
          this.setupEthersProvider(oAuthResult.wallet || oAuthResult.provider).catch(error => {
            mLog.warn('DynamicProvider', 'Failed to setup provider in isConnected check', {
              error: error instanceof Error ? error.message : String(error)
            });
          });
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

      // Method 3: Check for directly exposed auth token from DynamicWrapper
      if (!idToken && typeof window !== 'undefined') {
        const directAuthToken = (window as any).dynamicAuthToken;
        if (directAuthToken && typeof directAuthToken === 'string' && directAuthToken.split('.').length === 3) {
          mLog.info('DynamicProvider', 'Found directly exposed JWT token from DynamicWrapper', {
            hasToken: true,
            tokenLength: directAuthToken.length,
            tokenPreview: `${directAuthToken.substring(0, 20)}...`
          });
          idToken = directAuthToken;
        } else {
          mLog.info('DynamicProvider', 'Direct auth token not valid JWT', {
            hasToken: !!directAuthToken,
            tokenType: typeof directAuthToken,
            isJWT: !!(directAuthToken && typeof directAuthToken === 'string' && directAuthToken.split('.').length === 3)
          });
        }
      }

      // Method 4: Fallback to legacy localStorage scanning (if still needed)
      if (!idToken) {
        mLog.info('DynamicProvider', 'All methods failed, trying legacy localStorage scanning');

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