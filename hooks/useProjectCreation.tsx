import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { ProjectDraft } from '@/types/projects';

export type CreationStage = 'idle' | 'creating' | 'done' | 'error';

export interface CreationState {
  stage: CreationStage;
  groupId: string | null;
  error: string | null;
}

/** When present, the record is created as a subcontract of an existing tree. */
export interface SubcontractContext {
  parentGroupId: string;
  parentNodeId: string;
  sliceIndex: number;
}

/**
 * Saves a project draft to contractfanoutservice. Creation is off-chain ONLY:
 * the tree is a record that can be reviewed (and later edited) before any
 * money or gas is committed. Deploying the escrows and funding them are
 * separate, explicit steps taken from the project's own page.
 */
export function useProjectCreation() {
  const { authenticatedFetch } = useAuth();
  const [state, setState] = useState<CreationState>({ stage: 'idle', groupId: null, error: null });

  const reset = () => setState({ stage: 'idle', groupId: null, error: null });

  /** Persist the draft; returns the new tree's groupId. */
  async function createDraft(draft: ProjectDraft, subcontract?: SubcontractContext): Promise<string> {
    // Reuse the id if a previous attempt already saved (retry after a failure).
    if (state.groupId) return state.groupId;
    setState((s) => ({ ...s, stage: 'creating', error: null }));
    try {
      const url = subcontract
        ? `/api/projects/${subcontract.parentGroupId}/subcontract`
        : '/api/projects';
      const body = subcontract
        ? { parentNodeId: subcontract.parentNodeId, sliceIndex: subcontract.sliceIndex, draft }
        : draft;
      const res = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save project');
      const groupId: string = data.groupId;
      setState({ stage: 'done', groupId, error: null });
      return groupId;
    } catch (e) {
      setState((s) => ({ ...s, stage: 'error', error: e instanceof Error ? e.message : 'Unknown error' }));
      throw e;
    }
  }

  return { state, createDraft, reset };
}
