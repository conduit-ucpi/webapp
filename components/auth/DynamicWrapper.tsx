/**
 * Dynamic.xyz React wrapper component
 * Provides the Dynamic context and bridges to our unified provider system
 */

import React, { useEffect } from 'react';
import { DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { createDynamicConfig } from '@/lib/dynamicConfig';
import { AuthConfig } from '@/lib/auth/types';
import { mLog } from '@/utils/mobileLogger';

interface DynamicWrapperProps {
  children: React.ReactNode;
  config: AuthConfig;
}

// Bridge component that connects Dynamic to our global window methods
function DynamicBridge() {
  const dynamicContext = useDynamicContext();

  // Handle potential initialization errors
  if (!dynamicContext) {
    mLog.error('DynamicBridge', 'Dynamic context not available');
    return null;
  }

  const { setShowAuthFlow, primaryWallet, user, handleLogOut, getAuthToken } = dynamicContext;

  mLog.info('DynamicBridge', 'Dynamic context properties', {
    hasSetShowAuthFlow: !!setShowAuthFlow,
    hasPrimaryWallet: !!primaryWallet,
    hasUser: !!user,
    hasHandleLogOut: !!handleLogOut,
    hasGetAuthToken: !!getAuthToken,
    contextKeys: Object.keys(dynamicContext || {})
  });

  useEffect(() => {
    // Expose Dynamic methods to our unified provider system
    if (typeof window !== 'undefined') {
      (window as any).dynamicLogin = async () => {
        mLog.info('DynamicBridge', 'Opening Dynamic auth flow');
        setShowAuthFlow(true);

        // Return a promise that resolves when wallet is connected
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 300; // 30 seconds with 100ms intervals

          const checkConnection = async () => {
            attempts++;

            if (primaryWallet && user) {
              mLog.info('DynamicBridge', 'Dynamic connection successful', {
                address: primaryWallet.address,
                walletName: primaryWallet.connector?.name,
                attempts
              });

              // Try to get the actual EIP-1193 provider from the wallet
              let provider = null;
              try {
                // Check for different ways Dynamic exposes the provider
                if (primaryWallet.connector?.getWalletClient) {
                  const walletClient = await primaryWallet.connector.getWalletClient();
                  provider = walletClient?.transport || walletClient;
                } else if (primaryWallet.connector?.getProvider) {
                  provider = await primaryWallet.connector.getProvider();
                } else if (primaryWallet.connector?.provider) {
                  provider = primaryWallet.connector.provider;
                } else {
                  // Fallback to the connector itself
                  provider = primaryWallet.connector;
                }

                mLog.info('DynamicBridge', 'Provider details', {
                  hasProvider: !!provider,
                  providerType: typeof provider,
                  hasRequest: !!(provider?.request),
                  isProvider: !!(provider?._isProvider),
                  methods: provider ? Object.getOwnPropertyNames(provider) : []
                });
              } catch (providerError) {
                mLog.warn('DynamicBridge', 'Failed to get provider from wallet', {
                  error: providerError instanceof Error ? providerError.message : String(providerError)
                });
                provider = primaryWallet.connector; // Fallback
              }

              resolve({
                address: primaryWallet.address,
                provider: provider,
                user: user
              });
            } else if (attempts >= maxAttempts) {
              mLog.error('DynamicBridge', 'Connection timeout after 30 seconds');
              reject(new Error('Dynamic connection timeout'));
            } else {
              // Keep checking until connected
              setTimeout(checkConnection, 100);
            }
          };

          checkConnection();
        });
      };

      (window as any).dynamicLogout = async () => {
        mLog.info('DynamicBridge', 'Dynamic logout called');
        await handleLogOut();
      };

      (window as any).dynamicUser = user;

      // Also expose getAuthToken function from Dynamic
      if (getAuthToken) {
        (window as any).dynamicGetAuthToken = getAuthToken;
      }
    }
  }, [setShowAuthFlow, primaryWallet, user, handleLogOut, getAuthToken]);

  return null; // This component doesn't render anything
}

export function DynamicWrapper({ children, config }: DynamicWrapperProps) {
  if (!config.dynamicEnvironmentId) {
    // No Dynamic config, return children without wrapper
    return <>{children}</>;
  }

  // Validate environment ID format
  if (!config.dynamicEnvironmentId.includes('-')) {
    mLog.error('DynamicWrapper', 'Invalid Dynamic environment ID format', {
      environmentId: config.dynamicEnvironmentId
    });
    return <>{children}</>;
  }

  try {
    const dynamicSettings = createDynamicConfig({
      dynamicEnvironmentId: config.dynamicEnvironmentId,
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      explorerBaseUrl: config.explorerBaseUrl || ''
    });

    mLog.info('DynamicWrapper', 'Initializing Dynamic with environment', {
      environmentId: config.dynamicEnvironmentId.substring(0, 10) + '...',
      chainId: config.chainId
    });

    return (
      <DynamicContextProvider
        settings={dynamicSettings as any}
        theme="auto"
        children={
          <>
            <DynamicBridge />
            {children}
          </>
        }
      />
    );
  } catch (error) {
    mLog.error('DynamicWrapper', 'Failed to initialize Dynamic provider', {
      error: error instanceof Error ? error.message : String(error),
      environmentId: config.dynamicEnvironmentId
    });

    // Fall back to rendering children without Dynamic
    return <>{children}</>;
  }
}