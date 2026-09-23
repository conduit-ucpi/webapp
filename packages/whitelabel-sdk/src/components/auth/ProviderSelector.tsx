import React from 'react';
import Button from '@/components/ui/Button';
import { useT } from '../../i18n';

interface ProviderSelectorProps {
  onSelectProvider: (provider: 'dynamic' | 'walletconnect') => void;
  className?: string;
}

export default function ProviderSelector({ onSelectProvider, className = '' }: ProviderSelectorProps) {
  const t = useT();
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold mb-2">{t('providerSelector.connectToGetStarted')}</h2>
        <p className="text-gray-600">{t('providerSelector.chooseHowYouD')}</p>
      </div>

      <Button
        onClick={() => onSelectProvider('dynamic')}
        className="w-full py-6 text-lg flex items-center justify-center gap-3"
      >
        <span className="text-2xl">📧</span>
        <div className="text-left">
          <div className="font-bold">{t('providerSelector.emailSocialLogin')}</div>
          <div className="text-sm opacity-75">{t('providerSelector.googleEmailOrMetamask')}</div>
        </div>
      </Button>

      <Button
        onClick={() => onSelectProvider('walletconnect')}
        variant="outline"
        className="w-full py-6 text-lg flex items-center justify-center gap-3"
      >
        <span className="text-2xl">🔗</span>
        <div className="text-left">
          <div className="font-bold">{t('providerSelector.connectWallet')}</div>
          <div className="text-sm opacity-75">{t('providerSelector.trustWalletCoinbaseAnd')}</div>
        </div>
      </Button>
    </div>
  );
}
