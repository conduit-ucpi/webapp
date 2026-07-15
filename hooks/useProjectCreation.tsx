import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { ProjectDraft, ProjectTreeView } from '@/types/projects';

export type CreationStage = 'idle' | 'creating' | 'deploying' | 'approving' | 'funding' | 'done' | 'error';

export interface CreationState {
  stage: CreationStage;
  groupId: string | null;
  rootAddress: string | null;
  error: string | null;
}

interface DeployParams {
  tokenAddress: string;
  chainId: string;
  buyerAddress: string;
  tokenDecimals: number;
  /** Total deposit (incl. fee) in base units, for approve + fund. */
  amountBaseUnits: string;
}

/**
 * Drives the buyer's create-and-fund sequence for a project. Each step is
 * resumable: on failure the state names the stage reached so the caller can
 * retry from there (a deployed-but-unfunded project shows "Fund now").
 *
 * Steps: create off-chain record -> deploy tree on-chain (relayer) ->
 * wallet approve USDC to the root escrow -> proxy deposit (relayer funds).
 * The client only signs the approval; everything else is server/relayer.
 */
export function useProjectCreation() {
  const { authenticatedFetch } = useAuth();
  const { approveUSDC } = useSimpleEthers();
  const [state, setState] = useState<CreationState>({
    stage: 'idle',
    groupId: null,
    rootAddress: null,
    error: null,
  });

  const reset = () =>
    setState({ stage: 'idle', groupId: null, rootAddress: null, error: null });

  async function createRecord(draft: ProjectDraft): Promise<string> {
    setState((s) => ({ ...s, stage: 'creating', error: null }));
    const res = await authenticatedFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');
    const groupId: string = data.groupId;
    setState((s) => ({ ...s, groupId }));
    return groupId;
  }

  async function deploy(groupId: string, params: DeployParams): Promise<ProjectTreeView> {
    setState((s) => ({ ...s, stage: 'deploying' }));
    const res = await authenticatedFetch(`/api/projects/${groupId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenAddress: params.tokenAddress,
        chainId: params.chainId,
        buyerAddress: params.buyerAddress,
        tokenDecimals: params.tokenDecimals,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to deploy project');
    const root = (data.nodes || []).find((n: { depth: number }) => n.depth === 0);
    const rootAddress: string | null = root?.chainAddress ?? null;
    if (!rootAddress) throw new Error('Deploy did not return a root contract address');
    setState((s) => ({ ...s, rootAddress }));
    return data;
  }

  async function fund(rootAddress: string, params: DeployParams): Promise<void> {
    // Buyer signs the ERC-20 approval to the escrow contract (only wallet step).
    setState((s) => ({ ...s, stage: 'approving' }));
    await approveUSDC(rootAddress, params.amountBaseUnits, params.tokenAddress);

    // Relayer performs the actual deposit (proxy) and pays gas.
    setState((s) => ({ ...s, stage: 'funding' }));
    const res = await authenticatedFetch('/api/projects/chain/fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractHash: rootAddress }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Failed to fund project');
    }
    setState((s) => ({ ...s, stage: 'done' }));
  }

  /** Full sequence. Returns the groupId on success. */
  async function createAndFund(draft: ProjectDraft, params: DeployParams): Promise<string> {
    try {
      const groupId = state.groupId ?? (await createRecord(draft));
      const rootAddress =
        state.rootAddress ?? (await deploy(groupId, params)).nodes.find((n) => n.depth === 0)!.chainAddress!;
      await fund(rootAddress, params);
      return groupId;
    } catch (e) {
      setState((s) => ({ ...s, stage: 'error', error: e instanceof Error ? e.message : 'Unknown error' }));
      throw e;
    }
  }

  return { state, createAndFund, reset };
}
