import { useState } from 'react';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

/**
 * Lifecycle actions on a project node's escrow. Each encodes the
 * CompletionEscrowContract call and sends it from the acting party's wallet
 * (gas sponsored by the relayer via Web3Service) — signing is the one step
 * that must happen in the browser. Role enforcement is on-chain.
 */
const ESCROW_ABI = [
  'function markComplete() external',
  'function verifyComplete() external',
  'function raiseDispute() external',
];

export type ProjectAction = 'markComplete' | 'verifyComplete' | 'raiseDispute';

export function useProjectActions() {
  const { fundAndSendTransaction } = useSimpleEthers();
  const [pending, setPending] = useState<ProjectAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: ProjectAction, contractAddress: string): Promise<string> {
    setPending(action);
    setError(null);
    try {
      const { ethers } = await import('ethers');
      const iface = new ethers.Interface(ESCROW_ABI);
      const data = iface.encodeFunctionData(action, []);
      const txHash = await fundAndSendTransaction({ to: contractAddress, data, value: '0' });
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : `Failed to ${action}`;
      setError(message);
      throw new Error(message);
    } finally {
      setPending(null);
    }
  }

  return {
    pending,
    error,
    markComplete: (address: string) => run('markComplete', address),
    verifyComplete: (address: string) => run('verifyComplete', address),
    raiseDispute: (address: string) => run('raiseDispute', address),
  };
}
