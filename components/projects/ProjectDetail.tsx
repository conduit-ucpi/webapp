import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import { StatusBadge, RoleBadges } from '@/components/projects/ProjectBadges';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { ProjectDescendantTree, ProjectNode, ProjectNodeView, ProjectTreeView } from '@/types/projects';
import { formatTokenAmount, fromBaseUnits } from '@/utils/projectMath';

interface ProjectDetailProps {
  tree: ProjectTreeView;
  onRefresh: () => void;
}

export default function ProjectDetail({ tree, onRefresh }: ProjectDetailProps) {
  // Committed children render nested under the recipient slice that pays
  // them, so only roots (and orphans whose parent isn't in the response)
  // appear at the top level.
  const { roots, nodesById } = useMemo(() => {
    const nodesById = new Map(tree.nodes.map((n) => [n.id, n]));
    const roots = tree.nodes.filter((n) => !n.parentId || !nodesById.has(n.parentId));
    return { roots, nodesById };
  }, [tree.nodes]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <DeploymentPanel tree={tree} onRefresh={onRefresh} />
      {roots[0]?.parentGroupId && (
        <Link
          href={`/projects/${roots[0].parentGroupId}`}
          className="inline-block text-sm text-secondary-500 dark:text-secondary-400 underline hover:no-underline"
        >
          ↖ Subcontract of a parent project
        </Link>
      )}
      {roots.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          isRoot={node.depth === 0}
          nodesById={nodesById}
          descendants={tree.descendants}
          onRefresh={onRefresh}
          groupId={tree.groupId}
        />
      ))}
    </div>
  );
}

