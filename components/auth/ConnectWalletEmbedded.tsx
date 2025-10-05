import React from 'react';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';

interface ConnectWalletEmbeddedProps {
  buttonText?: string;
  useSmartRouting?: boolean;
  showTwoOptionLayout?: boolean;
  className?: string;
  compact?: boolean;
  onSuccess?: () => void;
}

export default function ConnectWalletEmbedded({
  buttonText = "Connect Wallet",
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
    if (connect) {
      try {
        await connect();
        onSuccess?.();
      } catch (error) {
        console.error('Connect wallet error:', error);
      }
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