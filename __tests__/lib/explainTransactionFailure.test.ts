/**
 * The dispute screens' failures in words: the gas cost cap, and the escrow's refusals of a vote.
 */

import { explainTransactionFailure } from '@/lib/explainTransactionFailure';
import { ContractRefusedError } from '@/hooks/useMarketplaceActions';
import { GasCostCapError } from '@/lib/web3';
import { interpolate } from '@/i18n/interpolate';
import { en } from '@/i18n/messages/en';

const t = (key: string, vars?: Record<string, string | number>) => interpolate((en as any)[key] ?? key, vars);
const WRONG = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';

const refused = (name: string | null, from?: string) =>
  new ContractRefusedError('execution reverted', name ? { name, args: [] } : null, from);

describe('explainTransactionFailure', () => {
  it('names the wallet a refused vote would have come from, and what to do', () => {
    const text = explainTransactionFailure(refused('NotAuthorizedToVote', WRONG), t as any)!;

    expect(text).toContain(WRONG);
    expect(text).toMatch(/not the buyer, the seller or the tiebreaker/);
    expect(text).toMatch(/Sign out, sign back in/);
    expect(text).toMatch(/Nothing was sent/);
  });

  it('says a vote has nothing left to vote on once the dispute is over', () => {
    for (const name of ['ContractMustBeDisputed', 'ConsensusAlreadyReached']) {
      expect(explainTransactionFailure(refused(name), t as any)).toMatch(/not in dispute any more/);
    }
  });

  it('explains a figure out of range', () => {
    expect(explainTransactionFailure(refused('InvalidPercentage'), t as any)).toMatch(/0 to 100/);
  });

  it('gives the gas cap in ETH both ways round, and says nothing was charged', () => {
    // The production vote: 240,768 gas at 0.078876 gwei, against the 14,800 gwei cap.
    const e = new GasCostCapError('over', BigInt(240768) * BigInt(78876000), BigInt(14800) * BigInt(1000000000));

    const text = explainTransactionFailure(e, t as any)!;

    expect(text).toContain('0.000019 ETH');
    expect(text).toContain('0.000015 ETH');
    expect(text).toMatch(/nothing was charged/);
  });

  it('leaves everything else to the caller', () => {
    expect(explainTransactionFailure(refused(null), t as any)).toBeNull();
    expect(explainTransactionFailure(refused('NotDisputeParty', WRONG), t as any)).toBeNull();
    expect(explainTransactionFailure(new Error('user rejected the request'), t as any)).toBeNull();
    expect(explainTransactionFailure('nope', t as any)).toBeNull();
  });
});
