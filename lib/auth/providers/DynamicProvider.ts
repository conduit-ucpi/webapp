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

          // Create ethers provider from Dynamic's provider
          if (result.provider) {
            try {
              // Dynamic provider might need special handling
              // Check if it's already an ethers provider or needs wrapping
              if (result.provider.request) {
                // It's an EIP-1193 provider, wrap it with ethers
                this.cachedEthersProvider = new ethers.BrowserProvider(result.provider);
                mLog.info('DynamicProvider', 'Ethers provider created from EIP-1193 provider');
              } else if (result.provider._isProvider) {
                // It might already be an ethers provider
                this.cachedEthersProvider = result.provider;
                mLog.info('DynamicProvider', 'Using existing ethers provider');
              } else {
                // Try to use the connector's provider instead
                const connector = result.provider;
                if (connector && connector.getWalletClient) {
                  // Try to get the wallet client from the connector
                  const walletClient = await connector.getWalletClient();
                  if (walletClient && walletClient.transport) {
                    this.cachedEthersProvider = new ethers.BrowserProvider(walletClient.transport);
                    mLog.info('DynamicProvider', 'Ethers provider created from wallet client');
                  }
                } else {
                  mLog.warn('DynamicProvider', 'Cannot create ethers provider - unknown provider type', {
                    providerType: typeof result.provider,
                    hasRequest: !!result.provider.request,
                    isProvider: !!result.provider._isProvider
                  });
                }
              }
            } catch (providerError) {
              mLog.error('DynamicProvider', 'Failed to create ethers provider', {
                error: providerError instanceof Error ? providerError.message : String(providerError)
              });
              // Continue without ethers provider - we can still return success
            }
          } else {
            mLog.warn('DynamicProvider', 'No provider in result, using fallback');
          }

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

    if (!this.cachedEthersProvider) {
      throw new Error('No provider connected');
    }

    const signer = await this.cachedEthersProvider.getSigner();
    this.currentAddress = await signer.getAddress();
    return this.currentAddress;
  }

  isConnected(): boolean {
    return !!this.cachedEthersProvider && !!this.currentAddress;
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