import { useAuth } from '@/components/auth';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Skeleton from '@/components/ui/Skeleton';
import { useState } from 'react';

export default function CreatePage() {
  const { user, isLoading, signMessage } = useAuth();
  const [testResult, setTestResult] = useState<string>('');

  const handleAuthSign = async () => {
    try {
      setTestResult('🔄 Testing auth signing...');
      if (!user?.walletAddress || !signMessage) {
        setTestResult('❌ Auth not available');
        return;
      }
      
      const signature = await signMessage('Test message from Create page');
      setTestResult(`✅ Signed successfully by ${user.walletAddress}`);
      console.log('Create page test signature:', signature);
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Create page test error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <Skeleton className="h-8 w-80 mx-auto mb-2" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <div className="flex justify-center">
            <div className="bg-white rounded-lg border border-secondary-200 p-8 w-full max-w-2xl">
              <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">
          You need to connect your wallet to create time-locked payments.
        </p>
        <ConnectWalletEmbedded />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-secondary-900">Time-locked payment request</h1>
          <p className="mt-2 text-secondary-600">
            Set up a secure time-delayed escrow with automatic dispute resolution
          </p>
          
          {/* Test section */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Debug Test:</strong> Current user: {user?.walletAddress}
            </p>
            <button 
              onClick={handleAuthSign}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm mr-3"
            >
              Test Auth Signing
            </button>
            {testResult && (
              <span className="text-sm">{testResult}</span>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <CreateContractWizard />
        </div>
      </div>
    </div>
  );
}