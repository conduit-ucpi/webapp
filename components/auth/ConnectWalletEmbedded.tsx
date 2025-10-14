import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';
import { mLog } from '@/utils/mobileLogger';

// Shared state to prevent duplicate OAuth processing across multiple instances
let globalOAuthProcessing = false;
let globalOAuthProcessed = false;
const globalInstanceId = Math.random().toString(36).substr(2, 9);

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
  const [isConnecting, setIsConnecting] = useState(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));

  // Memoized OAuth handler to prevent recreating on every render and prevent duplicate processing across instances
  const handleOAuthRedirect = useCallback(async () => {
    // Skip if globally processed or processing, or if this instance is connecting
    if (globalOAuthProcessed || globalOAuthProcessing || isConnecting) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthRedirect = urlParams.has('dynamicOauthCode') || urlParams.has('dynamicOauthState');

    // Only log from the first instance to avoid spam
    if (instanceId.current === globalInstanceId) {
      mLog.info('ConnectWalletEmbedded', 'OAuth redirect check in useEffect', {
        isOAuthRedirect,
        isConnected,
        address,
        hasUser: !!user,
        globalOAuthProcessed,
        instanceId: instanceId.current,
        willTriggerAuth: isOAuthRedirect && isConnected && address && !user && !globalOAuthProcessed
      });
    }

    if (isOAuthRedirect && isConnected && address && !user && !globalOAuthProcessed) {
      globalOAuthProcessing = true; // Mark as processing globally

      mLog.info('ConnectWalletEmbedded', 'Auto-authenticating OAuth redirect', {
        isConnected,
        address,
        hasUser: !!user
      });

      try {
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
          globalOAuthProcessed = true; // Mark as successfully processed globally
          onSuccess?.();

          // Clean up OAuth parameters from URL
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            mLog.info('ConnectWalletEmbedded', 'OAuth parameters auto-cleaned from URL');
          }
        } else {
          mLog.error('ConnectWalletEmbedded', 'OAuth auto-authentication failed');
          globalOAuthProcessing = false; // Reset on failure to allow retry
        }
      } catch (error) {
        mLog.error('ConnectWalletEmbedded', 'OAuth auto-authentication error', {
          error: error instanceof Error ? error.message : String(error)
        });
        globalOAuthProcessing = false; // Reset on error to allow retry
      } finally {
        globalOAuthProcessing = false; // Always reset processing flag
      }
    }
  }, [isConnected, address, user, authenticateBackend, onSuccess, isConnecting]);

  // Memoized connect handler to prevent recreating on every render
  const handleConnect = useCallback(async () => {
    // Prevent duplicate clicks
    if (isConnecting) {
      mLog.warn('ConnectWalletEmbedded', 'Connection already in progress, blocking duplicate attempt');
      return;
    }

    setIsConnecting(true);
    mLog.info('ConnectWalletEmbedded', 'Get Started button clicked');

    // Check for Dynamic wallet connection state
    const dynamicWalletState = typeof window !== 'undefined' ? (window as any).dynamicWalletConnected : null;

    // Debug auth state
    mLog.info('ConnectWalletEmbedded', 'Current auth state before connection attempt', {
      isConnected,
      address,
      hasUser: !!user,
      isLoading,
      addressType: typeof address,
      isConnectedType: typeof isConnected,
      dynamicWalletConnected: !!dynamicWalletState,
      dynamicAddress: dynamicWalletState?.address
    });

    try {
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

      // Check if already connected - but ONLY trust the React auth state, not Dynamic state
      // Dynamic state can be misleading on mobile (shows connected but provider not ready)
      if (isConnected && address) {
        mLog.info('ConnectWalletEmbedded', 'React auth state shows connected, using unified auth flow', {
          isConnected,
          address,
          hasAuthenticateBackend: !!authenticateBackend
        });

        try {
          // Use the unified provider system - this should work since React state is connected
          const authSuccess = await authenticateBackend();

          if (authSuccess) {
            mLog.info('ConnectWalletEmbedded', 'Unified auth flow successful');
            onSuccess?.();
            return;
          } else {
            mLog.error('ConnectWalletEmbedded', 'Unified auth flow failed despite connected state');
          }
        } catch (error) {
          mLog.error('ConnectWalletEmbedded', 'Unified auth flow error despite connected state', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Check for Dynamic-only connection (React not synced yet)
      const dynamicOnlyConnected = !isConnected && dynamicWalletState?.isConnected && dynamicWalletState?.address;

      if (dynamicOnlyConnected) {
        mLog.info('ConnectWalletEmbedded', 'Dynamic shows connected but React auth state not synced - creating connection result from Dynamic state', {
          isConnected,
          address,
          dynamicConnected: dynamicWalletState?.isConnected,
          dynamicAddress: dynamicWalletState?.address
        });

        // Create a connection result from the Dynamic state to sync React auth state
        const connectionResult = {
          success: true,
          address: dynamicWalletState.address,
          provider: dynamicWalletState.provider,
          wallet: dynamicWalletState.wallet,
          capabilities: {
            canSign: true,
            canTransact: true,
            canSwitchWallets: true,
            isAuthOnly: false
          }
        };

        mLog.info('ConnectWalletEmbedded', 'Attempting to authenticate with Dynamic state...');
        const authSuccess = await authenticateBackend(connectionResult);

        if (authSuccess) {
          mLog.info('ConnectWalletEmbedded', 'Dynamic state authentication successful');
          onSuccess?.();
          return;
        } else {
          mLog.error('ConnectWalletEmbedded', 'Dynamic state authentication failed - falling back to normal connection');
        }
      }

      // Normal connection flow
      mLog.debug('ConnectWalletEmbedded', 'Connect function availability', { hasConnect: !!connect });

      if (connect) {
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
      } else {
        mLog.error('ConnectWalletEmbedded', 'No connect function available');
      }
    } catch (error) {
      mLog.error('ConnectWalletEmbedded', 'Wallet connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      await mLog.forceFlush(); // Flush on error
    } finally {
      setIsConnecting(false);
    }
  }, [connect, authenticateBackend, onSuccess, isConnected, address, isConnecting]);

  // Auto-authenticate on OAuth redirect with proper debouncing and global coordination
  useEffect(() => {
    // Clear any existing timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Run immediately
    handleOAuthRedirect();

    // Only set up retry timeouts if we haven't processed OAuth globally yet and conditions might change
    // Only the primary instance should set up retries to avoid duplicate timeouts
    if (!globalOAuthProcessed && !user && instanceId.current === globalInstanceId) {
      // Reduced retry attempts and shorter delays
      [500, 1500].forEach(delay => {
        const timeoutId = setTimeout(handleOAuthRedirect, delay);
        timeoutsRef.current.push(timeoutId);
      });
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [handleOAuthRedirect, user]);

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

  const containerClass = compact
    ? `${className} text-center`
    : `p-4 text-center ${className}`;

  return (
    <div className={containerClass}>
      <Button
        onClick={handleConnect}
        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg"
        disabled={!connect || isConnecting}
      >
        {isConnecting ? 'Connecting...' : buttonText}
      </Button>
      {!compact && (
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          Connect your wallet to get started
        </p>
      )}
    </div>
  );
}