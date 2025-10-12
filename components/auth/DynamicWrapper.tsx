/**
 * Dynamic.xyz React wrapper component
 * Provides the Dynamic context and bridges to our unified provider system
 */

import React, { useEffect } from 'react';
import { DynamicContextProvider, useDynamicContext, useDynamicEvents } from '@dynamic-labs/sdk-react-core';
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

    // Expose Dynamic methods to our unified provider system
    if (typeof window !== 'undefined') {
      (window as any).dynamicLogin = async () => {
        mLog.info('DynamicBridge', 'Opening Dynamic auth flow');

        // Check if user is already connected
        if (primaryWallet && primaryWallet.address) {
          mLog.info('DynamicBridge', 'User already connected, returning existing connection', {
            address: primaryWallet.address,
            connector: primaryWallet.connector?.name
          });

          let provider = primaryWallet.connector;
          if ((primaryWallet.connector as any)?.provider) {
            provider = (primaryWallet.connector as any).provider;
          }

          const finalUser = user || {
            email: null,
            walletAddress: primaryWallet.address
          };

          return {
            address: primaryWallet.address,
            provider: provider,
            user: finalUser
          };
        }

        // Open the auth flow
        setShowAuthFlow(true);

        // Return a promise that will be resolved by the authSuccess event
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

        await handleLogOut();
      };

      (window as any).dynamicUser = user;

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