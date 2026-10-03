import { ethers } from 'ethers';

const escrowInterface = new ethers.Interface([
  'function raiseDispute() external',
  'function submitResolutionVote(uint256 _buyerPercentage) external',
]);

export interface DisputeEntry {
  timestamp: number;
  reason: string;
  refundPercent: number;
}

export interface RaiseDisputeDeps {
  /** Sends one transaction from the buyer's own wallet and resolves with its hash. */
  send: (tx: { to: string; data: string; value: string }) => Promise<string>;
  /** Records the entry with contractservice. A failure here never undoes what is on-chain. */
  record: (contractId: string, entry: DisputeEntry) => Promise<void>;
}

/**
 * Raise a dispute, then put the buyer's figure on-chain as their vote.
 *
 * raiseDispute() takes no arguments, so the figure the buyer enters has to be sent separately as
 * submitResolutionVote, exactly as every later figure is on the dispute screen. Without it the
 * figure would exist only in contractservice's record, and a seller voting the same number would
 * settle nothing.
 *
 * Votes are whole numbers, so the figure is rounded and the rounded figure is what is recorded.
 * If the vote does not land the dispute is still raised and recorded, and the caller is told, in
 * terms the buyer can act on, that their vote is not in.
 */
export async function raiseDisputeAndVote(
  deps: RaiseDisputeDeps,
  params: { contractAddress: string; reason: string; refundPercent: number; contractId?: string }
): Promise<string> {
  const txHash = await deps.send({
    to: params.contractAddress,
    data: escrowInterface.encodeFunctionData('raiseDispute', []),
    value: '0',
  });

  const figure = Math.round(params.refundPercent);
  let voteFailed = false;
  try {
    await deps.send({
      to: params.contractAddress,
      data: escrowInterface.encodeFunctionData('submitResolutionVote', [figure]),
      value: '0',
    });
  } catch (error) {
    console.error('Dispute raised, but the vote did not land:', error);
    voteFailed = true;
  }

  if (params.contractId) {
    await deps.record(params.contractId, {
      timestamp: Math.floor(Date.now() / 1000),
      reason: params.reason || 'Dispute raised on blockchain',
      refundPercent: figure,
    });
  }

  if (voteFailed) {
    throw new Error(
      `Your dispute was raised, but your figure of ${figure}% was not submitted as your vote. Open Manage Dispute to submit it.`
    );
  }
  return txHash;
}
