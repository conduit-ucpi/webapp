import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthInstanceProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';

export default function BuyUSDC() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  if (isLoading || isWeb3AuthInstanceLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !web3authProvider || !walletAddress) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to buy or sell USDC.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Buy or Sell USDC</h1>
          <p className="mt-2 text-gray-600">
            Use the Web3Auth wallet widget to buy, sell, swap, or manage your crypto
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Access Wallet Services
              </h2>
              <p className="text-gray-600 mb-4">
                Web3Auth Wallet Services provides integrated fiat on-ramp functionality. 
                To enable these features:
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Requirements for Web3Auth Wallet Services:</h3>
              <ul className="space-y-2 text-left text-sm">
                <li className="flex items-start">
                  <span className="text-gray-600">1. Upgrade to Web3Auth SDK v9 or higher</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-600">2. Subscribe to Web3Auth Scale Plan (minimum for production)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-600">3. Configure wallet services in Web3Auth dashboard</span>
                </li>
              </ul>
              
              <h3 className="font-semibold text-gray-900 mt-4 mb-3">Once enabled, you'll have access to:</h3>
              <ul className="space-y-2 text-left text-sm">
                <li className="flex items-start">
                  <span className="text-gray-600">• Fiat on-ramp aggregator (MoonPay, Ramp, and more)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-600">• Token swaps and exchanges</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-600">• Portfolio management</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-600">• WalletConnect integration</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Note:</span> Full wallet services with integrated widget require Web3Auth v9+ and a Scale Plan. 
                    Please upgrade your Web3Auth package and plan to enable the wallet widget with fiat on-ramp functionality.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Connected Wallet:</span>
                <span className="text-sm font-mono text-gray-900">{walletAddress}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Network:</span>
                <span className="text-sm text-gray-900">Avalanche C-Chain</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Supported Currency:</span>
                <span className="text-sm text-gray-900">USDC</span>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-primary-500 hover:bg-primary-600"
                size="lg"
              >
                Go to Dashboard
              </Button>

              <div className="text-center">
                <button
                  onClick={() => router.back()}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Powered by Web3Auth Wallet Services. The widget provides access to multiple 
              fiat on-ramp providers for your convenience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}