import React from 'react';

// Simplified ConnectWalletEmbedded component - just displays a message
// The actual wallet connection is now handled by the main auth flow
export default function ConnectWalletEmbedded() {
  return (
    <div className="p-4 text-center">
      <p className="text-gray-600">
        Please connect your wallet using the Connect Wallet button in the header.
      </p>
    </div>
  );
}