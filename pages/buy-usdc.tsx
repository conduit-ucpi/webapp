import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import USDCGuide from '@/components/ui/USDCGuide';
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
            Manual instructions for adding USDC to your wallet or converting to fiat
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Show the USDCGuide component with manual instructions */}
          <USDCGuide />

          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Coming Soon:</span> Web3Auth Wallet Services widget for integrated buying/selling.
                    Currently requires Web3Auth v9+ and a Scale Plan subscription.
                  </p>
                </div>
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
              For now, please use the manual methods above to add USDC to your wallet or convert to fiat.
              The integrated Web3Auth widget will be available soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}