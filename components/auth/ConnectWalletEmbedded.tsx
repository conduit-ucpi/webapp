import React, { useEffect, useState } from 'react';
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
}

export default function ConnectWalletEmbedded({
  buttonText = "Get Started",
  useSmartRouting = true,
  showTwoOptionLayout = false,
  className = "",
  compact = false,
  onSuccess
}: ConnectWalletEmbeddedProps) {
  const { user, isLoading, connect, authenticateBackend, isConnected, address } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Auto-authenticate on OAuth redirect
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

      mLog.info('ConnectWalletEmbedded', 'OAuth redirect check in useEffect', {
        isOAuthRedirect,
        isConnected,
        address,
        hasUser: !!user,
        willTriggerAuth: isOAuthRedirect && isConnected && address && !user
      });

      if (isOAuthRedirect && isConnected && address && !user) {
        mLog.info('ConnectWalletEmbedded', 'Auto-authenticating OAuth redirect', {
          isConnected,
          address,
          hasUser: !!user
        });

        try {
          setIsAuthenticating(true);
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
            mLog.info('ConnectWalletEmbedded', 'OAuth auto-authentication successful');
            onSuccess?.();

            // Clean up OAuth parameters from URL
            if (window.history && window.history.replaceState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              mLog.info('ConnectWalletEmbedded', 'OAuth parameters auto-cleaned from URL');
            }
          } else {
            mLog.error('ConnectWalletEmbedded', 'OAuth auto-authentication failed');
          }
        } catch (error) {
          mLog.error('ConnectWalletEmbedded', 'OAuth auto-authentication error', {
            error: error instanceof Error ? error.message : String(error)
          });
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    // Run immediately and then with increasing delays to catch Dynamic's async connection
    handleOAuthRedirect();

    const timeouts: NodeJS.Timeout[] = [];

    // Try multiple times with increasing delays
    [100, 300, 500, 1000, 2000].forEach(delay => {
      const timeoutId = setTimeout(handleOAuthRedirect, delay);
      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isConnected, address, user, authenticateBackend, onSuccess]);

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

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

  const isBusy = isLoading || isAuthenticating;

  return (
    <div className={containerClass}>
      <Button
        onClick={handleConnect}
        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg"
        disabled={!connect || isBusy}
      >
        {isBusy ? 'Connecting...' : buttonText}
      </Button>
      {!compact && (
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          Connect your wallet to get started
        </p>
      )}
    </div>
  );
}