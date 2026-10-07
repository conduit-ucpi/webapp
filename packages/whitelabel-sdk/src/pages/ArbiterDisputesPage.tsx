import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { Contract } from '@/types';
import { UnifiedContract, useCombinedContracts } from '@/hooks/useCombinedContracts';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';
import FarcasterNameDisplay from '@/components/ui/FarcasterNameDisplay';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { displayCurrency, formatTimestamp } from '@/utils/validation';
import { btnPrimary } from '@/utils/landingStyles';
import { useT } from '../i18n';

/**
 * The tiebreaker's own screen: every deployed escrow whose record names the connected wallet as
 * arbiter (MARKETPLACE_OPENSPEC §3.3; contractservice `?role=arbiter`).
 *
 * It is deliberately the SAME dispute screen the parties use. DisputeManagementModal already shows
 * both sides' filings and the standing figures, takes a figure with a reason (on-chain first, then
 * recorded with contractservice), and - when the viewer holds the seat - offers resignation in the
 * arbiter panel. Giving the arbiter a separate component would be a second copy of the one screen
 * where getting the order of operations wrong costs money.
 *
 * Only deployed escrows appear: a record without a chain address has no seat to hold yet.
 */
function isDeployed(contract: UnifiedContract): contract is Contract {
  return 'contractAddress' in contract && !!contract.contractAddress;
}

const CLOSED = new Set(['RESOLVED', 'CLAIMED', 'COMPLETED', 'NEVER_FUNDED']);

export default function ArbiterDisputesPage() {
  const t = useT();
  const { isLoading: authLoading, isConnected, authenticatedFetch } = useAuth();
  const { config } = useConfig();
  const tokenSymbol = config?.tokenSymbol || 'USDC';

  const { contracts, isLoading, error, refetch } = useCombinedContracts({
    role: 'arbiter',
    enabled: !!isConnected && !!authenticatedFetch,
    fetcher: authenticatedFetch
  });
  const [selected, setSelected] = useState<Contract | null>(null);

  const { needsDecision, others } = useMemo(() => {
    const deployed = contracts.filter(isDeployed);
    const status = (c: Contract) => (c.backendStatus || c.status || '').toUpperCase();
    return {
      needsDecision: deployed.filter((c) => status(c) === 'DISPUTED'),
      others: deployed.filter((c) => status(c) !== 'DISPUTED' && !CLOSED.has(status(c)))
    };
  }, [contracts]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
        <h1 className="text-3xl font-semibold text-secondary-900 dark:text-white mb-3">{t('arbiterDisputes.title')}</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mb-6">{t('arbiterDisputes.signIn')}</p>
        <Link href="/dashboard" className={btnPrimary}>{t('arbiterDisputes.goToDashboard')}</Link>
      </div>
    );
  }

  const renderCard = (contract: Contract) => (
    <div
      key={contract.id || contract.contractAddress}
      className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-secondary-900 dark:text-white truncate">{contract.description}</p>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          {displayCurrency(contract.amount, 'microUSDC')} {tokenSymbol}
          {' · '}
          <span className="uppercase text-xs tracking-wide">{contract.backendStatus || contract.status}</span>
          {contract.expiryTimestamp ? ` · ${t('arbiterDisputes.releaseDate')} ${formatTimestamp(contract.expiryTimestamp).date}` : ''}
        </p>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          {t('contractCard.buyer')}{' '}
          <FarcasterNameDisplay identifier={contract.buyerEmail} fallbackToAddress={true} walletAddress={contract.buyerAddress} />
          {' · '}
          {t('contractAcceptance.seller')}{' '}
          <FarcasterNameDisplay identifier={contract.sellerEmail} fallbackToAddress={true} walletAddress={contract.sellerAddress} />
        </p>
        {contract.disputes && contract.disputes.length > 0 && (
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {t('arbiterDisputes.filings', { count: contract.disputes.length })}
          </p>
        )}
      </div>
      <Button type="button" size="sm" onClick={() => setSelected(contract)}>
        {(contract.backendStatus || contract.status || '').toUpperCase() === 'DISPUTED'
          ? t('arbiterDisputes.review')
          : t('arbiterDisputes.view')}
      </Button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-secondary-900 dark:text-white mb-2">{t('arbiterDisputes.title')}</h1>
        <p className="text-secondary-600 dark:text-secondary-300">{t('arbiterDisputes.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t('arbiterDisputes.loadFailed')}</p>
      ) : needsDecision.length === 0 && others.length === 0 ? (
        <p className="text-secondary-600 dark:text-secondary-300">{t('arbiterDisputes.none')}</p>
      ) : (
        <div className="space-y-8">
          {needsDecision.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('arbiterDisputes.needsDecision')}</h2>
              <div className="space-y-3">{needsDecision.map(renderCard)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('arbiterDisputes.otherSeats')}</h2>
              <div className="space-y-3">{others.map(renderCard)}</div>
            </section>
          )}
        </div>
      )}

      {selected && (
        <DisputeManagementModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          contract={selected}
          onRefresh={() => { refetch().catch(() => { /* error captured in hook state */ }); }}
        />
      )}
    </div>
  );
}
