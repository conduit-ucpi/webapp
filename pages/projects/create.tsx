import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import CreateProjectWizard from '@/components/projects/CreateProjectWizard';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Skeleton from '@/components/ui/Skeleton';

export default function CreateProjectPage() {
  const { isLoading, isConnected, address } = useAuth();
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';

  if (isLoading) {
    return (
      <div className="py-10 max-w-3xl mx-auto px-4">
        <Skeleton className="h-8 w-80 mx-auto mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">Connect your wallet to create a project.</p>
        <ConnectWalletEmbedded useSmartRouting={true} autoConnect={autoConnect} />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">New project</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-400">
            Fund a pot that pays your team on verified completion
          </p>
        </div>
        <CreateProjectWizard />
      </div>
    </div>
  );
}
