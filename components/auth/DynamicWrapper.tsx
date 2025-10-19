/**
 * Dynamic.xyz React wrapper component
 * Provides the Dynamic context and bridges to our unified provider system
 */

import React, { useEffect, useMemo } from 'react';
import { DynamicContextProvider, useDynamicContext, useDynamicEvents } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
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
  const { setShowAuthFlow, primaryWallet, user, handleLogOut } = dynamicContext || {};
  const getAuthToken = (dynamicContext as any)?.getAuthToken;

  // Store active login promise
  const activeLoginPromise = React.useRef<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Use Dynamic's event system for connection detection
  useDynamicEvents('walletAdded', (wallet, userWallets) => {
    mLog.info('DynamicBridge', 'walletAdded event received', {
      wallet: !!wallet,
      address: wallet?.address,
      walletKey: wallet?.key,
      userWalletsCount: userWallets?.length || 0,
      hasActivePromise: !!activeLoginPromise.current
    });

    // If we have an active login promise, resolve it
    if (activeLoginPromise.current && wallet && wallet.address) {
      // Get the provider
      let provider = wallet.connector;
      if ((wallet.connector as any)?.provider) {
        provider = (wallet.connector as any).provider;
      }

      const finalUser = user || {
        email: null,
        walletAddress: wallet.address
      };

      mLog.info('DynamicBridge', '✅ Resolving login promise with walletAdded event', {
        address: wallet.address,
        walletName: wallet.connector?.name,
        hasUser: !!user
      });

      activeLoginPromise.current.resolve({
        address: wallet.address,
        provider: provider,
        wallet: wallet,
        user: finalUser
      });

      activeLoginPromise.current = null;
    } else if (!activeLoginPromise.current) {
      mLog.warn('DynamicBridge', 'walletAdded fired but no active promise to resolve');
    }
  });

  useDynamicEvents('primaryWalletChanged', (newPrimaryWallet) => {
    mLog.info('DynamicBridge', 'primaryWalletChanged event received', {
      wallet: !!newPrimaryWallet,
      address: newPrimaryWallet?.address,
      walletKey: newPrimaryWallet?.key,
      hasActivePromise: !!activeLoginPromise.current
    });

    // If we have an active login promise, resolve it
    if (activeLoginPromise.current && newPrimaryWallet && newPrimaryWallet.address) {
      // Get the provider
      let provider = newPrimaryWallet.connector;
      if ((newPrimaryWallet.connector as any)?.provider) {
        provider = (newPrimaryWallet.connector as any).provider;
      }

      const finalUser = user || {
        email: null,
        walletAddress: newPrimaryWallet.address
      };

      mLog.info('DynamicBridge', '✅ Resolving login promise with primaryWalletChanged event', {
        address: newPrimaryWallet.address,
        walletName: newPrimaryWallet.connector?.name,
        hasUser: !!user
      });

      activeLoginPromise.current.resolve({
        address: newPrimaryWallet.address,
        provider: provider,
        wallet: newPrimaryWallet,
        user: finalUser
      });

      activeLoginPromise.current = null;
    } else if (!activeLoginPromise.current) {
      mLog.warn('DynamicBridge', 'primaryWalletChanged fired but no active promise to resolve');
    }
  });

  useDynamicEvents('authInit', () => {
    mLog.info('DynamicBridge', 'authInit event received - authentication process started');
  });

  useDynamicEvents('authFlowOpen', () => {
    mLog.info('DynamicBridge', 'authFlowOpen event received - auth modal opened');
  });

  useDynamicEvents('authFlowClose', () => {
    mLog.info('DynamicBridge', 'authFlowClose event received');

    // In connect-only mode, the flow closes immediately after wallet selection
    // but the wallet events fire slightly later. Don't reject the promise here.
    // The promise will either:
    // 1. Resolve when walletAdded/primaryWalletChanged fires
    // 2. Timeout after 60 seconds (set in dynamicLogin)
    // 3. Get cancelled by user calling logout

    // Only log for debugging - don't reject
    if (activeLoginPromise.current) {
      mLog.info('DynamicBridge', 'Auth flow closed, waiting for wallet events...', {
        hasActivePromise: true
      });

      // Give wallet events more time to fire after auth flow closes
      // Check if we already have a connected wallet
      setTimeout(() => {
        if (activeLoginPromise.current && primaryWallet && primaryWallet.address) {
          mLog.info('DynamicBridge', 'Auth flow closed but wallet already connected, resolving immediately', {
            address: primaryWallet.address,
            walletKey: primaryWallet.key
          });

          let provider = primaryWallet.connector;
          if ((primaryWallet.connector as any)?.provider) {
            provider = (primaryWallet.connector as any).provider;
          }

          const finalUser = user || {
            email: null,
            walletAddress: primaryWallet.address
          };

          activeLoginPromise.current.resolve({
            address: primaryWallet.address,
            provider: provider,
            wallet: primaryWallet,
            user: finalUser
          });

          activeLoginPromise.current = null;
        }
      }, 100); // Small delay to let React state updates propagate
    }
  });

  useDynamicEvents('authFlowCancelled', () => {
    mLog.info('DynamicBridge', 'authFlowCancelled event received - user cancelled');

    // This event specifically means the user cancelled the auth flow
    if (activeLoginPromise.current) {
      mLog.warn('DynamicBridge', 'Auth flow was cancelled by user');
      activeLoginPromise.current.reject(new Error('Authentication cancelled by user'));
      activeLoginPromise.current = null;
    }
  });

  useEffect(() => {
    if (!dynamicContext) {
      mLog.error('DynamicBridge', 'Dynamic context not available');
      return;
    }

    mLog.info('DynamicBridge', 'Dynamic context properties', {
      hasSetShowAuthFlow: !!setShowAuthFlow,
      hasPrimaryWallet: !!primaryWallet,
      hasUser: !!user,
      hasHandleLogOut: !!handleLogOut,
      hasGetAuthToken: !!getAuthToken,
      contextKeys: Object.keys(dynamicContext || {})
    });

    // Check if this is an OAuth redirect (user came back from Google login)
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

    if (isOAuthRedirect && primaryWallet && primaryWallet.address) {
      mLog.info('DynamicBridge', 'OAuth redirect detected with connected wallet, handling auto-resolution', {
        address: primaryWallet.address,
        walletKey: primaryWallet.key,
        hasOAuthCode: urlParams.has('dynamicOauthCode')
      });

      // Store the OAuth result for when the provider requests it
      if (typeof window !== 'undefined') {
        (window as any).dynamicOAuthResult = {
          address: primaryWallet.address,
          provider: primaryWallet.connector,
          wallet: primaryWallet,
          user: user || { email: null, walletAddress: primaryWallet.address }
        };

        mLog.info('DynamicBridge', 'OAuth result stored for provider pickup', {
          address: primaryWallet.address
        });

        // Try to resolve any pending promises (immediate and delayed)
        const resolveHandlers = () => {
          // Call the OAuth redirect handler if it exists
          if ((window as any).dynamicOAuthRedirectHandler) {
            mLog.info('DynamicBridge', 'Calling OAuth redirect handler');
            (window as any).dynamicOAuthRedirectHandler((window as any).dynamicOAuthResult);
          }

          // Also try to resolve any waiting login promise
          if (activeLoginPromise.current) {
            mLog.info('DynamicBridge', 'Resolving pending login promise with OAuth result');
            activeLoginPromise.current.resolve({
              address: primaryWallet.address,
              provider: primaryWallet.connector,
              wallet: primaryWallet,
              user: user || { email: null, walletAddress: primaryWallet.address }
            });
            activeLoginPromise.current = null;
          }

          // Clean up OAuth parameters from URL after successful authentication
          setTimeout(() => {
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              mLog.info('DynamicBridge', 'OAuth parameters cleaned from URL');
            }
          }, 500);
        };

        // Try immediately and also with a small delay
        resolveHandlers();
        setTimeout(resolveHandlers, 100);
      }
    }

    // Expose Dynamic methods to our unified provider system
    if (typeof window !== 'undefined') {
      (window as any).dynamicLogin = async () => {
        mLog.info('DynamicBridge', 'Opening Dynamic auth flow');

        // Check if user is already connected (including OAuth redirects)
        if (primaryWallet && primaryWallet.address) {
          mLog.info('DynamicBridge', 'User already connected, checking connection validity', {
            address: primaryWallet.address,
            connector: primaryWallet.connector?.name,
            walletKey: primaryWallet.key
          });

          // Check if this connection has a valid provider
          const connector = primaryWallet.connector;
          const walletKey = primaryWallet.key?.toLowerCase() || '';
          const connectorName = connector?.name?.toLowerCase() || '';

          // Check if embedded wallet (these always work with Dynamic toolkit)
          const isEmbeddedWallet = walletKey.includes('dynamicwaas') ||
                                  walletKey.includes('turnkey') ||
                                  connectorName.includes('waas') ||
                                  connectorName.includes('turnkey') ||
                                  connectorName.includes('dynamic');

          // For external wallets, check if we can extract a provider
          let hasValidProvider = isEmbeddedWallet; // Embedded wallets are always valid

          if (!isEmbeddedWallet && connector) {
            // Check if provider can be extracted (cast to any for dynamic property access)
            const connectorAny = connector as any;
            hasValidProvider = !!(
              connectorAny.provider ||
              (connectorAny.getProvider && typeof connectorAny.getProvider === 'function') ||
              (connectorAny.request && typeof connectorAny.request === 'function')
            );
          }

          if (!hasValidProvider) {
            const connectorAny = connector as any;
            mLog.warn('DynamicBridge', 'Stale connection detected - cannot extract provider, forcing logout', {
              walletKey: primaryWallet.key,
              connectorName: connector?.name,
              hasProvider: !!connectorAny?.provider,
              hasGetProvider: !!(connectorAny?.getProvider && typeof connectorAny.getProvider === 'function'),
              hasRequest: !!(connectorAny?.request && typeof connectorAny.request === 'function')
            });

            // Force disconnect the stale connection
            if (handleLogOut) {
              await handleLogOut();
              mLog.info('DynamicBridge', 'Stale connection cleared, will show modal');
            }

            // Fall through to show modal
          } else {
            // Valid connection, return it
            let provider = primaryWallet.connector;
            if ((primaryWallet.connector as any)?.provider) {
              provider = (primaryWallet.connector as any).provider;
            }

            const finalUser = user || {
              email: null,
              walletAddress: primaryWallet.address
            };

            const result = {
              address: primaryWallet.address,
              provider: provider,
              wallet: primaryWallet,
              user: finalUser
            };

            // Check if this was from an OAuth redirect and clean up URL
            const urlParams = new URLSearchParams(window.location.search);
            const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

            if (isOAuthRedirect) {
              mLog.info('DynamicBridge', 'OAuth redirect detected in already-connected path, cleaning up URL');

              // Clean up OAuth parameters from URL
              setTimeout(() => {
                if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                  const cleanUrl = window.location.origin + window.location.pathname;
                  window.history.replaceState({}, document.title, cleanUrl);
                  mLog.info('DynamicBridge', 'OAuth parameters cleaned from URL in shortcut path');
                }
              }, 100);
            }

            return result;
          }
        }

        // Clear any existing promise before starting new auth flow
        if (activeLoginPromise.current) {
          mLog.warn('DynamicBridge', 'Clearing existing login promise before starting new auth flow');
          activeLoginPromise.current.reject(new Error('New auth flow started'));
          activeLoginPromise.current = null;
        }

        // Open the auth flow
        setShowAuthFlow(true);

        // Return a promise that will be resolved by the wallet events
        return new Promise((resolve, reject) => {
          // Store the promise for the event handler
          activeLoginPromise.current = { resolve, reject };

          // Set up a timeout in case events don't fire
          const timeoutId = setTimeout(() => {
            if (activeLoginPromise.current) {
              mLog.error('DynamicBridge', 'Authentication timeout - no events received');
              activeLoginPromise.current.reject(new Error('Authentication timeout'));
              activeLoginPromise.current = null;
            }
          }, 60000); // 60 second timeout

          // Store the timeout so we can clear it on success
          const originalResolve = resolve;
          const originalReject = reject;

          activeLoginPromise.current.resolve = (value) => {
            clearTimeout(timeoutId);
            originalResolve(value);
          };

          activeLoginPromise.current.reject = (error) => {
            clearTimeout(timeoutId);
            originalReject(error);
          };
        });
      };

      (window as any).dynamicLogout = async () => {
        mLog.info('DynamicBridge', 'Dynamic logout called');

        // Clear any pending login promise
        if (activeLoginPromise.current) {
          activeLoginPromise.current.reject(new Error('Logout called'));
          activeLoginPromise.current = null;
        }

        // Clear window state on logout
        delete (window as any).dynamicUser;
        delete (window as any).dynamicWallet;
        delete (window as any).dynamicAuthToken;
        delete (window as any).dynamicGetAuthToken;
        delete (window as any).dynamicOAuthResult;

        await handleLogOut();

        mLog.info('DynamicBridge', 'Cleared all Dynamic window state on logout');
      };

      // Update or clear user and wallet state based on current values
      if (user) {
        (window as any).dynamicUser = user;
      } else {
        delete (window as any).dynamicUser;
      }

      // Store the primary wallet for the DynamicProvider to use with ethers toolkit
      if (primaryWallet) {
        (window as any).dynamicWallet = primaryWallet;
      } else {
        delete (window as any).dynamicWallet;
      }

      // Expose getAuthToken function from Dynamic
      if (getAuthToken) {
        (window as any).dynamicGetAuthToken = getAuthToken;
      }

      // Expose auth token directly if available
      try {
        if (user && (user as any).authToken) {
          (window as any).dynamicAuthToken = (user as any).authToken;
        } else if (user && (user as any).accessToken) {
          (window as any).dynamicAuthToken = (user as any).accessToken;
        } else {
          // Clear auth token if no user or no token
          delete (window as any).dynamicAuthToken;
        }
      } catch (error) {
        mLog.debug('DynamicBridge', 'Could not access auth token from user', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }, [setShowAuthFlow, primaryWallet, user, handleLogOut, getAuthToken]);

  return null; // This component doesn't render anything
}

