import { apiFetch } from '@/lib/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { displayCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import { DisputeSummary, ReleaseResult, SweepSummary, disputeStatusColor } from '@/types/disputes';

interface DisputeQueueProps {
  onSelect?: (contractId: string) => void;
  /** Bumped by the parent when a case changed elsewhere, so the queue re-reads. */
  refreshKey?: number;
}

/**
 * The arbiter's queue, oldest past maturity first, with the two batch actions an admin has:
 * run a sweep (never votes) and release the ready batch to the Safe (proposes; a second Safe
 * owner still has to confirm). Everything shown here is disputeservice's answer; this
 * component decides nothing.
 */
export default function DisputeQueue({ onSelect, refreshKey = 0 }: DisputeQueueProps) {
  const [rows, setRows] = useState<DisputeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweep, setSweep] = useState<SweepSummary | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [release, setRelease] = useState<ReleaseResult | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/admin/disputes');
      if (!response.ok) throw new Error(`Failed to load the dispute queue: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid response format from server');
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load the dispute queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const runSweep = async () => {
    setIsSweeping(true);
    setSweep(null);
    try {
      const response = await apiFetch('/api/admin/disputes/sweep', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Sweep failed: ${response.status}`);
      setSweep(data);
      await load();
    } catch (e: any) {
      setError(e.message || 'Sweep failed');
    } finally {
      setIsSweeping(false);
    }
  };

  const readyCount = rows.filter((r) => r.status === 'READY_TO_EXECUTE').length;

  const releaseBatch = async () => {
    if (!window.confirm(`Propose ${readyCount} vote(s) to the arbiter Safe? A second Safe owner will still have to confirm, but once they do the votes are final.`)) return;
    setIsReleasing(true);
    setRelease(null);
    try {
      const response = await apiFetch('/api/admin/disputes/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Release failed: ${response.status}`);
      setRelease(data);
      await load();
    } catch (e: any) {
      setError(e.message || 'Release failed');
    } finally {
      setIsReleasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm border border-gray-200 dark:border-secondary-700">
      <div className="p-6 border-b border-gray-200 dark:border-secondary-700">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dispute Arbitration</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                DEFAULT ARBITER
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-secondary-300">
              {rows.length} open dispute{rows.length === 1 ? '' : 's'} the default arbiter is responsible for, oldest past maturity first.
              {readyCount > 0 && ` ${readyCount} ready to execute.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runSweep} disabled={isSweeping} variant="outline" size="sm">
              {isSweeping ? 'Sweeping…' : 'Run sweep'}
            </Button>
            <Button onClick={releaseBatch} disabled={isReleasing || readyCount === 0} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
              {isReleasing ? 'Proposing…' : `Release ready batch (${readyCount})`}
            </Button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

        {sweep && (
          <div className="mt-4 text-sm text-gray-700 dark:text-secondary-300 bg-gray-50 dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 rounded p-3">
            Sweep at {formatDateTimeWithTZ(sweep.at)}: {sweep.queued} queued, {sweep.changed} changed, {sweep.failed} failed
            {sweep.skipped ? `, ${sweep.skipped} skipped — the chain could not be read for them; the next sweep tries again` : ''}.
          </div>
        )}

        {release && (
          <div className="mt-4 text-sm bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3 space-y-1">
            {release.error && <div className="text-red-700 dark:text-red-400">{release.error}</div>}
            {release.proposed.length > 0 && (
              <div className="text-gray-800 dark:text-secondary-200">
                Proposed {release.proposed.length} vote(s) as Safe transaction nonce {release.nonce}.{' '}
                {release.safeAppUrl && (
                  <a href={release.safeAppUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 underline">
                    Confirm in the Safe app
                  </a>
                )}
              </div>
            )}
            {Object.keys(release.rejected).length > 0 && (
              <div className="text-gray-700 dark:text-secondary-300">
                Rejected by chainservice: {Object.entries(release.rejected).map(([addr, why]) => `${addr}: ${why}`).join('; ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-secondary-700">
          <thead className="bg-gray-50 dark:bg-secondary-800">
            <tr>
              {['Escrow', 'Description', 'Amount', 'Past maturity', 'Status', 'Rule', 'Split', 'Next deadline'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-secondary-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-secondary-900 divide-y divide-gray-200 dark:divide-secondary-700">
            {rows.map((r) => {
              const deadline = r.status === 'HOLD' ? r.holdDeadline : r.responseDeadline;
              return (
                <tr key={r.contractId} className="hover:bg-gray-50 dark:hover:bg-secondary-800 cursor-pointer transition-colors" onClick={() => onSelect?.(r.contractId)} data-testid={`dispute-row-${r.contractId}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {r.escrowAddress ? <ExpandableHash hash={r.escrowAddress} /> : <span className="text-gray-400 dark:text-secondary-500">-</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs"><div className="truncate" title={r.description}>{r.description}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{displayCurrency(Number(r.amountMicro), 'microUSDC')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.daysPastMaturity > 0 ? `${r.daysPastMaturity} d` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${disputeStatusColor(r.status)}`}>{r.status ?? 'NOT SEEN'}</span>
                    {r.escalationReason && <div className="text-xs text-red-700 dark:text-red-400 mt-1">{r.escalationReason}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.caseApplied ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.buyerPercentage != null ? `${r.buyerPercentage}% buyer` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{deadline ? formatDateTimeWithTZ(deadline) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && !error && (
        <div className="text-center py-12 text-gray-600 dark:text-secondary-300">No open disputes for the default arbiter.</div>
      )}
    </div>
  );
}
