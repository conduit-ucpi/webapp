/**
 * A party's action on the payment contract goes as a signed message when the contract takes one,
 * and by fund-then-send when it does not. Offer-vault and token calls are never signed for.
 */

import { renderHook } from '@testing-library/react';
import { ethers } from 'ethers';
import { EstimationRevertedError } from '@/lib/web3';

const fundAndSendTransaction = jest.fn();
const simulateCall = jest.fn();
const signTypedData = jest.fn();
const getUserAddress = jest.fn();
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    getWeb3Service: async () => ({ fundAndSendTransaction, simulateCall, signTypedData, getUserAddress })
  })
}));

const apiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));

import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import { forgetSignedCallSupport } from '@/lib/signedActions';

const ESCROW = '0xa46c6c37956414bad8c40d8972ef0f59da35a2a5';
const VAULT = '0x66a7000000000000000000000000000000cb56ab';
const USER = '0xa123f4464044115fda6d642cabab5702d39e019c';
const CANDIDATE = '0x1111111111111111111111111111111111111111';
const DOMAIN = { name: 'Stabledrop', version: '1', chainId: 8453, verifyingContract: ESCROW };

const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function chain(supported: boolean) {
  apiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/signed-calls')) return json(200, supported ? { supported: true, domain: DOMAIN } : { supported: false });
    if (init?.method === 'POST' && url.startsWith('/api/chain/signed/')) return json(200, { success: true, transactionHash: '0xdelivered' });
    return json(404, {});
  });
}

const posts = () => apiFetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

describe('party actions on the payment contract', () => {
  beforeEach(() => {
    [fundAndSendTransaction, simulateCall, signTypedData, getUserAddress, apiFetch].forEach(mock => mock.mockReset());
    forgetSignedCallSupport();
    getUserAddress.mockResolvedValue(USER);
    signTypedData.mockResolvedValue('0x' + 'ab'.repeat(65));
    fundAndSendTransaction.mockResolvedValue('0xsent');
  });

  it('a vote on a contract that takes signed messages is signed and delivered, and no gas is asked for', async () => {
    chain(true);
    const { result } = renderHook(() => useMarketplaceActions());

    await expect(result.current.submitSettlementVote(ESCROW, 29.6, { walletDescription: 'Offer 30%' })).resolves.toBe('0xdelivered');

    expect(fundAndSendTransaction).not.toHaveBeenCalled();
    expect(signTypedData.mock.calls[0][0].primaryType).toBe('Vote');
    expect(signTypedData.mock.calls[0][0].message.refundToBuyerPercent).toBe(30);
    expect(signTypedData.mock.calls[0][1]).toEqual({ walletDescription: 'Offer 30%' });
    expect(posts()).toEqual([
      { url: '/api/chain/signed/submit-resolution-vote', body: expect.objectContaining({ contractAddress: ESCROW, signer: USER, refundToBuyerPercent: 30 }) }
    ]);
  });

  it('nominating, evicting and resigning go the same way', async () => {
    chain(true);
    const { result } = renderHook(() => useMarketplaceActions());

    await result.current.nominateArbiter(ESCROW, CANDIDATE);
    await result.current.evictArbiter(ESCROW);
    await result.current.resignArbiter(ESCROW);

    expect(posts().map(post => post.url)).toEqual([
      '/api/chain/signed/nominate-arbiter',
      '/api/chain/signed/evict-arbiter',
      '/api/chain/signed/resign-arbiter'
    ]);
    expect(posts()[0].body.candidate).toBe(CANDIDATE);
    expect(fundAndSendTransaction).not.toHaveBeenCalled();
  });

  it('on a contract without the signed route the wallet sends it, as before', async () => {
    chain(false);
    const { result } = renderHook(() => useMarketplaceActions());

    await expect(result.current.submitSettlementVote(ESCROW, 30)).resolves.toBe('0xsent');

    expect(signTypedData).not.toHaveBeenCalled();
    expect(fundAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(fundAndSendTransaction.mock.calls[0][0].to).toBe(ESCROW);
  });

  it('when the check cannot be made, the wallet sends it, as before', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMarketplaceActions());

    await expect(result.current.evictArbiter(ESCROW)).resolves.toBe('0xsent');
    expect(fundAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('a refusal found before signing still says why, and nothing is signed', async () => {
    chain(true);
    const errors = new ethers.Interface(['error NotDisputeParty(address caller)']);
    simulateCall.mockRejectedValue(
      new EstimationRevertedError('execution reverted', errors.encodeErrorResult('NotDisputeParty', [USER]), USER)
    );
    const { result } = renderHook(() => useMarketplaceActions());

    const error: any = await result.current.nominateArbiter(ESCROW, CANDIDATE).catch(e => e);

    expect(error.name).toBe('ContractRefusedError');
    expect(error.reason).toEqual({ name: 'NotDisputeParty', args: [ethers.getAddress(USER)] });
    expect(signTypedData).not.toHaveBeenCalled();
    expect(fundAndSendTransaction).not.toHaveBeenCalled();
  });

  it("chainservice's refusal is reported, and the wallet is not then asked to send it instead", async () => {
    chain(true);
    apiFetch.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/signed-calls')
        ? json(200, { supported: true, domain: DOMAIN })
        : json(400, { success: false, transactionHash: null, error: 'There is no open dispute on this contract.' })
    );
    const { result } = renderHook(() => useMarketplaceActions());

    await expect(result.current.evictArbiter(ESCROW)).rejects.toThrow('There is no open dispute on this contract.');
    expect(fundAndSendTransaction).not.toHaveBeenCalled();
  });

  it('an offer-vault action is never signed for: the vault has no signed route', async () => {
    chain(true);
    const { result } = renderHook(() => useMarketplaceActions());

    await result.current.acceptOffer(VAULT);

    expect(apiFetch).not.toHaveBeenCalled();
    expect(signTypedData).not.toHaveBeenCalled();
    expect(fundAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(fundAndSendTransaction.mock.calls[0][0].to).toBe(VAULT);
  });
});
