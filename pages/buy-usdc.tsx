import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import MoonPayWidget from '@/components/moonpay/MoonPayWidget';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function BuyUSDC() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [showWidget, setShowWidget] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to purchase USDC.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  const handleCloseMoonPay = () => {
    setShowWidget(false);
    router.push('/dashboard');
  };

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Buy USDC</h1>
          <p className="mt-2 text-gray-600">
            Purchase USDC directly to your wallet using MoonPay
          </p>
        </div>

        {!showWidget ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Purchase USDC</h2>
                <p className="text-gray-600">
                  Buy USDC with your credit card or bank account. 
                  Funds will be sent directly to your connected wallet.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Destination Wallet:</span>
                  <span className="text-sm font-mono text-gray-900">{user.walletAddress}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Network:</span>
                  <span className="text-sm text-gray-900">Avalanche C-Chain</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Currency:</span>
                  <span className="text-sm text-gray-900">USDC</span>
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => setShowWidget(true)}
                  className="w-full bg-primary-500 hover:bg-primary-600"
                  size="lg"
                >
                  Continue with MoonPay
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
                Powered by MoonPay. By continuing, you agree to MoonPay's 
                <a href="https://moonpay.com/terms_of_use" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 mx-1">
                  Terms of Use
                </a>
                and
                <a href="https://moonpay.com/privacy_policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 mx-1">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        ) : (
          <MoonPayWidget onClose={handleCloseMoonPay} />
        )}
      </div>
    </div>
  );
}