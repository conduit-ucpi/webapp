import Head from 'next/head';
import { useMemo } from 'react';
import { useAuth } from '@/components/auth';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useCombinedContracts, UnifiedContract } from '@/hooks/useCombinedContracts';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import StatsCard from '@/components/ui/StatsCard';
import SellerOfferBook from '@/components/marketplace/SellerOfferBook';
import { displayCurrency } from '@/utils/currency';
import { formatTimestamp } from '@/utils/datetime';
import { daysUntil } from '@/utils/marketplace';
import type { Contract } from '@/types';

/**
 * "Your payments" — the seller's side (MARKETPLACE_OPENSPEC §15.6d).
 *
 * Every payment the user is owed that is still locked, each with the offers standing on it. The
 * seller's decision is a comparison — wait for the full amount at maturity, or take a smaller
 * amount now — so both numbers belong on screen together, and the "now" figure must be their NET
 * after the platform fee and any reserve (§8.5a).
 */
export default function OffersPage() {
  const { user, isLoading, isConnected } = useAuth();
  const { walletAddress } = useWalletAddress();
  const { contracts, isLoading: contractsLoading, refetch } = useCombinedContracts({ enabled: isConnected });

  /**
   * The payments this user is owed and could sell: deployed, funded, still short of maturity.
   * A payment past maturity is simply claimable — there is nothing left to discount.
   */
  const sellable = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const me = walletAddress?.toLowerCase();
    return contracts.filter((contract): contract is Contract => {
      const deployed = contract as Contract;
      if (!deployed.contractAddress) return false;
      if (!deployed.funded) return false;
      if (deployed.expiryTimestamp <= now) return false;
      // Only the current recipient can sell, and after an earlier sale that is no longer the
      // original seller — the escrow's own `recipient()` is what the contract checks.
      const isRecipient = !!me && deployed.sellerAddress?.toLowerCase() === me;
      const isSellerByEmail = !!user?.email && deployed.sellerEmail === user.email;
      return isRecipient || isSellerByEmail;
    });
  }, [contracts, walletAddress, user?.email]);

  const totalLocked = useMemo(
    () => sellable.reduce((sum, contract) => sum + (contract.amount || 0), 0),
    [sellable]
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-[80vh] flex items-center">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 w-full text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
            Your payments
          </p>
          <h1 className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4">
            Connect your wallet to see your payments.
          </h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">
            If anyone has offered to pay you early, the offer will be here.
          </p>
          <ConnectWalletEmbedded useSmartRouting={true} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Your payments — get paid early</title>
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-screen">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-1">Your payments</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8">
            Payments owed to you that are still locked — and any offers to pay you early.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <StatsCard
              title="Total locked"
              value={displayCurrency(totalLocked, 'microUSDC')}
              sub={`Across ${sellable.length} payment${sellable.length === 1 ? '' : 's'}`}
            />
            <StatsCard
              title="Payments open to offers"
              value={sellable.length}
              sub="Funded and not yet matured"
            />
          </div>

          {contractsLoading && sellable.length === 0 ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : sellable.length === 0 ? (
            <EmptyState
              title="Nothing locked at the moment"
              description="Once a payment is funded and waiting on a release date, it shows up here and liquidity providers can offer to pay you early."
            />
          ) : (
            <div className="space-y-4">
              {sellable.map((contract) => (
                <div
                  key={contract.contractAddress}
                  className="rounded-lg border border-gray-200 dark:border-secondary-700 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-secondary-900/60 border-b border-gray-200 dark:border-secondary-700">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {contract.productName || contract.description || 'Escrow payment'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-secondary-400 mt-0.5">
                        Matures {formatTimestamp(contract.expiryTimestamp).date} ·{' '}
                        {daysUntil(contract.expiryTimestamp)} days away
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-medium text-gray-900 dark:text-white">
                        {displayCurrency(contract.amount, 'microUSDC')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-secondary-400">locked in escrow</div>
                    </div>
                  </div>

                  <div className="p-4">
                    <SellerOfferBook
                      escrowContract={contract.contractAddress}
                      maturityAmount={contract.amount}
                      maturity={contract.expiryTimestamp}
                      onAccepted={async () => {
                        await refetch();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
