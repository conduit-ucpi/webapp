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
      if ((signingError as any)?.code === -32603) {
        throw new Error('Dynamic embedded wallet signing failed. Please ensure passkey is set up after social login.');
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

      // Get JWT token using Dynamic's getAuthToken function
      let idToken = null;

      mLog.info('DynamicProvider', 'Checking for getAuthToken function', {
        hasGetAuthToken: !!(typeof window !== 'undefined' && (window as any).dynamicGetAuthToken),
        windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('dynamic')) : [],
        allDynamicWindowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('dynamic')).map(k => ({ key: k, type: typeof (window as any)[k] })) : []
      });

      if (typeof window !== 'undefined' && (window as any).dynamicGetAuthToken) {
        try {
          idToken = (window as any).dynamicGetAuthToken();
          mLog.info('DynamicProvider', 'Retrieved JWT token using getAuthToken', {
            hasToken: !!idToken,
            tokenLength: idToken ? idToken.length : 0
          });
        } catch (tokenError) {
          mLog.warn('DynamicProvider', 'Failed to get auth token', {
            error: tokenError instanceof Error ? tokenError.message : String(tokenError)
          });
        }
      } else {
        mLog.warn('DynamicProvider', 'getAuthToken function not available, trying localStorage');

        // Try getting JWT from localStorage as per Dynamic docs
        try {
          // Check all possible Dynamic token keys
          const allStorageKeys = Object.keys(localStorage);
          const dynamicKeys = allStorageKeys.filter(key => key.includes('dynamic'));

          mLog.info('DynamicProvider', 'localStorage Dynamic keys', {
            allDynamicKeys: dynamicKeys,
            values: dynamicKeys.reduce((acc, key) => {
              const value = localStorage.getItem(key);
              acc[key] = value ? `${value.substring(0, 50)}...` : null;
              return acc;
            }, {} as any)
          });

          const tokenFromStorage = localStorage.getItem('dynamic_authentication_token') ||
                                   localStorage.getItem('dynamic_min_authentication_token') ||
                                   localStorage.getItem('dynamic-token') ||
                                   localStorage.getItem('dynamic_token');

          if (tokenFromStorage) {
            idToken = tokenFromStorage;
            mLog.info('DynamicProvider', 'Retrieved JWT token from localStorage', {
              hasToken: !!idToken,
              tokenLength: idToken ? idToken.length : 0
            });
          } else {
            mLog.warn('DynamicProvider', 'No token found in localStorage under any Dynamic key');
          }
        } catch (storageError) {
          mLog.warn('DynamicProvider', 'Failed to access localStorage', {
            error: storageError instanceof Error ? storageError.message : String(storageError)
          });
        }
      }

      // Log all user properties to find JWT token
      mLog.info('DynamicProvider', 'All user properties', user || {});

      // Extract email and other info from Dynamic user
      return {
        email: user?.email,
        name: user?.firstName || user?.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        idToken: idToken, // Dynamic's JWT token from localStorage
        dynamicUserId: user?.id,
        verifiedCredentials: user?.verifiedCredentials
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