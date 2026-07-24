import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import CreateProjectWizard, { ProjectPrefill } from '@/components/projects/CreateProjectWizard';
import { SubcontractContext } from '@/hooks/useProjectCreation';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Skeleton from '@/components/ui/Skeleton';
import { ProjectTreeView } from '@/types/projects';

type Intent = 'create' | 'clone' | 'subcontract';

export default function CreateProjectPage() {
  const { isLoading, isConnected, address, user, authenticatedFetch } = useAuth();
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';
  const wallet = user?.walletAddress || address || '';

  const cloneId = typeof router.query.clone === 'string' ? router.query.clone : null;
  const subGroupId = typeof router.query.subcontract === 'string' ? router.query.subcontract : null;
  const subNodeId = typeof router.query.node === 'string' ? router.query.node : null;
  const intent: Intent = cloneId ? 'clone' : subGroupId ? 'subcontract' : 'create';

  const [prefill, setPrefill] = useState<ProjectPrefill | undefined>();
  const [subcontract, setSubcontract] = useState<SubcontractContext | undefined>();
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    const groupId = cloneId || subGroupId;
    if (!groupId || !wallet || !isConnected) return;
    let cancelled = false;
    setLoadingPrefill(true);
    (async () => {
      try {
        const res = await authenticatedFetch(`/api/projects/${groupId}?viewer=${wallet}`);
        const tree: ProjectTreeView = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error((tree as unknown as { error?: string }).error || 'Failed to load source project');

        if (cloneId) {
          setPrefill(buildClonePrefill(tree));
        } else if (subGroupId && subNodeId) {
          const built = buildSubcontractPrefill(tree, subNodeId, wallet);
          if (!built) throw new Error('Could not find your recipient slice to subcontract');
          setPrefill(built.prefill);
          setSubcontract({ parentGroupId: subGroupId, parentNodeId: subNodeId, sliceIndex: built.sliceIndex });
        }
      } catch (e) {
        if (!cancelled) setPrefillError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoadingPrefill(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // NOTE: authenticatedFetch is intentionally NOT a dependency. It comes from
    // useSimpleEthers, which returns a fresh object each render; including the
    // function identity re-fires this effect every render (prefill reload loop).
    // The primitive deps below already capture every input that should
    // re-trigger the prefill fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloneId, subGroupId, subNodeId, wallet, isConnected]);

  if (isLoading) {
    return (
      <div className="py-10 max-w-3xl mx-auto px-4">
        <Skeleton className="h-8 w-80 mx-auto mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 dark:text-secondary-400 mb-6">Connect your wallet to create a project.</p>
        <ConnectWalletEmbedded useSmartRouting={true} autoConnect={autoConnect} />
      </div>
    );
  }

  const heading =
    intent === 'clone' ? 'Clone project' : intent === 'subcontract' ? 'Subcontract a slice' : 'New project';

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">{heading}</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-400">
            Fund a pot that pays your team on verified completion
          </p>
        </div>
        {prefillError && (
          <div className="max-w-2xl mx-auto mb-6 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {prefillError}
          </div>
        )}
        {loadingPrefill ? (
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <CreateProjectWizard prefill={prefill} subcontract={subcontract} intent={intent} />
        )}
      </div>
    </div>
  );
}

/** Clone: copy parties + splits (as percentages) from the source root. */
function buildClonePrefill(tree: ProjectTreeView): ProjectPrefill {
  const root = tree.nodes.find((n) => n.depth === 0) || tree.nodes[0];
  return {
    sellerAddress: root.sellerAddress,
    verifierAddress: root.verifierAddress || undefined,
    description: root.description,
    totalAmount: String(root.amount),
    splitMode: 'percent',
    recipients: root.recipients
      .filter((r) => !!r.address)
      .map((r) => ({ address: r.address as string, value: (r.bps / 100).toString(), email: '' })),
  };
}

/**
 * Subcontract: seed the new project's budget with the caller's payout slice of
 * the parent node; they define their own supplier/recipients.
 */
function buildSubcontractPrefill(
  tree: ProjectTreeView,
  nodeId: string,
  wallet: string
): { prefill: ProjectPrefill; sliceIndex: number } | null {
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const sliceIndex = node.recipients.findIndex((r) => r.address?.toLowerCase() === wallet.toLowerCase());
  if (sliceIndex < 0) return null;
  const slice = node.recipients[sliceIndex];
  const sliceAmount = (node.amount * slice.bps) / 10000;
  return {
    prefill: {
      description: `Subcontract of: ${node.description}`,
      totalAmount: sliceAmount.toFixed(2),
      splitMode: 'amount',
      recipients: [{ address: '', value: '', email: '' }],
    },
    sliceIndex,
  };
}
