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
    expect(sent[0]).toEqual({ to: '0xEscrow', data: escrow.encodeFunctionData('raiseDispute', []), value: '0', movesFunds: false });
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

  it("words the wallet's own screen at each step, the second from the figure actually voted", async () => {
    const { d, sent } = deps();
    await raiseDisputeAndVote(d, {
      contractAddress: '0xEscrow',
      reason: 'Half broken',
      refundPercent: 59.6,
      prompts: { open: 'Step 1 of 2: open a dispute', vote: (figure) => `Step 2 of 2: ${figure}% to you, ${100 - figure}% to the seller` },
    });

    expect(sent[0]).toMatchObject({ walletDescription: 'Step 1 of 2: open a dispute' });
    // 59.6 is voted as 60, so 60 is what the screen says.
    expect(sent[1]).toMatchObject({ walletDescription: 'Step 2 of 2: 60% to you, 40% to the seller' });
  });

  it('says opening a dispute moves nothing, and leaves the vote as something that can', async () => {
    const { d, sent } = deps();
    await raiseDisputeAndVote(d, { contractAddress: '0xEscrow', reason: 'x', refundPercent: 50 });

    expect((sent[0] as any).movesFunds).toBe(false);
    // A vote matching one already cast pays the payment out.
    expect((sent[1] as any).movesFunds).toBeUndefined();
  });
});

/**
 * On a contract that takes signed messages the wallet signs and chainservice delivers. The
 * dispute is recorded by chainservice, which raised it; the page records it only when
 * chainservice says it could not.
 */
describe('raiseDisputeAndVote, by signed message', () => {
  const params = { contractAddress: '0xEscrow', reason: 'Never arrived', refundPercent: 49.6, contractId: 'c1' };

  function signedDeps(options: { raise?: any; vote?: any } = {}) {
    const send = jest.fn(async (_tx: any) => '0xsent');
    const record = jest.fn(async (_contractId: string, _entry: any) => {});
    const raise = jest.fn(async () => ('raise' in options ? options.raise : { transactionHash: '0xsigned', recorded: true }));
    const vote = jest.fn(async () => ('vote' in options ? options.vote : '0xvoted'));
    return { d: { send, record, signed: { raise, vote } } as RaiseDisputeDeps, send, record, raise, vote };
  }

  it('signs the dispute and the vote, sends no transaction, and leaves the record to chainservice', async () => {
    const { d, send, record, raise, vote } = signedDeps();

    await expect(raiseDisputeAndVote(d, params)).resolves.toBe('0xsigned');

    expect(raise).toHaveBeenCalledWith(expect.objectContaining({
      contractAddress: '0xEscrow',
      data: escrow.encodeFunctionData('raiseDispute', []),
      reason: 'Never arrived',
      refundPercent: 50,
      contractId: 'c1'
    }));
    expect(vote).toHaveBeenCalledWith(expect.objectContaining({
      contractAddress: '0xEscrow',
      data: escrow.encodeFunctionData('submitResolutionVote', [50]),
      figure: 50
    }));
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('records the dispute itself when chainservice raised it but could not record it', async () => {
    const { d, record } = signedDeps({ raise: { transactionHash: '0xsigned', recorded: false } });
    await raiseDisputeAndVote(d, params);
    expect(record).toHaveBeenCalledWith('c1', expect.objectContaining({ reason: 'Never arrived', refundPercent: 50 }));
  });

  it('records it too when chainservice was told of no record to write', async () => {
    const { d, record } = signedDeps({ raise: { transactionHash: '0xsigned', recorded: null } });
    await raiseDisputeAndVote(d, params);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('falls back to the wallet sending both, and recording, on a contract without the signed route', async () => {
    const { d, send, record } = signedDeps({ raise: null, vote: null });

    await expect(raiseDisputeAndVote(d, params)).resolves.toBe('0xsent');

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ data: escrow.encodeFunctionData('raiseDispute', []), movesFunds: false });
    expect(send.mock.calls[1][0]).toMatchObject({ data: escrow.encodeFunctionData('submitResolutionVote', [50]) });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('never votes, and records nothing, if the signed dispute was refused', async () => {
    const { d, send, record, vote } = signedDeps();
    (d.signed!.raise as jest.Mock).mockRejectedValue(new Error('Only the buyer can do that.'));

    await expect(raiseDisputeAndVote(d, params)).rejects.toThrow('Only the buyer can do that.');
    expect(vote).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('when the signed vote fails the dispute still stands, and the buyer is told their vote is not in', async () => {
    const { d, record } = signedDeps();
    (d.signed!.vote as jest.Mock).mockRejectedValue(new Error('User rejected the request'));

    await expect(raiseDisputeAndVote(d, params)).rejects.toThrow(/your figure of 50% was not submitted/);
    expect(record).not.toHaveBeenCalled(); // chainservice already recorded the dispute
  });
});
