import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AdminDatabaseList from '@/components/admin/AdminDatabaseList';

/**
 * Read-only reporting: the admin page's Local Database contract list, emails redacted, and
 * nothing else, for users of type "sd-reporting" and admins.
 *
 * This check only decides what is drawn. The data is guarded server-side, as /admin's is: by
 * /api/sd-reporting/contracts, then contractservice (which redacts it) and chainservice.
 */
export default function SdReportingPage() {
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
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-4">Authentication Required</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mb-6">
          You need to connect your wallet to access this page.
        </p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  if (user.userType !== 'sd-reporting' && user.userType !== 'admin') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mb-6">
          You are not authorized to access this page.
        </p>
        <p className="text-sm text-secondary-500 dark:text-secondary-400">
          Current user: {user.email}
        </p>
      </div>
    );
  }

  return (
    <div className="py-10 bg-white dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Reporting</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">Contracts in the database</p>
        </div>

        <AdminDatabaseList endpoint="/api/sd-reporting/contracts" />
      </div>
    </div>
  );
}
