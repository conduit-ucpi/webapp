import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import ProjectDetail from '@/components/projects/ProjectDetail';
import { ProjectTreeView } from '@/types/projects';

export default function ProjectDetailPage() {
  const router = useRouter();
  const { groupId } = router.query;
  const { isLoading, isConnected, address, user, authenticatedFetch } = useAuth();
  const wallet = user?.walletAddress || address || '';

  const [tree, setTree] = useState<ProjectTreeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (typeof groupId !== 'string' || !wallet) return;
    try {
      const res = await authenticatedFetch(`/api/projects/${groupId}?viewer=${wallet}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load project');
        return;
      }
      setError(null);
      setTree(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    }
  }, [groupId, wallet, authenticatedFetch]);

  useEffect(() => {
    if (isConnected && wallet) load();
  }, [isConnected, wallet, load]);

  if (isLoading) {
    return (
      <div className="py-10 max-w-4xl mx-auto px-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 mb-4">Connect Your Wallet</h1>
        <p className="text-secondary-600 mb-6">Connect your wallet to view this project.</p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Link href="/projects">
          <Button variant="outline">Back to projects</Button>
        </Link>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="py-10 max-w-4xl mx-auto px-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/projects" className="text-sm text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300">
          ← All projects
        </Link>
      </div>
      <ProjectDetail tree={tree} onRefresh={load} />
    </div>
  );
}