function NodeCard({
  node,
  isRoot,
  nodesById,
  descendants,
  onRefresh,
  groupId,
}: {
  node: ProjectNodeView;
  isRoot: boolean;
  nodesById: Map<string, ProjectNodeView>;
  descendants?: Record<string, ProjectDescendantTree>;
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

  const funded = node.chainState?.funded ?? false;
  // No deadline: the buyer can dispute right up until payout.
  const canDispute = has('buyer') && funded && (status === 'ACTIVE' || status === 'AWAITING_VERIFICATION');
  const canMarkComplete = has('seller') && status === 'ACTIVE';
  const canVerify = has('verifier') && status === 'AWAITING_VERIFICATION';
  // Committed children (parentId set) are funded by the parent contract's
  // payout, never by a wallet deposit.
  const isCommittedChild = !!node.parentId;
  const canFund = has('buyer') && !isCommittedChild && !!node.chainAddress && (status === 'CREATED' || (status && !funded));

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
    <div className={`rounded-lg border ${isRoot ? 'border-secondary-300 dark:border-secondary-600' : 'border-secondary-200 dark:border-secondary-800'} p-5 space-y-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 truncate">
              {node.description || 'Untitled'}
            </h2>
            {!isRoot && <span className="text-xs text-secondary-500 dark:text-secondary-400">child</span>}
          </div>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
            {symbol} {formatTokenAmount(node.amount, decimals)}
            {isCommittedChild && ' · funded by the parent contract'}
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

      {/* No deadline: dispute stays open until the verifier releases the funds */}
      {has('buyer') && funded && status !== 'CLAIMED' && (
        <p className="text-sm text-secondary-500 dark:text-secondary-400">
          You can raise a dispute at any time until the verifier confirms completion. Funds never
          auto-release and there is no deadline to miss.
        </p>
      )}

      {!node.chainAddress && (
        <ReadyToggle node={node} groupId={groupId} canApprove={has('verifier')} onRefresh={onRefresh} />
      )}

      {/* Who holds each role — the buyer line is what says who can dispute. */}
      <div>
        <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Parties</h3>
        <dl className="space-y-1 text-sm">
          <PartyRow
            label="Buyer"
            address={node.effectiveBuyerAddress}
            note={
              node.buyerFromParent
                ? 'the parent project’s supplier — they fund this contract and can dispute it'
                : 'funds the contract and can raise a dispute'
            }
          />
          <PartyRow label="Supplier" address={node.sellerAddress} note="marks the work complete" />
          <PartyRow
            label="Verifier"
            address={node.effectiveVerifierAddress}
            note={node.verifierIsBuyer ? 'not nominated, so the buyer verifies' : 'confirms completion and releases payment'}
          />
        </dl>
      </div>

      {/* Split visualization */}
      <div>
        <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">Recipients</h3>
        <ul className="space-y-1.5">
          {node.recipients.map((r, i) => {
            const payout = node.recipientPayoutsBaseUnits[i];
            const share = (
              <span className="text-secondary-500 dark:text-secondary-400 shrink-0">
                {(r.bps / 100).toFixed(2)}%
                {payout && (
                  <span className="text-secondary-900 dark:text-secondary-100 ml-2">
                    {symbol} {fromBaseUnits(BigInt(payout), decimals)}
                  </span>
                )}
              </span>
            );
            const child = r.childId ? nodesById.get(r.childId) : undefined;
            if (child) {
              return (
                <ChildSlice
                  key={i}
                  child={child}
                  share={share}
                  nodesById={nodesById}
                  descendants={descendants}
                  onRefresh={onRefresh}
                  groupId={groupId}
                />
              );
            }
            if (r.childGroupId) {
              return (
                <DescendantSlice
                  key={i}
                  groupId={r.childGroupId}
                  descendants={descendants}
                  share={share}
                  decimals={decimals}
                />
              );
            }
            return (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-secondary-700 dark:text-secondary-300 truncate mr-3">
                  {r.address ? (
                    `${r.address.slice(0, 8)}…${r.address.slice(-6)}`
                  ) : (
                    <span className="font-sans italic text-secondary-500 dark:text-secondary-400">
                      address assigned at deploy
                    </span>
                  )}
                </span>
                {share}
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

/**
 * Draft → on-chain step. A project is saved off-chain first; this panel is
 * where it gets committed, once every wallet address the deploy needs is
 * present. Funding is a separate step afterwards, on the root node card.
 */
function DeploymentPanel({ tree, onRefresh }: { tree: ProjectTreeView; onRefresh: () => void }) {
  const { config } = useConfig();
  const { authenticatedFetch } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const deployment = tree.deployment;

  if (!deployment || deployment.deployed) return null;

  async function deploy() {
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/api/projects/${tree.groupId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: config?.usdcContractAddress || '',
          chainId: config?.chainId ? String(config.chainId) : '',
          // The recorded buyer, not the clicking wallet: any party may trigger
          // the deploy, but the escrow's buyer must be the project's buyer.
          buyerAddress: deployment.buyerAddress,
          tokenDecimals: config?.usdcDetails?.decimals ?? 6,
        }),
      });
      const data = await res.json();
      // Services answer {error: <category>, message: <detail>}; the detail is
      // what names the contract that is blocking, so prefer it.
      if (!res.ok) throw new Error(data.message || data.error || 'Deploy failed');
      showToast({ type: 'success', title: 'Deployed', message: 'The escrow contracts are live on-chain.' });
      setTimeout(onRefresh, 2500);
    } catch (e) {
      showToast({ type: 'error', title: 'Deploy failed', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-secondary-300 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-800/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-secondary-900 dark:text-secondary-100">
            {deployment.partiallyDeployed ? 'Partly deployed' : 'Draft — not yet on-chain'}
          </h2>
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-1">
            {deployment.partiallyDeployed
              ? 'Some contracts deployed before the run stopped. Retrying continues where it left off; contracts already live are left alone.'
              : 'This project is saved but no escrow exists yet. Deploying creates the contracts on-chain — every subcontract below it too, deepest first — with gas covered for you. Funding is a separate step afterwards.'}
          </p>
        </div>
        {deployment.ready && (
          <Button onClick={deploy} disabled={busy} className="shrink-0">
            {busy ? 'Deploying…' : deployment.partiallyDeployed ? 'Retry deploy' : 'Deploy on-chain'}
          </Button>
        )}
      </div>
      {!deployment.ready && (
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">
            Still needed before this can go on-chain — a contract only deploys once everything
            below it can too:
          </p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            {deployment.missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * A recipient slice whose payout goes to a committed child node in the same
 * tree: header row (name, status, share) with the child's full card nested
 * beneath, collapsible.
 */
function ChildSlice({
  child,
  share,
  nodesById,
  descendants,
  onRefresh,
  groupId,
}: {
  child: ProjectNodeView;
  share: React.ReactNode;
  nodesById: Map<string, ProjectNodeView>;
  descendants?: Record<string, ProjectDescendantTree>;
  onRefresh: () => void;
  groupId: string;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li className="text-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 min-w-0 text-secondary-700 dark:text-secondary-300 mr-3"
        >
          <span className="text-secondary-400 shrink-0">{expanded ? '▾' : '▸'}</span>
          <span className="truncate">{child.description || 'Untitled'}</span>
          <span className="shrink-0">
            <StatusBadge status={child.chainState?.status ?? null} />
          </span>
        </button>
        {share}
      </div>
      {expanded && (
        <div className="mt-2 ml-2 border-l-2 border-secondary-200 dark:border-secondary-700 pl-3">
          <NodeCard
            node={child}
            isRoot={false}
            nodesById={nodesById}
            descendants={descendants}
            onRefresh={onRefresh}
            groupId={groupId}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The verifier's sign-off on one contract's terms. Nothing in the chain can be
 * deployed until every contract is ticked, and only this contract's verifier
 * can tick it — approval can't be granted from further up.
 */
function ReadyToggle({
  node,
  groupId,
  canApprove,
  onRefresh,
}: {
  node: ProjectNodeView;
  groupId: string;
  canApprove: boolean;
  onRefresh: () => void;
}) {
  const { authenticatedFetch } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const approved = !!node.markedReadyAt;

  async function toggle() {
    setBusy(true);
    try {
      const res = await authenticatedFetch(`/api/projects/${groupId}/nodes/${node.id}/ready`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready: !approved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Could not update');
      onRefresh();
    } catch (e) {
      showToast({ type: 'error', title: 'Could not update', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }

  if (!canApprove) {
    return (
      <p className="text-sm text-secondary-500 dark:text-secondary-400">
        {approved ? '✓ Terms approved by the verifier' : 'Awaiting the verifier’s approval of these terms'}
      </p>
    );
  }

  return (
    <label className="flex items-start gap-2 text-sm text-secondary-700 dark:text-secondary-300">
      <input
        type="checkbox"
        checked={approved}
        disabled={busy}
        onChange={toggle}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span>
        These terms are ready to go on-chain
        <span className="block text-xs text-secondary-500 dark:text-secondary-400">
          You verify this contract. Nothing deploys until every contract in the chain is ticked, and
          editing a contract clears its tick.
        </span>
      </span>
    </label>
  );
}

function PartyRow({ label, address, note }: { label: string; address: string | null; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-secondary-500 dark:text-secondary-400 w-16 shrink-0">{label}</dt>
      <dd className="font-mono text-secondary-700 dark:text-secondary-300">
        {address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'not set'}
      </dd>
      <span className="text-xs text-secondary-500 dark:text-secondary-400">— {note}</span>
    </div>
  );
}

/**
 * A recipient slice subcontracted into a separate tree. contractfanoutservice
 * returns every tree below this project — children, grandchildren and deeper —
 * so the whole chain renders inline, read-only. Acting on a subcontract happens
 * on its own page, where the viewer's roles there are known.
 */
function DescendantSlice({
  groupId,
  descendants,
  share,
  decimals,
}: {
  groupId: string;
  descendants?: Record<string, ProjectDescendantTree>;
  share: React.ReactNode;
  decimals: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const tree = descendants?.[groupId];

  if (!tree) {
    // No resolved tree: the link still works for anyone allowed to open it.
    return (
      <li className="flex items-center justify-between text-sm">
        <Link
          href={`/projects/${groupId}`}
          className="text-secondary-700 dark:text-secondary-300 underline hover:no-underline truncate mr-3"
        >
          ↳ subcontracted project
        </Link>
        {share}
      </li>
    );
  }

  return (
    <li className="text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0 mr-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-secondary-400 shrink-0"
            aria-label={expanded ? 'Collapse subcontract' : 'Expand subcontract'}
          >
            {expanded ? '▾' : '▸'}
          </button>
          <Link
            href={`/projects/${groupId}`}
            className="text-secondary-700 dark:text-secondary-300 underline hover:no-underline truncate"
          >
            ↳ {tree.description || 'Subcontracted project'}
          </Link>
          <span className="text-secondary-500 dark:text-secondary-400 shrink-0">
            {tree.currencySymbol} {formatTokenAmount(tree.amount, decimals)}
          </span>
        </div>
        {share}
      </div>
      {expanded && (
        <div className="mt-2 ml-2 border-l-2 border-dashed border-secondary-200 dark:border-secondary-700 pl-3 space-y-2">
          <DescendantNodes tree={tree} descendants={descendants} decimals={decimals} />
        </div>
      )}
    </li>
  );
}

/** The nodes of one subcontract tree, nested by parent, read-only. */
function DescendantNodes({
  tree,
  descendants,
  decimals,
}: {
  tree: ProjectDescendantTree;
  descendants?: Record<string, ProjectDescendantTree>;
  decimals: number;
}) {
  const nodesById = new Map(tree.nodes.map((n) => [n.id, n]));
  const roots = tree.nodes.filter((n) => !n.parentId || !nodesById.has(n.parentId));
  return (
    <>
      {roots.map((node) => (
        <DescendantNode
          key={node.id}
          node={node}
          nodesById={nodesById}
          descendants={descendants}
          decimals={decimals}
        />
      ))}
    </>
  );
}

function DescendantNode({
  node,
  nodesById,
  descendants,
  decimals,
}: {
  node: ProjectNode;
  nodesById: Map<string, ProjectNode>;
  descendants?: Record<string, ProjectDescendantTree>;
  decimals: number;
}) {
  const symbol = node.currencySymbol || node.currency || 'USDC';
  return (
    <div className="space-y-1">
      <p className="text-secondary-600 dark:text-secondary-400">
        {node.description || 'Untitled'} · {symbol} {formatTokenAmount(node.amount, decimals)}
        {!node.chainAddress && (
          <span className="ml-2 text-xs">
            {node.markedReadyAt ? '✓ approved' : '· awaiting verifier approval'}
          </span>
        )}
      </p>
      <ul className="space-y-1">
        {node.recipients.map((r, i) => {
          // Shares only: per-recipient payout previews are computed for the
          // project being viewed, not for subcontracts (their own page does it).
          const share = (
            <span className="text-secondary-500 dark:text-secondary-400 shrink-0">{(r.bps / 100).toFixed(2)}%</span>
          );
          const child = r.childId ? nodesById.get(r.childId) : undefined;
          if (child) {
            return (
              <li key={i} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate mr-3 text-secondary-600 dark:text-secondary-400">
                    {child.description || 'Child'}
                  </span>
                  {share}
                </div>
                <div className="mt-1 ml-2 border-l-2 border-secondary-200 dark:border-secondary-700 pl-3">
                  <DescendantNode
                    node={child}
                    nodesById={nodesById}
                    descendants={descendants}
                    decimals={decimals}
                  />
                </div>
              </li>
            );
          }
          if (r.childGroupId) {
            return (
              <DescendantSlice
                key={i}
                groupId={r.childGroupId}
                descendants={descendants}
                share={share}
                decimals={decimals}
              />
            );
          }
          return (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="font-mono text-secondary-600 dark:text-secondary-400 truncate mr-3">
                {r.address ? `${r.address.slice(0, 8)}…${r.address.slice(-6)}` : 'address assigned at deploy'}
              </span>
              {share}
            </li>
          );
        })}
      </ul>
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
