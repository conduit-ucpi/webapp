import { useAuth } from '@/components/auth/AuthProvider';
import CreateContract from '@/components/contracts/CreateContract';
import ConnectWallet from '@/components/auth/ConnectWallet';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function CreatePage() {
  const { user, isLoading } = useAuth();

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
          You need to connect your wallet to create escrow contracts.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Create Escrow Contract</h1>
          <p className="mt-2 text-gray-600">
            Set up a secure time-delayed escrow with automatic dispute resolution
          </p>
        </div>
        
        <div className="flex justify-center">
          <CreateContract />
        </div>
      </div>
    </div>
  );
}