import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';
import { mLog } from '@/utils/mobileLogger';

interface ConnectWalletEmbeddedProps {
  buttonText?: string;
  useSmartRouting?: boolean;
  showTwoOptionLayout?: boolean;
  className?: string;
  compact?: boolean;
  onSuccess?: () => void;
  autoConnect?: boolean;
}

export default function ConnectWalletEmbedded({
  buttonText = "Get Started",
  useSmartRouting = true,
  showTwoOptionLayout = false,
  className = "",
  compact = false,
  onSuccess,
  autoConnect = false
}: ConnectWalletEmbeddedProps) {
  const { user, isLoading, connect, authenticateBackend, isConnected, address } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Track if auto-auth has been attempted to prevent duplicate attempts
  const autoAuthAttemptedRef = useRef(false);
  const previousConnectedRef = useRef(isConnected);
  const isInitialMountRef = useRef(true);

  // Store latest callbacks in refs to avoid dependency issues
  const authenticateBackendRef = useRef(authenticateBackend);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    authenticateBackendRef.current = authenticateBackend;
  }, [authenticateBackend]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Auto-authenticate when wallet connects (handles OAuth redirects and manual connections)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

    // Detect connection transition (not connected -> connected)
    const justConnected = !previousConnectedRef.current && isConnected;

    // Special case: OAuth redirect where component mounts already connected
    // (DynamicBridge may have already connected before this component mounted)
    const isOAuthMount = isInitialMountRef.current && hasOAuthParams && isConnected;

    previousConnectedRef.current = isConnected;
    isInitialMountRef.current = false;

    // Trigger auto-auth if either:
    // 1. Connection just happened (transition detected)
    // 2. Mounted with OAuth params and already connected
    const shouldAutoAuth = justConnected || isOAuthMount;

    // Early exit conditions
    if (!shouldAutoAuth) {
      return; // No trigger condition met
    }

    if (autoAuthAttemptedRef.current) {
      mLog.debug('ConnectWalletEmbedded', 'Auto-auth already attempted, skipping');
      return; // Already attempted auto-auth, don't try again
    }

    if (!address) {
      mLog.debug('ConnectWalletEmbedded', 'Connected but no address yet');
      return; // Wait for address
    }

    if (user) {
      mLog.debug('ConnectWalletEmbedded', 'Connected and already authenticated');
      autoAuthAttemptedRef.current = true;
      return; // Already authenticated
    }

    // All conditions met: trigger auto-auth
    const handleAutoAuth = async () => {
      mLog.info('ConnectWalletEmbedded', 'Auto-authenticating with backend', {
        address,
        isConnected,
        hasUser: !!user,
        trigger: isOAuthMount ? 'OAuth mount' : 'connection transition'
      });

      try {
        setIsAuthenticating(true);
        autoAuthAttemptedRef.current = true; // Mark as attempted to prevent duplicates

        const authSuccess = await authenticateBackendRef.current({
          success: true,
          address: address,
          capabilities: {
            canSign: true,
            canTransact: true,
            canSwitchWallets: true,
            isAuthOnly: false
          }
        });

        if (authSuccess) {
          mLog.info('ConnectWalletEmbedded', '✅ Auto-authentication successful');
          onSuccessRef.current?.();
        } else {
          mLog.error('ConnectWalletEmbedded', 'Auto-authentication failed');
          autoAuthAttemptedRef.current = false; // Allow retry on failure
        }
      } catch (error) {
        mLog.error('ConnectWalletEmbedded', 'Auto-authentication error', {
          error: error instanceof Error ? error.message : String(error)
        });
        autoAuthAttemptedRef.current = false; // Allow retry on error
      } finally {
        setIsAuthenticating(false);
      }
    };

    handleAutoAuth();
  }, [isConnected, address, user]); // Run when connection state changes

  // Auto-connect when autoConnect prop is true (e.g., from Shopify flow)
  useEffect(() => {
    if (autoConnect && !user && !isLoading && !isAuthenticating && connect) {
      mLog.info('ConnectWalletEmbedded', 'Auto-connect triggered');
      handleConnect();
    }
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally limited deps - we only want to trigger on mount when autoConnect is true

  // Don't show loading spinner during SSR - always render actual content for SEO/crawlers
  if (user) {
    return (
      <div className="p-4 text-center">
        <p className="text-green-600">✓ Wallet connected: {user.email || user.walletAddress}</p>
      </div>
    );
  }

  const handleConnect = async () => {
    mLog.info('ConnectWalletEmbedded', 'Get Started button clicked');

    try {
      setIsAuthenticating(true);

      // Check if this is an OAuth redirect - if so, skip the connect flow
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

      if (isOAuthRedirect) {
        mLog.info('ConnectWalletEmbedded', 'OAuth redirect detected, checking for auto-connection');

        // Check if we're already connected (Dynamic auto-connects after OAuth)
        if (isConnected && address) {
          mLog.info('ConnectWalletEmbedded', 'Already connected after OAuth, proceeding to backend auth');

          // Directly authenticate with backend
          const authSuccess = await authenticateBackend({
            success: true,
            address: address,
            capabilities: {
              canSign: true,
              canTransact: true,
              canSwitchWallets: true,
              isAuthOnly: false
            }
          });

          if (authSuccess) {
            mLog.info('ConnectWalletEmbedded', 'OAuth backend authentication successful');
            onSuccess?.();

            // Clean up OAuth parameters from URL
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              mLog.info('ConnectWalletEmbedded', 'OAuth parameters cleaned from URL');
            }
          } else {
            mLog.error('ConnectWalletEmbedded', 'OAuth backend authentication failed');
          }

          return;
        } else {
          mLog.warn('ConnectWalletEmbedded', 'OAuth redirect detected but not connected yet');
        }
      }

      // Normal connection flow
      mLog.debug('ConnectWalletEmbedded', 'Connect function availability', { hasConnect: !!connect });

      if (connect) {
        try {
          mLog.info('ConnectWalletEmbedded', 'Calling connect function...');
          await mLog.forceFlush(); // Flush before calling connect (in case it hangs)

          const connectionResult = await connect();

          if (connectionResult.success) {
            mLog.info('ConnectWalletEmbedded', 'Connection successful, authenticating with backend...');

            const authSuccess = await authenticateBackend(connectionResult);

            if (authSuccess) {
              mLog.info('ConnectWalletEmbedded', 'Backend authentication successful');
              onSuccess?.();
            } else {
              mLog.error('ConnectWalletEmbedded', 'Backend authentication failed');
            }
          } else {
            mLog.error('ConnectWalletEmbedded', 'Wallet connection failed', { error: connectionResult.error });
          }

          await mLog.forceFlush(); // Flush after completion
        } catch (error) {
          mLog.error('ConnectWalletEmbedded', 'Connect wallet error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          await mLog.forceFlush(); // Flush on error
        }
      } else {
        mLog.error('ConnectWalletEmbedded', 'No connect function available');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const containerClass = compact
    ? `${className} text-center`
    : `p-4 text-center ${className}`;

  // Don't include isLoading in isBusy for SSR/SEO - only show busy state after user interaction
  const isBusy = isAuthenticating;

  return (
    <div className={containerClass}>
      <Button
        onClick={handleConnect}
        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg"
        disabled={isBusy || !connect}
      >
        {isBusy ? 'Connecting...' : buttonText}
      </Button>
      {!compact && (
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          Sign up with email or use your existing wallet
        </p>
      )}
    </div>
  );
}