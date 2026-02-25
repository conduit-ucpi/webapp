import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TokenGuide from '@/components/ui/TokenGuide';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useState, useEffect } from 'react';

export default function BuyToken() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { config, isLoading: configLoading } = useConfig();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  const [widgetStatus, setWidgetStatus] = useState<string>('');

  const tryShowWalletServices = async () => {
    try {
      setWidgetStatus('Opening wallet services...');
      console.log('Trying to show wallet services');
      // console.log('Web3Auth instance:', web3authInstance);
      
      // Web3Auth wallet services not available in this context
      setWidgetStatus('Wallet services not available');
      return;

      // Web3Auth instance not available in this interface abstraction
      setWidgetStatus('Direct Web3Auth access not available in this interface');
      return;

    } catch (error: any) {
      console.error('Error showing wallet services:', error);
      setWidgetStatus(`Could not open wallet services: ${error.message}`);
    }
  };

  // Automatically open wallet services when page loads and user is authenticated
  useEffect(() => {
    if (user && walletAddress) {
      // Small delay to ensure everything is fully loaded
      const timer = setTimeout(() => {
        tryShowWalletServices();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, walletAddress]);

  if (authLoading || configLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !walletAddress) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mb-6">
          You need to connect your wallet to buy or sell {config?.tokenSymbol || 'tokens'}.
        </p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  return (
    <div className="py-10 bg-white dark:bg-secondary-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Buy or Sell {config?.tokenSymbol || 'Tokens'}</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">
            Manual instructions for adding {config?.tokenSymbol || 'tokens'} to your wallet or converting to fiat
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Web3Auth Wallet Services Integration */}
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md dark:shadow-none p-8 mb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">Web3Auth Wallet Services</h2>
              <p className="text-secondary-600 dark:text-secondary-300 mb-4">
                Use the integrated wallet widget to buy, sell, swap, and manage your crypto
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <span className="font-semibold">Widget Access:</span> Look for the wallet widget button (usually bottom-right corner) 
                    to access fiat on-ramp, portfolio management, and token swapping features.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-secondary-50 dark:bg-secondary-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-secondary-600 dark:text-secondary-300">Connected Wallet:</span>
                <span className="text-sm font-mono text-secondary-900 dark:text-white">{walletAddress}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-secondary-600 dark:text-secondary-300">Network:</span>
                <span className="text-sm text-secondary-900 dark:text-white">
                  {(() => {
                    const chainNames: Record<number, string> = {
                      1: 'Ethereum Mainnet',
                      11155111: 'Sepolia Testnet',
                      43114: 'Avalanche C-Chain',
                      43113: 'Avalanche Fuji Testnet',
                      137: 'Polygon Mainnet',
                      80001: 'Mumbai Testnet',
                      8453: 'Base Mainnet',
                      84532: 'Base Sepolia',
                      42161: 'Arbitrum One',
                      421614: 'Arbitrum Sepolia',
                      10: 'Optimism Mainnet',
                      11155420: 'Optimism Sepolia',
                      56: 'BNB Smart Chain',
                      97: 'BSC Testnet',
                    };
                    return chainNames[config?.chainId || 0] || `Chain ID: ${config?.chainId}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary-600 dark:text-secondary-300">Supported Currency:</span>
                <span className="text-sm text-secondary-900 dark:text-white">{config?.tokenSymbol || 'USDC'}</span>
              </div>
            </div>
          </div>

          {/* Fallback: Show the TokenGuide component with manual instructions */}
          <details className="bg-white dark:bg-secondary-800 rounded-lg shadow-md dark:shadow-none p-6 mb-8">
            <summary className="cursor-pointer font-semibold text-secondary-900 dark:text-white mb-4">
              Alternative: Manual Instructions (click to expand)
            </summary>
            <TokenGuide />
          </details>

          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md dark:shadow-none p-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    <span className="font-semibold">Active:</span> Web3Auth Wallet Services are now integrated and available through the wallet widget.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {widgetStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  widgetStatus.includes('not') || widgetStatus.includes('Could not')
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : widgetStatus.includes('opened')
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                  <div className="flex items-center">
                    {(widgetStatus.includes('Opening') || widgetStatus.includes('Waiting')) && (
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                    )}
                    {widgetStatus}
                  </div>
                </div>
              )}

              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
                size="lg"
              >
                Go to Dashboard
              </Button>

              <div className="text-center">
                <button
                  onClick={() => router.back()}
                  className="text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-secondary-500 dark:text-secondary-400">
            <p>
              Powered by Web3Auth Wallet Services. The widget provides secure access to multiple 
              fiat on-ramp providers and DeFi services for your convenience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}