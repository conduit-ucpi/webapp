import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/components/auth';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { SkeletonCard } from '@/components/ui/Skeleton';
import LiquidityExplorer from '@/components/marketplace/LiquidityExplorer';
import MyOffersList from '@/components/marketplace/MyOffersList';

type Tab = 'explore' | 'positions';

/**
 * The liquidity provider's side of the marketplace (MARKETPLACE_OPENSPEC §15.6d, §15.6f).
 *
 * Two views, and the second is not optional furniture: an LP's offers become withdrawable through
 * conditions nothing on-chain announces — expiry emits no event at all, and someone else's
 * acceptance emits an event about a different vault. Without a place to see their own offers, an
 * LP with recoverable capital has no way to learn it.
 */
export default function LiquidityPage() {
  const { isLoading, isConnected } = useAuth();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  const [tab, setTab] = useState<Tab>('explore');

  if (isLoading || isWalletAddressLoading) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-[80vh] flex items-center">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 w-full text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
            Liquidity
          </p>
          <h1 className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4">
            Connect your wallet to buy payments early.
          </h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">
            You bid on payments that are locked until a known date, and collect in full when they
            mature.
          </p>
          <ConnectWalletEmbedded useSmartRouting={true} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Liquidity — buy payments early</title>
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-screen">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-1">Liquidity</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8">
            Buy a locked payment at a discount and collect it in full at maturity.
          </p>

          <div className="flex gap-6 border-b border-secondary-200 dark:border-secondary-700 mb-6">
            {([
              ['explore', 'Payments for sale'],
              ['positions', 'Your offers']
            ] as Array<[Tab, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`pb-2 text-sm transition-colors ${
                  tab === key
                    ? 'text-secondary-900 dark:text-white font-medium border-b-2 border-secondary-900 dark:border-white'
                    : 'text-secondary-500 dark:text-secondary-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'explore' ? (
            <LiquidityExplorer walletAddress={walletAddress || undefined} />
          ) : (
            <MyOffersList lpAddress={walletAddress || undefined} />
          )}
        </div>
      </div>
    </>
  );
}