export function DynamicWrapper({ children, config }: DynamicWrapperProps) {
  // Create wagmi config and query client FIRST before any early returns
  const wagmiConfig = useMemo(() => {
    if (!config.dynamicEnvironmentId) {
      return null;
    }

    const chain = config.chainId === 8453 ? base : baseSepolia;

    mLog.info('DynamicWrapper', 'Creating wagmi configuration', {
      chainId: config.chainId,
      chainName: chain.name
    });

    const wagmiCfg = createConfig({
      chains: [chain] as const,
      transports: {
        [base.id]: http(config.chainId === 8453 ? config.rpcUrl : 'https://mainnet.base.org'),
        [baseSepolia.id]: http(config.chainId === 84532 ? config.rpcUrl : 'https://sepolia.base.org')
      }
    });

    // Store wagmi config on window for direct access by DynamicProvider
    if (typeof window !== 'undefined') {
      (window as any).__wagmiConfig = wagmiCfg;
    }

    return wagmiCfg;
  }, [config.chainId, config.rpcUrl, config.dynamicEnvironmentId]);

  const queryClient = useMemo(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
        },
      },
    });
  }, []);

  // Early return if no Dynamic config
  if (!config.dynamicEnvironmentId) {
    return <>{children}</>;
  }

  // Validate environment ID format
  if (!config.dynamicEnvironmentId.includes('-')) {
    mLog.error('DynamicWrapper', 'Invalid Dynamic environment ID format', {
      environmentId: config.dynamicEnvironmentId
    });
    return <>{children}</>;
  }

  if (!wagmiConfig) {
    mLog.error('DynamicWrapper', 'Failed to create wagmi config');
    return <>{children}</>;
  }

  try {
    mLog.info('DynamicWrapper', 'Creating Dynamic settings with WagmiProvider + DynamicWagmiConnector', {
      environmentId: config.dynamicEnvironmentId.substring(0, 10) + '...',
      chainId: config.chainId
    });

    const dynamicSettings = createDynamicConfig({
      dynamicEnvironmentId: config.dynamicEnvironmentId,
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      explorerBaseUrl: config.explorerBaseUrl || ''
    });

    mLog.info('DynamicWrapper', 'Initializing provider stack: WagmiProvider -> DynamicContextProvider -> DynamicWagmiConnector', {
      environmentId: config.dynamicEnvironmentId.substring(0, 10) + '...',
      chainId: config.chainId
    });

    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicContextProvider
            settings={dynamicSettings as any}
            theme="auto"
            children={
              <DynamicWagmiConnector
                children={
                  <>
                    <DynamicBridge />
                    {children}
                  </>
                }
              />
            }
          />
        </QueryClientProvider>
      </WagmiProvider>
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