import { apiFetch } from '@/lib/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { displayCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import { DisputeCaseDetail, disputeStatusColor } from '@/types/disputes';

interface DisputeCasePanelProps {
  contractId: string;
  onClose: () => void;
  /** Called after any action that changed the case, so the queue can re-read. */
  onChanged?: () => void;
}

/**
 * One case: the decision brief's inputs side by side (§8b of the arbitration policy — "is this
 * a fair account of the case?"), the record so far, and the two things an admin can do to it:
 * run a pass, and decide it when it has been escalated. A decision entered here goes through
 * the same hold window as a rules decision; nothing is cast from this screen.
 */
export default function DisputeCasePanel({ contractId, onClose, onChanged }: DisputeCasePanelProps) {
  const [detail, setDetail] = useState<DisputeCaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [buyerPercentage, setBuyerPercentage] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [openNotice, setOpenNotice] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/disputes/${encodeURIComponent(contractId)}`);
      if (!response.ok) throw new Error(response.status === 404 ? 'Case not found' : `Failed to load the case: ${response.status}`);
      setDetail(await response.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load the case');
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const runPass = async () => {
    setIsWorking(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/disputes/${encodeURIComponent(contractId)}/process`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Pass failed: ${response.status}`);
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Pass failed');
    } finally {
      setIsWorking(false);
    }
  };

  const decide = async () => {
    const pct = Number(buyerPercentage);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      setError('Buyer percentage must be a whole number from 0 to 100');
      return;
    }
    if (!reasoning.trim()) {
      setError('Reasoning is required; it is what the losing party reads');
      return;
    }
    setIsWorking(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/disputes/${encodeURIComponent(contractId)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerPercentage: pct, reasoning: reasoning.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Decision failed: ${response.status}`);
      setBuyerPercentage('');
      setReasoning('');
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Decision failed');
    } finally {
      setIsWorking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const facts = detail?.facts;
  const c = detail?.disputeCase ?? null;
  const partyFilings = (party: 'BUYER' | 'SELLER') => (facts?.filings ?? []).filter((f) => f.party === party);

  return (
    <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm border border-secondary-200 dark:border-secondary-700 p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Dispute Case</h2>
          {c && <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${disputeStatusColor(c.status)}`}>{c.status}</span>}
        </div>
        <div className="flex space-x-2">
          <Button onClick={runPass} disabled={isWorking} variant="outline" size="sm">{isWorking ? 'Working…' : 'Run pass'}</Button>
          <Button onClick={onClose} variant="outline" size="sm">Close</Button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {facts && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold text-gray-900 dark:text-white mb-2">Escrow</div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Contract</span><span className="font-mono">{facts.contractId}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Address</span><ExpandableHash hash={facts.escrowAddress} /></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Amount</span><span>{displayCurrency(Number(facts.amountMicro), 'microUSDC')}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Maturity</span><span>{formatDateTimeWithTZ(facts.expiryTimestamp)}{facts.daysPastMaturity > 0 && ` (${facts.daysPastMaturity} d ago)`}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Chain status</span><span>{facts.chain.status ?? 'unreadable'}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Arbiter seat</span><span>{facts.chain.seated ? (facts.chain.isDefaultArbiter ? 'default Safe' : 'someone else') : 'empty'}</span></div>
              <div className="text-gray-800 dark:text-secondary-200 pt-2">{facts.description}</div>
            </div>

            <div className="bg-gray-50 dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold text-gray-900 dark:text-white mb-2">Case</div>
              {c ? (
                <>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Rule</span><span>{c.caseApplied ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Intended split</span><span>{c.buyerPercentage != null ? `${c.buyerPercentage}% buyer / ${100 - c.buyerPercentage}% seller` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Response deadline</span><span>{c.responseDeadline ? formatDateTimeWithTZ(c.responseDeadline) : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Hold until</span><span>{c.holdDeadline ? formatDateTimeWithTZ(c.holdDeadline) : '-'}</span></div>
                  {c.escalationReason && <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Escalated</span><span className="text-red-700 dark:text-red-400">{c.escalationReason}</span></div>}
                  {c.safeTxHash && <div className="flex justify-between"><span className="text-gray-600 dark:text-secondary-300">Safe tx</span><ExpandableHash hash={c.safeTxHash} /></div>}
                  {c.reasoning && <div className="text-gray-800 dark:text-secondary-200 pt-2 italic">{c.reasoning}</div>}
                </>
              ) : (
                <div className="text-gray-600 dark:text-secondary-300">Not yet seen by the arbiter service. Run a pass to open it.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {(['BUYER', 'SELLER'] as const).map((party) => {
              const key = party.toLowerCase();
              const vote = party === 'BUYER' ? facts.chain.buyerVote : facts.chain.sellerVote;
              const wallet = party === 'BUYER' ? facts.chain.buyer : facts.chain.seller;
              return (
                <div key={party} className="border border-gray-200 dark:border-secondary-700 rounded-lg p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{party === 'BUYER' ? 'Buyer' : 'Seller'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${facts.reachability[key] === 'VERIFIED' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-secondary-800 text-gray-700 dark:text-secondary-300'}`}>
                      {facts.reachability[key] === 'VERIFIED' ? 'verified email' : 'no verified email'}
                    </span>
                  </div>
                  {wallet && <div className="mb-2"><ExpandableHash hash={wallet} /></div>}
                  <div className="text-gray-700 dark:text-secondary-300 mb-2">On-chain vote: {vote != null ? `${vote}% to buyer` : 'none'}</div>
                  {partyFilings(party).length === 0 ? (
                    <div className="text-gray-500 dark:text-secondary-400">No filing.</div>
                  ) : (
                    <ul className="space-y-2">
                      {partyFilings(party).map((f, i) => (
                        <li key={i} className="bg-gray-50 dark:bg-secondary-800 rounded p-2">
                          <div className="text-xs text-gray-500 dark:text-secondary-400">{formatDateTimeWithTZ(f.timestamp)}{f.refundPercent != null && ` · proposes ${f.refundPercent}% to buyer`}</div>
                          <div className="text-gray-800 dark:text-secondary-200 whitespace-pre-wrap">{f.reason || <span className="text-gray-400 dark:text-secondary-500">(no text)</span>}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {c?.status === 'ESCALATED' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-red-900 dark:text-red-200 mb-1">Decide this case</h3>
              <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                Escalated: {c.escalationReason}. Your decision is recorded under your identity and both parties get the hold window before it can be released. Write the reasoning for the losing party.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input type="number" min={0} max={100} placeholder="% to buyer" value={buyerPercentage} onChange={(e) => setBuyerPercentage(e.target.value)} className="w-full sm:w-32" aria-label="Buyer percentage" />
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Reasoning, written for the losing party"
                  aria-label="Reasoning"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-secondary-600 bg-white text-secondary-900 dark:bg-secondary-800 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
                <Button onClick={decide} disabled={isWorking} size="sm" className="bg-red-600 hover:bg-red-700 text-white">Record decision</Button>
              </div>
            </div>
          )}

          {c && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 dark:border-secondary-700 rounded-lg p-4 text-sm">
                <div className="font-semibold text-gray-900 dark:text-white mb-2">Notices</div>
                {c.notices.length === 0 ? <div className="text-gray-500 dark:text-secondary-400">None sent.</div> : (
                  <ul className="space-y-1">
                    {c.notices.map((n, i) => (
                      <li key={i}>
                        <div className="flex justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenNotice(openNotice === i ? null : i)}
                            className="text-left hover:underline"
                            aria-expanded={openNotice === i}
                          >
                            {openNotice === i ? '▾' : '▸'} {n.kind} → {n.party}
                          </button>
                          <span className={n.outcome === 'sent' ? 'text-green-700 dark:text-green-400' : n.outcome === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-secondary-400'}>{n.outcome}{n.messageId && ` · ${n.messageId}`}</span>
                          <span className="text-gray-500 dark:text-secondary-400">{formatDateTimeWithTZ(n.sentAt)}</span>
                        </div>
                        {openNotice === i && (
                          <div className="mt-2 mb-3 border border-gray-200 dark:border-secondary-700 rounded">
                            {n.body ? (
                              <>
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-secondary-700 font-medium text-gray-900 dark:text-white">{n.subject}</div>
                                {/* The email as sent. Sandboxed with no permissions: it is our own template, but it quotes party-supplied text. */}
                                <iframe title={`${n.kind} to ${n.party}`} srcDoc={n.body} sandbox="" className="w-full h-96 bg-white rounded-b" />
                              </>
                            ) : (
                              <div className="px-3 py-2 text-gray-500 dark:text-secondary-400">
                                {n.outcome === 'no-address' ? 'Nothing was sent: this party has no verified email address.' : 'Content not recorded — this notice was sent before notice content was kept.'}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border border-gray-200 dark:border-secondary-700 rounded-lg p-4 text-sm">
                <div className="font-semibold text-gray-900 dark:text-white mb-2">Record</div>
                <ul className="space-y-1 max-h-64 overflow-y-auto">
                  {c.decisions.map((d, i) => (
                    <li key={`d${i}`} className="text-gray-800 dark:text-secondary-200">
                      <span className="text-gray-500 dark:text-secondary-400">{formatDateTimeWithTZ(d.at)}</span> decision by {d.decider}: {d.action} {d.caseApplied ?? ''} {d.buyerPercentage != null ? `${d.buyerPercentage}%` : ''}
                    </li>
                  ))}
                  {c.events.map((e, i) => (
                    <li key={`e${i}`} className="text-gray-600 dark:text-secondary-300">
                      <span className="text-gray-500 dark:text-secondary-400">{formatDateTimeWithTZ(e.at)}</span> {e.type}{e.detail && ` — ${e.detail}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
