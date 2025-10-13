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
          this.setupEthersProvider(result.provider);

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
            this.setupEthersProvider(result.provider);

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
                this.setupEthersProvider(result.provider);

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
                  this.setupEthersProvider(result.provider);

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
          this.setupEthersProvider(result.provider);

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

  private setupEthersProvider(provider: any) {
    if (provider) {
      try {
        mLog.debug('DynamicProvider', 'Setting up ethers provider', {
          providerType: typeof provider,
          hasRequest: !!provider.request,
          isProvider: !!provider._isProvider,
          hasProvider: !!(provider as any).provider,
          constructorName: provider.constructor?.name
        });

        // Method 1: Check if it's already an EIP-1193 provider
        if (provider.request && typeof provider.request === 'function') {
          this.cachedEthersProvider = new ethers.BrowserProvider(provider);
          mLog.info('DynamicProvider', '✅ Ethers provider created from direct EIP-1193 provider');
          return;
        }

        // Method 2: Check if it has a nested provider property (common with connectors)
        if ((provider as any).provider && (provider as any).provider.request) {
          this.cachedEthersProvider = new ethers.BrowserProvider((provider as any).provider);
          mLog.info('DynamicProvider', '✅ Ethers provider created from nested provider');
          return;
        }

        // Method 3: Check if it's already an ethers provider
        if (provider._isProvider) {
          this.cachedEthersProvider = provider;
          mLog.info('DynamicProvider', '✅ Using existing ethers provider');
          return;
        }

        // Method 4: Try to get wallet client asynchronously (for embedded wallets)
        if (provider.getWalletClient && typeof provider.getWalletClient === 'function') {
          mLog.debug('DynamicProvider', 'Attempting wallet client approach');

          // Handle both sync and async getWalletClient
          const walletClientResult = provider.getWalletClient();

          if (walletClientResult && typeof walletClientResult.then === 'function') {
            // It's a Promise
            walletClientResult.then((walletClient: any) => {
              if (walletClient && walletClient.transport && walletClient.transport.request) {
                this.cachedEthersProvider = new ethers.BrowserProvider(walletClient.transport);
                mLog.info('DynamicProvider', '✅ Ethers provider created from async wallet client');
              } else {
                mLog.warn('DynamicProvider', 'Wallet client missing transport or request method', {
                  hasWalletClient: !!walletClient,
                  hasTransport: !!(walletClient?.transport),
                  hasRequest: !!(walletClient?.transport?.request)
                });
              }
            }).catch((error: any) => {
              mLog.warn('DynamicProvider', 'Failed to get async wallet client', {
                error: error?.message || String(error)
              });
            });
          } else if (walletClientResult && walletClientResult.transport) {
            // It's a direct wallet client
            this.cachedEthersProvider = new ethers.BrowserProvider(walletClientResult.transport);
            mLog.info('DynamicProvider', '✅ Ethers provider created from sync wallet client');
            return;
          }
        }

        // If we haven't returned yet, log what we found but couldn't use
        mLog.warn('DynamicProvider', '❌ Unable to create ethers provider from any method', {
          providerType: typeof provider,
          hasRequest: !!provider.request,
          isProvider: !!provider._isProvider,
          hasNestedProvider: !!(provider as any).provider,
          hasGetWalletClient: !!(provider.getWalletClient),
          constructorName: provider.constructor?.name,
          availableKeys: Object.keys(provider || {})
        });

      } catch (providerError) {
        mLog.error('DynamicProvider', 'Exception while setting up ethers provider', {
          error: providerError instanceof Error ? providerError.message : String(providerError),
          stack: providerError instanceof Error ? providerError.stack : undefined
        });
      }
    } else {
      mLog.warn('DynamicProvider', 'No provider passed to setupEthersProvider');
    }
  }

  async disconnect(): Promise<void> {
    mLog.info('DynamicProvider', 'Disconnecting');

    if (typeof window !== 'undefined' && (window as any).dynamicLogout) {
      await (window as any).dynamicLogout();
    }

    this.cachedEthersProvider = null;
    this.currentAddress = null;
  }

  async switchWallet(): Promise<ConnectionResult> {
    mLog.info('DynamicProvider', 'Switching wallet');
    
    // First disconnect
    await this.disconnect();
    
    // Then reconnect
    return this.connect();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.cachedEthersProvider) {
      throw new Error('No ethers provider available for signing');
    }

    try {
      const signer = await this.cachedEthersProvider.getSigner();

      mLog.info('DynamicProvider', 'Attempting to sign message with Dynamic embedded wallet', {
        message: message.substring(0, 50) + '...',
        signerAddress: await signer.getAddress()
      });

      const signature = await signer.signMessage(message);

      mLog.info('DynamicProvider', 'Message signed successfully with Dynamic embedded wallet');
      return signature;

    } catch (signingError) {
      mLog.error('DynamicProvider', 'Dynamic embedded wallet signing failed', {
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
      return this.currentAddress;
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
        if (oAuthResult.provider) {
          this.setupEthersProvider(oAuthResult.provider);
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

      // Try multiple approaches to get JWT token
      let idToken = null;

      // Method 1: Try Dynamic's getAuthToken function
      mLog.info('DynamicProvider', 'Checking for getAuthToken function', {
        hasGetAuthToken: !!(typeof window !== 'undefined' && (window as any).dynamicGetAuthToken),
        windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('dynamic')) : [],
        allDynamicWindowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('dynamic')).map(k => ({ key: k, type: typeof (window as any)[k] })) : []
      });

      if (typeof window !== 'undefined' && (window as any).dynamicGetAuthToken) {
        try {
          // Try synchronous call first
          idToken = (window as any).dynamicGetAuthToken();

          // If it returns a promise, we can't await it here but log for debugging
          if (idToken && typeof idToken.then === 'function') {
            mLog.info('DynamicProvider', 'getAuthToken returned promise - cannot await in synchronous context');
            idToken = null; // Reset and try other methods
          } else if (idToken) {
            mLog.info('DynamicProvider', 'Retrieved JWT token using getAuthToken', {
              hasToken: !!idToken,
              tokenLength: idToken ? idToken.length : 0
            });
          }
        } catch (tokenError) {
          mLog.warn('DynamicProvider', 'Failed to get auth token via getAuthToken', {
            error: tokenError instanceof Error ? tokenError.message : String(tokenError)
          });
        }
      }

      // Method 2: Try localStorage with more comprehensive key search
      if (!idToken) {
        mLog.info('DynamicProvider', 'getAuthToken failed or not available, trying localStorage');

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