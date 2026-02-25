import Link from 'next/link';
import Head from 'next/head';
import { useAuth } from '@/components/auth';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import DashboardTour from '@/components/onboarding/DashboardTour';

// Page-local button styles matching landing4
const btn = 'inline-flex items-center justify-center font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2';
const btnPrimary = `${btn} text-[15px] bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 hover:bg-secondary-700 dark:hover:bg-secondary-100 px-8 py-3.5`;

export default function Dashboard2() {
  const { user, isLoading, isConnected } = useAuth();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();

  if (isLoading || isWalletAddressLoading) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 w-48 bg-secondary-100 dark:bg-secondary-800 animate-pulse rounded mb-2" />
              <div className="h-4 w-96 bg-secondary-100 dark:bg-secondary-800 animate-pulse rounded" />
            </div>
            <div className="h-10 w-32 bg-secondary-100 dark:bg-secondary-800 animate-pulse rounded" />
          </div>
          <SkeletonCard className="mb-6" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <>
        <Head>
          <link
            href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
            rel="stylesheet"
          />
        </Head>
        <div className="bg-white dark:bg-secondary-900 transition-colors min-h-[80vh] flex items-center">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 w-full text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
              Dashboard
            </p>
            <h1
              className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              Connect your wallet to continue.
            </h1>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">
              You need to connect your wallet to view your contracts.
            </p>
            <ConnectWalletEmbedded useSmartRouting={true} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Override child component styling to match landing4 flat aesthetic */}
      <style jsx global>{`
        /* ── Design tokens ── */
        .dashboard2-flat {
          --d-surface: transparent;
          --d-divider: #f1f5f9;
          --d-btn-bg: #0f172a;
          --d-btn-bg-hover: #334155;
          --d-btn-fg: #fff;
          --d-outline-border: #cbd5e1;
          --d-outline-fg: #334155;
          --d-outline-hover: #f8fafc;
          --d-tab-active: #0f172a;
          --d-tab-text: #0f172a;
          --d-badge-bg: #f1f5f9;
          --d-badge-fg: #0f172a;
          --d-icon-bg: #f1f5f9;
          --d-icon-fg: #334155;
          --d-input-bg: #fff;
          --d-input-border: #cbd5e1;
          --d-input-fg: #0f172a;
          --d-input-placeholder: #94a3b8;
          --d-text-primary: #0f172a;
          --d-text-secondary: #64748b;
          --d-card-bg: transparent;
        }
        .dark .dashboard2-flat {
          --d-surface: transparent;
          --d-divider: #1e293b;
          --d-btn-bg: #fff;
          --d-btn-bg-hover: #f1f5f9;
          --d-btn-fg: #0f172a;
          --d-outline-border: #475569;
          --d-outline-fg: #cbd5e1;
          --d-outline-hover: #1e293b;
          --d-tab-active: #fff;
          --d-tab-text: #fff;
          --d-badge-bg: #1e293b;
          --d-badge-fg: #e2e8f0;
          --d-icon-bg: #1e293b;
          --d-icon-fg: #94a3b8;
          --d-input-bg: #0f172a;
          --d-input-border: #334155;
          --d-input-fg: #f1f5f9;
          --d-input-placeholder: #64748b;
          --d-text-primary: #f8fafc;
          --d-text-secondary: #94a3b8;
          --d-card-bg: transparent;
        }

        /* ── Flatten card boxes ── */
        .dashboard2-flat .bg-white.rounded-lg,
        .dashboard2-flat .bg-white.rounded-xl {
          background: var(--d-card-bg) !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          border-bottom: 1px solid var(--d-divider) !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .dashboard2-flat .bg-white.rounded-lg:hover,
        .dashboard2-flat .bg-white.rounded-xl:hover {
          box-shadow: none !important;
        }

        /* ── Card text colours ── */
        .dashboard2-flat .text-secondary-900 {
          color: var(--d-text-primary) !important;
        }
        .dashboard2-flat .text-secondary-600,
        .dashboard2-flat .text-secondary-500,
        .dashboard2-flat .text-secondary-700 {
          color: var(--d-text-secondary) !important;
        }

        /* ── Tab badge pills ── */
        .dashboard2-flat .bg-primary-100 {
          background-color: var(--d-badge-bg) !important;
        }
        .dashboard2-flat .text-primary-700 {
          color: var(--d-badge-fg) !important;
        }

        /* ── Icon circles (StatsCard bg-primary-50, ProgressChecklist bg-primary-100) ── */
        .dashboard2-flat .bg-primary-50 {
          background-color: var(--d-icon-bg) !important;
        }
        .dashboard2-flat .bg-primary-50 .text-primary-600,
        .dashboard2-flat .bg-primary-100 .text-primary-600 {
          color: var(--d-icon-fg) !important;
        }

        /* ── Search input ── */
        .dashboard2-flat input[type="text"] {
          background-color: var(--d-input-bg) !important;
          border-color: var(--d-input-border) !important;
          color: var(--d-input-fg) !important;
          border-radius: 0 !important;
        }
        .dashboard2-flat input[type="text"]::placeholder {
          color: var(--d-input-placeholder) !important;
        }

        /* ── ProgressChecklist container ── */
        .dashboard2-flat .bg-white.border.border-primary-200 {
          background: var(--d-card-bg) !important;
          border-color: var(--d-divider) !important;
          border-radius: 0 !important;
        }

        /* ── Progress bar (non-button bg-primary-500) ── */
        .dashboard2-flat div.bg-primary-500 {
          background-color: var(--d-btn-bg) !important;
          border-radius: 2px !important;
        }

        /* ── Mobile tab dot indicator (non-button bg-primary-500) ── */
        .dashboard2-flat div.bg-primary-500.w-4 {
          background-color: var(--d-tab-active) !important;
        }
      `}</style>

      <div className="bg-white dark:bg-secondary-900 transition-colors dashboard2-flat">

        {/* Header */}
        <section className="flex items-center" aria-label="Dashboard header">
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-10 lg:pb-12 w-full">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6" data-tour="dashboard-header">
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">
                  Dashboard
                </p>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight"
                >
                  Your contracts.
                </h1>
                <p
                  className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 max-w-md leading-relaxed"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  Manage escrow contracts and track transaction history.
                </p>
              </div>

              <Link href="/create" data-tour="create-button">
                <button className={btnPrimary}>Request Payment</button>
              </Link>
            </div>
          </div>
        </section>

        {/* Wallet bar */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Wallet"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-4" data-tour="wallet-section">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ExpandableHash hash={walletAddress || ''} className="text-sm text-secondary-500 dark:text-secondary-400" />
                    {user && (
                      <>
                        <span className="text-xs text-secondary-300 dark:text-secondary-600">|</span>
                        <span className="text-xs text-secondary-500 dark:text-secondary-400">
                          {user.username ? `@${user.username}` : user.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  href="/wallet"
                  className="text-xs text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors"
                >
                  Manage wallet
                </Link>
                <Link
                  href="/buy-usdc"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  Buy USDC
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Main content */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label="Contracts"
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            <EnhancedDashboard />
          </div>
        </section>

        <DashboardTour />
      </div>
    </>
  );
}
