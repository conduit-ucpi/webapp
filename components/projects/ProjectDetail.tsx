import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import { StatusBadge, RoleBadges } from '@/components/projects/ProjectBadges';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { ProjectNodeView, ProjectTreeView } from '@/types/projects';
import { fromBaseUnits } from '@/utils/projectMath';
import { formatDateTimeWithTZ, getRelativeTime } from '@/utils/validation';

interface ProjectDetailProps {
  tree: ProjectTreeView;
  onRefresh: () => void;
}

export default function ProjectDetail({ tree, onRefresh }: ProjectDetailProps) {
  const root = tree.nodes.find((n) => n.depth === 0) || tree.nodes[0];
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {tree.nodes.map((node) => (
        <NodeCard key={node.id} node={node} isRoot={node.id === root?.id} onRefresh={onRefresh} groupId={tree.groupId} />
      ))}
    </div>
  );
}

function NodeCard({
  node,
  isRoot,
  onRefresh,
  groupId,
}: {
  node: ProjectNodeView;
  isRoot: boolean;
  onRefresh: () => void;
  groupId: string;
}) {
  const router = useRouter();
  const { config } = useConfig();
  const { showToast } = useToast();
  const { markComplete, verifyComplete, raiseDispute, pending } = useProjectActions();
  const symbol = config?.tokenSymbol || 'USDC';
  const decimals = config?.usdcDetails?.decimals ?? 6;

  const status = node.chainState?.status ?? null;
  const roles = node.viewerRoles;
  const has = (r: string) => roles.includes(r as never);

  const expiryPassed = node.expiryTimestamp * 1000 <= Date.now();
  const funded = node.chainState?.funded ?? false;
  const canDispute = has('buyer') && funded && !expiryPassed && (status === 'ACTIVE' || status === 'AWAITING_VERIFICATION');
  const canMarkComplete = has('seller') && status === 'ACTIVE';
  const canVerify = has('verifier') && status === 'AWAITING_VERIFICATION';
  const canFund = has('buyer') && !!node.chainAddress && (status === 'CREATED' || (status && !funded));

  async function act(fn: () => Promise<string>, label: string) {
    try {
      await fn();
      showToast({ type: 'success', title: label, message: 'Transaction submitted.' });
      setTimeout(onRefresh, 2500);
    } catch (e) {
      showToast({ type: 'error', title: 'Action failed', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return (
    <div className={`rounded-lg border ${isRoot ? 'border-secondary-300 dark:border-secondary-600' : 'border-secondary-200 dark:border-secondary-800 ml-4'} p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 truncate">
              {node.description || 'Untitled'}
            </h2>
            {!isRoot && <span className="text-xs text-secondary-500 dark:text-secondary-400">child</span>}
          </div>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
            {symbol} {node.amount.toFixed(2)}
            {node.chainAddress && (
              <>
                {' · '}
                <a
                  href={explorerUrl(config?.chainId, node.chainAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:no-underline"
                >
                  {node.chainAddress.slice(0, 6)}…{node.chainAddress.slice(-4)}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={status} />
          <RoleBadges roles={roles} />
        </div>
      </div>

      {/* Dispute-deadline framing + G1 warning */}
      <div className="text-sm">
        <span className="text-secondary-500 dark:text-secondary-400">Dispute deadline: </span>
        <span className="text-secondary-900 dark:text-secondary-100">
          {formatDateTimeWithTZ(node.expiryTimestamp)} ({getRelativeTime(node.expiryTimestamp)})
        </span>
        {has('buyer') && funded && !expiryPassed && status !== 'CLAIMED' && (
          <p className="mt-1 text-amber-600 dark:text-amber-400">
            After this deadline you can no longer dispute. Funds never auto-release — they move only
            when the verifier confirms completion.
          </p>
        )}
      </div>

      {/* Split visualization */}
      <div>
        <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Recipients</h3>
        <ul className="space-y-1.5">
          {node.recipients.map((r, i) => {
            const payout = node.recipientPayoutsBaseUnits[i];
            return (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-secondary-700 dark:text-secondary-300 truncate mr-3">
                  {r.childGroupId ? '↳ subcontracted' : r.address ? `${r.address.slice(0, 8)}…${r.address.slice(-6)}` : '—'}
                </span>
                <span className="text-secondary-500 dark:text-secondary-400 shrink-0">
                  {(r.bps / 100).toFixed(2)}%
                  {payout && (
                    <span className="text-secondary-900 dark:text-secondary-100 ml-2">
                      {symbol} {fromBaseUnits(BigInt(payout), decimals)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {isRoot && node.feeBaseUnits !== '0' && (
          <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">
            Platform fee (1%): {symbol} {fromBaseUnits(BigInt(node.feeBaseUnits), decimals)} — deducted before the split
          </p>
        )}
      </div>

      {/* Role-gated actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        {canFund && (
          <FundButton node={node} onDone={onRefresh} />
        )}
        {canMarkComplete && (
          <Button onClick={() => act(() => markComplete(node.chainAddress!), 'Marked complete')} disabled={pending === 'markComplete'}>
            Mark complete
          </Button>
        )}
        {canVerify && (
          <Button onClick={() => act(() => verifyComplete(node.chainAddress!), 'Verified — paying out')} disabled={pending === 'verifyComplete'}>
            Verify &amp; pay out
          </Button>
        )}
        {canDispute && (
          <Button variant="outline" onClick={() => act(() => raiseDispute(node.chainAddress!), 'Dispute raised')} disabled={pending === 'raiseDispute'}>
            Raise dispute
          </Button>
        )}
        {(has('recipient') || has('seller')) && (
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/create?subcontract=${groupId}&node=${node.id}`)}
          >
            Subcontract this
          </Button>
        )}
        {isRoot && has('buyer') && (
          <Button variant="ghost" onClick={() => router.push(`/projects/create?clone=${groupId}`)}>
            Clone
          </Button>
        )}
      </div>
    </div>
  );
}

/** Fund-now for a deployed-but-unfunded node: approve (wallet) then proxy deposit. */
function FundButton({ node, onDone }: { node: ProjectNodeView; onDone: () => void }) {
  const { config } = useConfig();
  const { approveUSDC } = useSimpleEthers();
  const { authenticatedFetch } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const decimals = config?.usdcDetails?.decimals ?? 6;
  const tokenAddress = config?.usdcContractAddress || '';

  const amountBaseUnits = useMemo(() => {
    const fixed = node.amount.toFixed(decimals);
    const [w, f = ''] = fixed.split('.');
    return BigInt(w + f.padEnd(decimals, '0')).toString();
  }, [node.amount, decimals]);

  async function fund() {
    if (!node.chainAddress) return;
    setBusy(true);
    try {
      await approveUSDC(node.chainAddress, amountBaseUnits, tokenAddress);
      const res = await authenticatedFetch('/api/projects/chain/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractHash: node.chainAddress }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Funding failed');
      showToast({ type: 'success', title: 'Funded', message: 'Deposit complete.' });
      setTimeout(onDone, 2500);
    } catch (e) {
      showToast({ type: 'error', title: 'Funding failed', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={fund} disabled={busy}>
      Fund now
    </Button>
  );
}

function explorerUrl(chainId: number | undefined, address: string): string {
  // Base mainnet / Base Sepolia; fall back to Base mainnet explorer.
  if (chainId === 84532) return `https://sepolia.basescan.org/address/${address}`;
  return `https://basescan.org/address/${address}`;
}
