import React, { useEffect, useState, useRef } from 'react';
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
  preferredProvider?: 'dynamic' | 'walletconnect'; // Choose which provider to use
}

export default function ConnectWalletEmbedded({
  buttonText = "Get Started",
  useSmartRouting = true,
  showTwoOptionLayout = false,
  className = "",
  compact = false,
  onSuccess,
  autoConnect = false,
  preferredProvider
}: ConnectWalletEmbeddedProps) {
  const { user, isLoading, connect, isConnected, address } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Track if we've already handled OAuth redirect to prevent duplicate attempts
  const oauthHandledRef = useRef(false);
  const isHandlingOAuthRef = useRef(false);

  // Auto-authenticate on OAuth redirect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      // Use sessionStorage to prevent duplicate OAuth handling across ALL component instances
      const oauthHandlingKey = 'oauth_redirect_handling';
      const oauthHandledKey = 'oauth_redirect_handled';

      // Check if OAuth is already being handled or has been handled
      const isHandling = typeof window !== 'undefined' && sessionStorage.getItem(oauthHandlingKey);
      const wasHandled = typeof window !== 'undefined' && sessionStorage.getItem(oauthHandledKey);

      if (isHandling || wasHandled) {
        return; // Another component instance is handling or has handled this
      }

      // Early exit if already handled locally
      if (oauthHandledRef.current || isHandlingOAuthRef.current) {
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

      // Only log if OAuth redirect is detected AND we haven't logged yet this session
      // Use sessionStorage to persist across component remounts
      const hasLoggedKey = 'oauth_redirect_logged';
      const hasLoggedThisSession = typeof window !== 'undefined' && sessionStorage.getItem(hasLoggedKey);

      if (isOAuthRedirect && !hasLoggedThisSession) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(hasLoggedKey, 'true');
        }
        mLog.info('ConnectWalletEmbedded', 'OAuth redirect detected', {
          isConnected,
          address,
          hasUser: !!user,
          willTriggerAuth: isConnected && address && !user
        });
      }

      if (isOAuthRedirect && isConnected && address && !user) {
        // Mark as being handled globally AND locally
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(oauthHandlingKey, 'true');
        }
        isHandlingOAuthRef.current = true;

        mLog.info('ConnectWalletEmbedded', 'OAuth redirect detected - SIWE should have authenticated automatically', {
          isConnected,
          address,
          hasUser: !!user
        });

        // SIWE handles authentication automatically during connection
        // Just wait a moment for the auth state to propagate, then call onSuccess
        try {
          setIsAuthenticating(true);

          // Give a brief moment for SIWE session check to complete
          await new Promise(resolve => setTimeout(resolve, 500));

          mLog.info('ConnectWalletEmbedded', 'OAuth auto-authentication should be complete via SIWE');

          // Mark as successfully handled globally AND locally
          oauthHandledRef.current = true;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(oauthHandledKey, 'true');
            sessionStorage.removeItem(oauthHandlingKey); // Clear handling flag
          }

          onSuccess?.();

          // Clean up OAuth parameters from URL
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            mLog.info('ConnectWalletEmbedded', 'OAuth parameters auto-cleaned from URL');
          }
        } catch (error) {
          mLog.error('ConnectWalletEmbedded', 'OAuth handling error', {
            error: error instanceof Error ? error.message : String(error)
          });

          // Clear handling flag to allow retry
          isHandlingOAuthRef.current = false;
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(oauthHandlingKey);
          }
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    // Check immediately when conditions are met
    handleOAuthRedirect();

    // Only set up retry timeout if OAuth redirect is detected but conditions aren't met yet
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

    let retryTimeout: NodeJS.Timeout | null = null;

    if (isOAuthRedirect && (!isConnected || !address) && !oauthHandledRef.current) {
      // Wait for Dynamic to establish connection, but only retry once after 2 seconds
      retryTimeout = setTimeout(handleOAuthRedirect, 2000);
    }

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isConnected, address, user, onSuccess]);

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
          mLog.info('ConnectWalletEmbedded', 'Already connected after OAuth - SIWE should have authenticated automatically');

          // SIWE handles authentication automatically
          // Just wait a moment for auth state to propagate
          await new Promise(resolve => setTimeout(resolve, 500));

          mLog.info('ConnectWalletEmbedded', 'OAuth authentication should be complete via SIWE');
          onSuccess?.();

          // Clean up OAuth parameters from URL
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            mLog.info('ConnectWalletEmbedded', 'OAuth parameters cleaned from URL');
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
          // Always use WalletConnect (handles social, email, and all wallets)
          mLog.info('ConnectWalletEmbedded', 'Calling connect function with WalletConnect');
          mLog.info('ConnectWalletEmbedded', 'SIWE enabled - authentication will happen automatically during connection');
          await mLog.forceFlush(); // Flush before calling (in case it hangs)

          const connectionResult = await connect('walletconnect');

          if (connectionResult.success) {
            mLog.info('ConnectWalletEmbedded', '✅ Wallet connected, waiting for backend authentication...');

            // SIWE handles authentication automatically during connection via verifyMessage callback
            // Poll for backend SIWX session to verify authentication completed
            const maxRetries = 10;
            const retryDelay = 500; // ms
            let authenticationSucceeded = false;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                // Check backend SIWX session directly
                const sessionResponse = await fetch('/api/auth/siwe/session');

                if (sessionResponse.ok) {
                  const sessionData = await sessionResponse.json();

                  if (sessionData.address) {
                    mLog.info('ConnectWalletEmbedded', `✅ Backend authentication succeeded on attempt ${attempt}`, {
                      address: sessionData.address
                    });
                    authenticationSucceeded = true;
                    break;
                  }
                }
              } catch (error) {
                mLog.debug('ConnectWalletEmbedded', 'Session check error', {
                  error: error instanceof Error ? error.message : String(error)
                });
              }

              // If not authenticated yet and not last attempt, wait before retry
              if (!authenticationSucceeded && attempt < maxRetries) {
                mLog.debug('ConnectWalletEmbedded', `Backend authentication not complete yet, retrying (${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }

            if (authenticationSucceeded) {
              mLog.info('ConnectWalletEmbedded', '✅ Connection + authentication successful (SIWE one-click)');
              onSuccess?.();
            } else {
              mLog.error('ConnectWalletEmbedded', '❌ Wallet connected but backend authentication failed after all retries', {
                address: connectionResult.address,
                retriesAttempted: maxRetries
              });
              // Do NOT call onSuccess() - authentication failed
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