import React from 'react';
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
  const { user, isLoading, connect } = useAuth();


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
    mLog.debug('ConnectWalletEmbedded', 'Connect function availability', { hasConnect: !!connect });

    if (connect) {
      try {
        mLog.info('ConnectWalletEmbedded', 'Calling connect function...');
        await mLog.forceFlush(); // Flush before calling connect (in case it hangs)

        await connect();

        mLog.info('ConnectWalletEmbedded', 'Connect function completed successfully');
        onSuccess?.();
        await mLog.forceFlush(); // Flush after success
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
  };

  const containerClass = compact
    ? `${className} text-center`
    : `p-4 text-center ${className}`;

  return (
    <div className={containerClass}>
      <Button
        onClick={handleConnect}
        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg"
        disabled={!connect}
      >
        {buttonText}
      </Button>
      {!compact && (
        <p className="mt-2 text-sm text-secondary-600 dark:text-secondary-400">
          Connect your wallet to get started
        </p>
      )}
    </div>
  );
}