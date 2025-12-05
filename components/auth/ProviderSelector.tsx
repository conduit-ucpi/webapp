import React from 'react';
import Button from '@/components/ui/Button';

interface ProviderSelectorProps {
  onSelectProvider: (provider: 'dynamic' | 'walletconnect') => void;
  className?: string;
}

export default function ProviderSelector({ onSelectProvider, className = '' }: ProviderSelectorProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-2">Connect to Get Started</h2>
        <p className="text-gray-600">Choose how you'd like to connect</p>
      </div>

      <Button
        onClick={() => onSelectProvider('dynamic')}
        className="w-full py-6 text-lg flex items-center justify-center gap-3"
      >
        <span className="text-2xl">📧</span>
        <div className="text-left">
          <div className="font-bold">Email / Social Login</div>
          <div className="text-sm opacity-75">Google, email, or MetaMask</div>
        </div>
      </Button>

      <Button
        onClick={() => onSelectProvider('walletconnect')}
        variant="outline"
        className="w-full py-6 text-lg flex items-center justify-center gap-3"
      >
        <span className="text-2xl">🔗</span>
        <div className="text-left">
          <div className="font-bold">Connect Wallet</div>
          <div className="text-sm opacity-75">Trust Wallet, Coinbase, and more</div>
        </div>
      </Button>
    </div>
  );
}
