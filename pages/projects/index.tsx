import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { StatusBadge, RoleBadges } from '@/components/projects/ProjectBadges';
import { ProjectNodeView } from '@/types/projects';

export default function ProjectsListPage() {
  const { isLoading, isConnected, address, user, authenticatedFetch } = useAuth();
  const { config } = useConfig();
  const router = useRouter();
  const wallet = user?.walletAddress || address || '';
  const symbol = config?.tokenSymbol || 'USDC';

  const [projects, setProjects] = useState<ProjectNodeView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !wallet) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch(`/api/projects?viewer=${wallet}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Failed to load projects');
          setProjects([]);
        } else {
          setProjects(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load projects');
          setProjects([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, wallet, authenticatedFetch]);

  if (isLoading) {
    return (
      <div className="py-10 max-w-5xl mx-auto px-4 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">Connect your wallet to see your projects.</p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  return (
    <div className="py-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100">Projects</h1>
          <p className="mt-1 text-secondary-600 dark:text-secondary-400">
            Funded pots that pay your team on verified completion
          </p>
        </div>
        <Link href="/projects/create">
          <Button>New project</Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {projects === null ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-secondary-300 dark:border-secondary-700 rounded-lg">
          <p className="text-secondary-600 dark:text-secondary-400 mb-4">You have no projects yet.</p>
          <Link href="/projects/create">
            <Button>Create your first project</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.groupId}>
              <button
                onClick={() => router.push(`/projects/${p.groupId}`)}
                className="w-full text-left rounded-lg border border-secondary-200 dark:border-secondary-700 hover:border-secondary-400 dark:hover:border-secondary-500 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900 dark:text-secondary-100 truncate">
                      {p.description || 'Untitled project'}
                    </p>
                    <p className="text-sm text-secondary-500 mt-1">
                      {symbol} {p.amount.toFixed(2)} · {p.recipients.length} recipient
                      {p.recipients.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={p.chainState?.status ?? null} />
                    <RoleBadges roles={p.viewerRoles} />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
