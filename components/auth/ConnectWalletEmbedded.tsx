import React from 'react';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';

export default function ConnectWalletEmbedded() {
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

  return (
    <div className="p-4 text-center">
      <Button
        onClick={() => connect?.()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
        disabled={!connect}
      >
        Connect Wallet
      </Button>
      <p className="mt-2 text-sm text-gray-600">
        Connect your wallet to get started
      </p>
    </div>
  );
}