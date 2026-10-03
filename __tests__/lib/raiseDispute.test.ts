import { ethers } from 'ethers';
import { raiseDisputeAndVote, RaiseDisputeDeps } from '@/lib/raiseDispute';

const escrow = new ethers.Interface([
  'function raiseDispute() external',
  'function submitResolutionVote(uint256 _buyerPercentage) external',
]);

function deps(failVote = false) {
  const sent: { to: string; data: string; value: string }[] = [];
  const recorded: { contractId: string; entry: any }[] = [];
  const d: RaiseDisputeDeps = {
    send: jest.fn(async (tx) => {
      sent.push(tx);
      if (failVote && sent.length === 2) throw new Error('user rejected');
      return `0xhash${sent.length}`;
    }),
    record: jest.fn(async (contractId, entry) => {
      recorded.push({ contractId, entry });
    }),
  };
  return { d, sent, recorded };
}

/**
 * Raising a dispute must put the buyer's figure on-chain as their vote. raiseDispute() takes no
 * arguments, so a figure that only reaches contractservice is not a vote, and a seller voting the
 * same number would settle nothing.
 */
describe('raiseDisputeAndVote', () => {
  it('raises the dispute, then casts the figure as the buyer\'s vote, then records it', async () => {
    const { d, sent, recorded } = deps();
    const hash = await raiseDisputeAndVote(d, { contractAddress: '0xEscrow', reason: 'Never arrived', refundPercent: 100, contractId: 'c1' });

    expect(hash).toBe('0xhash1');
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual({ to: '0xEscrow', data: escrow.encodeFunctionData('raiseDispute', []), value: '0' });
    expect(sent[1]).toEqual({ to: '0xEscrow', data: escrow.encodeFunctionData('submitResolutionVote', [100]), value: '0' });
    expect(recorded).toEqual([{ contractId: 'c1', entry: expect.objectContaining({ reason: 'Never arrived', refundPercent: 100 }) }]);
  });

  it('votes and records a whole number, because the contract only takes whole numbers', async () => {
    const { d, sent, recorded } = deps();
    await raiseDisputeAndVote(d, { contractAddress: '0xEscrow', reason: 'Half broken', refundPercent: 49.6, contractId: 'c1' });

    expect(Number(escrow.decodeFunctionData('submitResolutionVote', sent[1].data)[0])).toBe(50);
    expect(recorded[0].entry.refundPercent).toBe(50);
  });

  it('never votes if the dispute itself was not raised', async () => {
    const send = jest.fn().mockRejectedValue(new Error('reverted'));
    const record = jest.fn();
    await expect(raiseDisputeAndVote({ send, record }, { contractAddress: '0xEscrow', reason: 'x', refundPercent: 10, contractId: 'c1' }))
      .rejects.toThrow('reverted');
    expect(send).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it('when the vote fails, still records the raised dispute and tells the buyer their vote is not in', async () => {
    const { d, recorded } = deps(true);
    await expect(raiseDisputeAndVote(d, { contractAddress: '0xEscrow', reason: 'Never arrived', refundPercent: 100, contractId: 'c1' }))
      .rejects.toThrow('Your dispute was raised, but your figure of 100% was not submitted as your vote. Open Manage Dispute to submit it.');
    expect(recorded).toHaveLength(1);
  });

  it('records nothing without a contract id, but still votes', async () => {
    const { d, sent, recorded } = deps();
    await raiseDisputeAndVote(d, { contractAddress: '0xEscrow', reason: 'x', refundPercent: 0 });
    expect(sent).toHaveLength(2);
    expect(recorded).toHaveLength(0);
  });
});
