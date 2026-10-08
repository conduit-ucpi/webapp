import type { TranslateFn } from '@/i18n';
import type { ContractRefusedError } from '@/hooks/useMarketplaceActions';
import type { GasCostCapError } from '@/lib/web3';

/**
 * Why an escrow transaction was not sent, in words, for the failures a party can meet on the
 * dispute screens; null when it is none of these, so the caller falls back to the raw message.
 *
 * Shared by the settlement vote and the tiebreaker panel so the same refusal reads the same on
 * both. Screen-specific refusals (a nomination's candidate) stay with their screen.
 *
 * ⚠️ MATCHED BY NAME, NOT instanceof. These errors cross the hook boundary, which tests replace
 *    wholesale, and a bundler can load two copies of a class.
 */
export function explainTransactionFailure(e: unknown, t: TranslateFn): string | null {
  if (!(e instanceof Error)) return null;

  if (e.name === 'GasCostCapError') {
    const { costWei, capWei } = e as GasCostCapError;
    return t('transaction.overGasCostCap', { cost: formatEth(costWei), cap: formatEth(capWei) });
  }

  if (e.name !== 'ContractRefusedError') return null;
  const { reason, from } = e as ContractRefusedError;
  switch (reason?.name) {
    case 'NotAuthorizedToVote':
      return t('transaction.refusedNotVoter', { address: from ?? t('transaction.unknownWallet') });
    case 'ContractMustBeDisputed':
    case 'ConsensusAlreadyReached':
      return t('transaction.refusedNotInDispute');
    case 'InvalidPercentage':
      return t('transaction.refusedInvalidPercentage');
    default:
      return null;
  }
}

/** Gas costs are tiny fractions of an ETH: enough significant figures to tell them apart. */
function formatEth(wei: bigint): string {
  return (Number(wei) / 1e18).toPrecision(2);
}
