/**
 * Dynamic.xyz React wrapper component
 * Provides the Dynamic context and bridges to our unified provider system
 */

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { DynamicContextProvider, DynamicWidget, useDynamicContext, useDynamicEvents } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { createDynamicConfig } from '@/lib/dynamicConfig';
import { AuthConfig } from '@/lib/auth/types';
import { mLog } from '@/utils/mobileLogger';

// Global coordination to prevent duplicate logging across bridge instances
let globalBridgeSetup = false;
const globalBridgeId = Math.random().toString(36).substr(2, 9);

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
  const activeLoginPromise = useRef<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Track if we've already set up window methods to avoid duplicate logging
  const windowMethodsSetup = useRef(false);
  const lastUserRef = useRef(user);
  const lastPrimaryWalletRef = useRef(primaryWallet);
  const bridgeInstanceId = useRef(Math.random().toString(36).substr(2, 9));

  // Only log when actual state changes and only from the primary bridge instance
  const hasStateChanged = useMemo(() => {
    const userChanged = lastUserRef.current !== user;
    const walletChanged = lastPrimaryWalletRef.current !== primaryWallet;

    if (userChanged || walletChanged) {
      lastUserRef.current = user;
      lastPrimaryWalletRef.current = primaryWallet;
      return true;
    }
    return false;
  }, [user, primaryWallet]);

  // Only log when state actually changes and only from the primary instance
  if (hasStateChanged && bridgeInstanceId.current === globalBridgeId) {
    mLog.info('DynamicBridge', 'DynamicBridge useEffect running', {
      hasUser: !!user,
      hasPrimaryWallet: !!primaryWallet,
      hasGetAuthToken: !!getAuthToken,
      bridgeId: bridgeInstanceId.current
    });
  }

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
        wallet: wallet, // Pass the Dynamic wallet object for V3 ethers integration
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

    // Update auth system with wallet connection state
    if (newPrimaryWallet && newPrimaryWallet.address && typeof window !== 'undefined') {
      (window as any).dynamicWalletConnected = {
        address: newPrimaryWallet.address,
        isConnected: true,
        wallet: newPrimaryWallet
      };
    }

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
        wallet: newPrimaryWallet, // Pass the Dynamic wallet object for V3 ethers integration
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
            wallet: primaryWallet, // Pass the Dynamic wallet object for V3 ethers integration
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

  // Memoized OAuth redirect handler to prevent recreation
  const handleOAuthRedirect = useCallback(() => {
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

        // Clean up OAuth parameters from URL
        setTimeout(() => {
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            mLog.info('DynamicBridge', 'OAuth parameters cleaned from URL');
          }
        }, 500);
      }
    }
  }, [primaryWallet, user]);

  // Memoized window methods setup to prevent recreation on every render
  const setupWindowMethods = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Only set up once globally, but allow any instance to do it if not set up yet
    if ((window as any).dynamicLogin && (window as any).dynamicLogout) {
      return; // Already set up
    }

    (window as any).dynamicLogin = async () => {
      mLog.info('DynamicBridge', 'Opening Dynamic auth flow');

      // Check if user is already connected
      if (primaryWallet && primaryWallet.address) {
        return {
          address: primaryWallet.address,
          provider: primaryWallet.connector,
          wallet: primaryWallet,
          user: user || { email: null, walletAddress: primaryWallet.address }
        };
      }

      // Clear any existing promise
      if (activeLoginPromise.current) {
        activeLoginPromise.current.reject(new Error('New auth flow started'));
        activeLoginPromise.current = null;
      }

      // Open auth flow
      setShowAuthFlow(true);

      return new Promise((resolve, reject) => {
        activeLoginPromise.current = { resolve, reject };

        const timeoutId = setTimeout(() => {
          if (activeLoginPromise.current) {
            mLog.error('DynamicBridge', 'Authentication timeout');
            activeLoginPromise.current.reject(new Error('Authentication timeout'));
            activeLoginPromise.current = null;
          }
        }, 60000);

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

      if (activeLoginPromise.current) {
        activeLoginPromise.current.reject(new Error('Logout called'));
        activeLoginPromise.current = null;
      }

      // Clear globals
      delete (window as any).dynamicUser;
      delete (window as any).dynamicPrimaryWallet;
      delete (window as any).dynamicGetAuthToken;
      delete (window as any).dynamicAuthToken;
      delete (window as any).dynamicOAuthResult;

      windowMethodsSetup.current = false; // Allow re-setup after logout

      await handleLogOut();
    };
  }, [setShowAuthFlow, primaryWallet, user, handleLogOut]);

  // Handle OAuth redirect - only run once when needed
  useEffect(() => {
    handleOAuthRedirect();
  }, [handleOAuthRedirect]);

  // Set up window methods - any instance can set them up if not available
  useEffect(() => {
    if (!dynamicContext) {
      if (bridgeInstanceId.current === globalBridgeId) {
        mLog.error('DynamicBridge', 'Dynamic context not available');
      }
      return;
    }

    if (hasStateChanged && bridgeInstanceId.current === globalBridgeId) {
      mLog.info('DynamicBridge', 'Dynamic context properties', {
        hasSetShowAuthFlow: !!setShowAuthFlow,
        hasPrimaryWallet: !!primaryWallet,
        hasUser: !!user,
        hasHandleLogOut: !!handleLogOut,
        hasGetAuthToken: !!getAuthToken,
        bridgeId: bridgeInstanceId.current
      });
    }

    // Any instance can set up window methods if they're not available
    // This ensures authentication always works even if primary instance fails
    setupWindowMethods();
  }, [dynamicContext, setupWindowMethods, hasStateChanged, setShowAuthFlow, primaryWallet, user, handleLogOut, getAuthToken]);

  // Update window globals when state changes - only from primary instance
  useEffect(() => {
    if (typeof window !== 'undefined' && bridgeInstanceId.current === globalBridgeId) {
      (window as any).dynamicUser = user;
      (window as any).dynamicPrimaryWallet = primaryWallet;

      if (getAuthToken) {
        (window as any).dynamicGetAuthToken = getAuthToken;
      }

      // Handle auth token
      if (user && hasStateChanged) {
        const tokenFields = ['authToken', 'accessToken', 'token', 'jwt', 'idToken'];
        let foundToken = null;

        for (const field of tokenFields) {
          const tokenValue = (user as any)[field];
          if (tokenValue && typeof tokenValue === 'string' && tokenValue.split('.').length === 3) {
            foundToken = tokenValue;
            break;
          }
        }

        if (foundToken) {
          (window as any).dynamicAuthToken = foundToken;
        }
      }
    }
  }, [user, primaryWallet, getAuthToken, hasStateChanged]);

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
            <DynamicWidget />
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