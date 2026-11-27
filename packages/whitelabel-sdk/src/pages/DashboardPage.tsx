import { ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import DashboardTour from '@/components/onboarding/DashboardTour';
import { btnPrimary } from '@/utils/landingStyles';
import { useT } from '../i18n';

interface DashboardPageProps {
  /**
   * Rendered above the contract list. A slot rather than a fixed component, so a host can put
   * its own surfaces here without the SDK depending on them.
   */
  beforeContracts?: ReactNode;
}

export default function Dashboard2({ beforeContracts }: DashboardPageProps = {}) {
  const t = useT();
  const { user, isLoading, isConnected } = useAuth();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';

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
            <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">{t('dashboardPage.dashboard')}</p>
            <h1
              className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4"
              style={{ fontFamily: 'var(--wl-font-accent)' }}
            >{t('dashboardPage.connectYourWalletTo')}</h1>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">{t('dashboardPage.youNeedToConnect')}</p>
            {/* Same wallet gate as /create and /contract-pay - signing in is the
                same decision wherever you hit it, so it looks the same too. */}
            <WalletChoiceCards autoConnect={autoConnect} className="mx-auto w-full max-w-md text-left" />
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
          --d-divider: rgb(var(--wl-secondary-100));
          --d-btn-bg: var(--wl-button-bg);
          --d-btn-bg-hover: var(--wl-button-hover-bg);
          --d-btn-fg: var(--wl-button-fg);
          --d-outline-border: rgb(var(--wl-secondary-300));
          --d-outline-fg: rgb(var(--wl-secondary-700));
          --d-outline-hover: rgb(var(--wl-secondary-50));
          --d-tab-active: rgb(var(--wl-secondary-900));
          --d-tab-text: rgb(var(--wl-secondary-900));
          --d-badge-bg: rgb(var(--wl-secondary-100));
          --d-badge-fg: rgb(var(--wl-secondary-900));
          --d-icon-bg: rgb(var(--wl-secondary-100));
          --d-icon-fg: rgb(var(--wl-secondary-700));
          --d-input-bg: rgb(var(--wl-white));
          --d-input-border: rgb(var(--wl-secondary-300));
          --d-input-fg: rgb(var(--wl-secondary-900));
          --d-input-placeholder: rgb(var(--wl-secondary-400));
          --d-text-primary: rgb(var(--wl-secondary-900));
          --d-text-secondary: rgb(var(--wl-secondary-500));
          --d-card-bg: transparent;
        }
        .dark .dashboard2-flat {
          --d-surface: transparent;
          --d-divider: rgb(var(--wl-secondary-800));
          --d-btn-bg: var(--wl-button-dark-bg);
          --d-btn-bg-hover: var(--wl-button-dark-hover-bg);
          --d-btn-fg: var(--wl-button-dark-fg);
          --d-outline-border: rgb(var(--wl-secondary-600));
          --d-outline-fg: rgb(var(--wl-secondary-300));
          --d-outline-hover: rgb(var(--wl-secondary-800));
          --d-tab-active: rgb(var(--wl-white));
          --d-tab-text: rgb(var(--wl-white));
          --d-badge-bg: rgb(var(--wl-secondary-800));
          --d-badge-fg: rgb(var(--wl-secondary-200));
          --d-icon-bg: rgb(var(--wl-secondary-800));
          --d-icon-fg: rgb(var(--wl-secondary-400));
          --d-input-bg: rgb(var(--wl-secondary-900));
          --d-input-border: rgb(var(--wl-secondary-700));
          --d-input-fg: rgb(var(--wl-secondary-100));
          --d-input-placeholder: rgb(var(--wl-secondary-500));
          --d-text-primary: rgb(var(--wl-secondary-50));
          --d-text-secondary: rgb(var(--wl-secondary-400));
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

        /* ── Icon circles (StatsCard bg-primary-50) ── */
        .dashboard2-flat .bg-primary-50 {
          background-color: var(--d-icon-bg) !important;
        }
        .dashboard2-flat .bg-primary-50 .text-primary-600 {
          color: var(--d-icon-fg) !important;
        }

        /* ── Search input ── */
        .dashboard2-flat input[type="text"] {
          background-color: var(--d-input-bg) !important;
          border-color: var(--d-input-border) !important;
          color: var(--d-input-fg) !important;
          /* Square in the default look; follows the theme's button corners otherwise. */
          border-radius: var(--wl-button-radius) !important;
        }
        .dashboard2-flat input[type="text"]::placeholder {
          color: var(--d-input-placeholder) !important;
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
        <section className="flex items-center" aria-label={t('dashboardPage.dashboardHeader')}>
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-10 lg:pb-12 w-full">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6" data-tour="dashboard-header">
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-3">{t('dashboardPage.dashboard')}</p>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight"
                >{t('dashboardPage.yourContracts')}</h1>
                <p
                  className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 max-w-md leading-relaxed"
                  style={{ fontFamily: 'var(--wl-font-accent)' }}
                >{t('dashboardPage.manageEscrowContractsAnd')}</p>
              </div>

              <Link href="/create" data-tour="create-button">
                <button className={btnPrimary}>{t('dashboardPage.requestPayment')}</button>
              </Link>
            </div>
          </div>
        </section>

        {/* Wallet bar */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('dashboardPage.wallet')}
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
                >{t('dashboardPage.manageWallet')}</Link>
                <Link
                  href="/wallet"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >{t('dashboardPage.buyUsdc')}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Main content */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('dashboardPage.contracts')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-6 lg:py-8">
            {/*
              A slot above the contracts, for anything the host wants to put in front of them.
              Our site fills it with the reserves a supplier is owed on payments they already
              sold — money that belongs on this page and nowhere else, because the sale drops
              that contract out of the list below.

              A slot rather than the component itself: the marketplace lives host-side, and an
              SDK page reaching into components/marketplace would hand every tenant a dependency
              on code they do not have.
            */}
            {beforeContracts && <div className="mb-10 empty:mb-0">{beforeContracts}</div>}

            <EnhancedDashboard />
          </div>
        </section>

        <DashboardTour />
      </div>
    </>
  );
}
