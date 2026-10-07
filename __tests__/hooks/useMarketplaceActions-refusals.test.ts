/**
 * A refused nomination arrives from the RPC as "execution reverted" plus a custom error's bytes.
 * The hook decodes those bytes so the screen can say why, and who it would have come from.
 */

import { renderHook } from '@testing-library/react';
import { ethers } from 'ethers';
import { EstimationRevertedError } from '@/lib/web3';

const fundAndSendTransaction = jest.fn();
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({ getWeb3Service: async () => ({ fundAndSendTransaction }) })
}));

import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';

const ESCROW = '0xa46c6c37956414bad8c40d8972ef0f59da35a2a5';
const SENDER = '0xa123f4464044115fda6d642cabab5702d39e019c';
const errors = new ethers.Interface([
  'error InvalidArbiterCandidate(address candidate)',
  'error NotDisputeParty(address caller)',
  'error NotFundedOrAlreadyProcessed()'
]);

const refusedWith = async (data: string | undefined) => {
  fundAndSendTransaction.mockRejectedValueOnce(new EstimationRevertedError('execution reverted', data, SENDER));
  const { result } = renderHook(() => useMarketplaceActions());
  return result.current.nominateArbiter(ESCROW, '0x1111111111111111111111111111111111111111').catch((e) => e);
};

describe('a refused nomination says why', () => {
  it('decodes NotDisputeParty with the wallet it would have come from', async () => {
    // Production, 2026-10-07: these exact bytes, from a browser signed in with a non-party wallet.
    const e = await refusedWith('0x7cd4fccf000000000000000000000000a123f4464044115fda6d642cabab5702d39e019c');

    expect(e.name).toBe('ContractRefusedError');
    expect(e.reason).toEqual({ name: 'NotDisputeParty', args: [ethers.getAddress(SENDER)] });
    expect(e.from).toBe(SENDER);
  });

  it('decodes InvalidArbiterCandidate and NotFundedOrAlreadyProcessed', async () => {
    const seller = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
    expect((await refusedWith(errors.encodeErrorResult('InvalidArbiterCandidate', [seller]))).reason)
      .toEqual({ name: 'InvalidArbiterCandidate', args: [seller] });
    expect((await refusedWith(errors.encodeErrorResult('NotFundedOrAlreadyProcessed', []))).reason)
      .toEqual({ name: 'NotFundedOrAlreadyProcessed', args: [] });
  });

  it('keeps the RPC message when the bytes are not one of ours, or absent', async () => {
    for (const data of ['0xdeadbeef', undefined]) {
      const e = await refusedWith(data);
      expect(e.name).toBe('ContractRefusedError');
      expect(e.reason).toBeNull();
      expect(e.message).toBe('execution reverted');
    }
  });

  it('passes any other failure through untouched', async () => {
    const boom = new Error('user rejected the request');
    fundAndSendTransaction.mockRejectedValueOnce(boom);
    const { result } = renderHook(() => useMarketplaceActions());

    await expect(result.current.nominateArbiter(ESCROW, SENDER)).rejects.toBe(boom);
  });
});
