import { useAuth } from '@/components/auth';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Skeleton from '@/components/ui/Skeleton';

export default function CreatePage() {
  const { isLoading, isConnected, address } = useAuth();

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

  // Check for wallet connection instead of backend user
  // Backend auth (SIWE) is not required - lazy auth will trigger on first API call
  if (!isConnected || !address) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">
          You need to connect your wallet to create time-locked payments.
        </p>
        <ConnectWalletEmbedded useSmartRouting={true} />
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
        </div>

        <div className="flex justify-center">
          <CreateContractWizard />
        </div>
      </div>
    </div>
  );
}