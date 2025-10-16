/**
 * Dynamic.xyz provider implementation
 * A modern, reliable wallet connection solution that handles mobile properly
 */

import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { getWeb3Provider, getSigner } from '@dynamic-labs/ethers-v6';
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
    if (dynamicWallet) {
      try {
        mLog.debug('DynamicProvider', 'Setting up ethers provider using Dynamic toolkit', {
          walletType: dynamicWallet.connector?.name,
          hasWallet: !!dynamicWallet,
          walletConnector: dynamicWallet.connector?.constructor?.name
        });

        // Try Dynamic's official ethers toolkit first
        try {
          const provider = await getWeb3Provider(dynamicWallet);
          if (provider) {
            this.cachedEthersProvider = provider;
            mLog.info('DynamicProvider', '✅ Ethers provider created using Dynamic toolkit');
            return;
          } else {
            mLog.warn('DynamicProvider', 'Dynamic toolkit returned null provider, trying fallback');
          }
        } catch (toolkitError) {
          mLog.warn('DynamicProvider', 'Dynamic toolkit failed, trying manual fallback', {
            error: toolkitError instanceof Error ? toolkitError.message : String(toolkitError)
          });
        }

        // Fallback: Manual provider extraction for external wallets (MetaMask, etc)
        mLog.info('DynamicProvider', 'Attempting manual provider extraction fallback');

        // Check if the wallet has a connector with a provider
        if (dynamicWallet.connector) {
          const connector = dynamicWallet.connector;

          // Method 1: Direct provider property
          if (connector.provider && connector.provider.request) {
            this.cachedEthersProvider = new ethers.BrowserProvider(connector.provider);
            mLog.info('DynamicProvider', '✅ Ethers provider created from connector.provider (fallback)');
            return;
          }

          // Method 2: EIP-1193 provider on connector
          if (connector.request && typeof connector.request === 'function') {
            this.cachedEthersProvider = new ethers.BrowserProvider(connector);
            mLog.info('DynamicProvider', '✅ Ethers provider created from connector directly (fallback)');
            return;
          }

          // Method 3: Get wallet client approach
          if (connector.getWalletClient && typeof connector.getWalletClient === 'function') {
            try {
              const walletClient = await connector.getWalletClient();
              if (walletClient && walletClient.transport && walletClient.transport.request) {
                this.cachedEthersProvider = new ethers.BrowserProvider(walletClient.transport);
                mLog.info('DynamicProvider', '✅ Ethers provider created from wallet client (fallback)');
                return;
              }
            } catch (wcError) {
              mLog.debug('DynamicProvider', 'Wallet client approach failed', {
                error: wcError instanceof Error ? wcError.message : String(wcError)
              });
            }
          }
        }

        mLog.error('DynamicProvider', '❌ Failed to create ethers provider with all methods');

      } catch (providerError) {
        mLog.error('DynamicProvider', 'Exception while setting up ethers provider', {
          error: providerError instanceof Error ? providerError.message : String(providerError),
          stack: providerError instanceof Error ? providerError.stack : undefined
        });
      }
    } else {
      mLog.warn('DynamicProvider', 'No Dynamic wallet passed to setupEthersProvider');
    }
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
    // Get the current Dynamic wallet from the window state
    const dynamicWallet = typeof window !== 'undefined' && (window as any).dynamicWallet;

    if (!dynamicWallet) {
      throw new Error('No Dynamic wallet available for signing');
    }

    try {
      // Try Dynamic's official ethers toolkit first
      try {
        const signer = await getSigner(dynamicWallet);
        mLog.info('DynamicProvider', 'Attempting to sign message with Dynamic toolkit signer', {
          message: message.substring(0, 50) + '...',
          signerAddress: await signer.getAddress()
        });
        const signature = await signer.signMessage(message);
        mLog.info('DynamicProvider', 'Message signed successfully with Dynamic toolkit');
        return signature;
      } catch (toolkitError) {
        mLog.warn('DynamicProvider', 'Dynamic toolkit signing failed, trying fallback', {
          error: toolkitError instanceof Error ? toolkitError.message : String(toolkitError)
        });

        // Check for specific errors that shouldn't use fallback
        const errorMessage = toolkitError instanceof Error ? toolkitError.message : String(toolkitError);
        if (errorMessage.includes('Social login users') || errorMessage.includes('passkey')) {
          throw toolkitError;
        }
      }

      // Fallback: Use cached provider or manual signing
      if (this.cachedEthersProvider) {
        mLog.info('DynamicProvider', 'Using cached ethers provider for signing (fallback)');
        const signer = await this.cachedEthersProvider.getSigner();
        const signature = await signer.signMessage(message);
        mLog.info('DynamicProvider', 'Message signed successfully with cached provider');
        return signature;
      }

      // Last resort: Try to get provider from connector directly
      if (dynamicWallet.connector) {
        mLog.info('DynamicProvider', 'Attempting direct connector signing (last resort)');
        let provider: ethers.BrowserProvider | null = null;

        if (dynamicWallet.connector.provider && dynamicWallet.connector.provider.request) {
          provider = new ethers.BrowserProvider(dynamicWallet.connector.provider);
        } else if (dynamicWallet.connector.request) {
          provider = new ethers.BrowserProvider(dynamicWallet.connector);
        }

        if (provider) {
          const signer = await provider.getSigner();
          const signature = await signer.signMessage(message);
          mLog.info('DynamicProvider', 'Message signed successfully with direct connector');
          return signature;
        }
      }

      throw new Error('Unable to sign message: No working provider available');

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
    // Get the current Dynamic wallet from the window state
    const dynamicWallet = typeof window !== 'undefined' && (window as any).dynamicWallet;

    if (!dynamicWallet) {
      throw new Error('No Dynamic wallet available for signing');
    }

    let signer: ethers.Signer;

    // Try Dynamic's official ethers toolkit first
    try {
      signer = await getSigner(dynamicWallet);
    } catch (toolkitError) {
      mLog.warn('DynamicProvider', 'Dynamic toolkit failed for transaction signing, using fallback', {
        error: toolkitError instanceof Error ? toolkitError.message : String(toolkitError)
      });

      // Fallback: Use cached provider or create from connector
      if (this.cachedEthersProvider) {
        signer = await this.cachedEthersProvider.getSigner();
      } else if (dynamicWallet.connector) {
        let provider: ethers.BrowserProvider | null = null;

        if (dynamicWallet.connector.provider && dynamicWallet.connector.provider.request) {
          provider = new ethers.BrowserProvider(dynamicWallet.connector.provider);
        } else if (dynamicWallet.connector.request) {
          provider = new ethers.BrowserProvider(dynamicWallet.connector);
        }

        if (provider) {
          signer = await provider.getSigner();
        } else {
          throw new Error('Unable to create provider for transaction signing');
        }
      } else {
        throw new Error('No provider available for transaction signing');
      }
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