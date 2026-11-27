/**
 * Collecting a payment asks nothing of the seller's wallet: the relayer sends the claim. No gas
 * is handed over, so there is none to keep.
 */

import { claimFundsViaRelayer } from '@/lib/claimFunds';

const CONTRACT = '0x9a4264B3173FA692bDd159cB226e4ae491e2989c';
const answer = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe('collecting a payment through the relayer', () => {
  it('asks the relayer endpoint for that contract and resolves with the transaction', async () => {
    const post = jest.fn().mockResolvedValue(answer(200, { success: true, transactionHash: '0xabc' }));

    await expect(claimFundsViaRelayer(CONTRACT, post)).resolves.toBe('0xabc');

    expect(post).toHaveBeenCalledTimes(1);
    const [url, init] = post.mock.calls[0];
    expect(url).toBe('/api/chain/claim-funds-as-gas-payer');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ contractAddress: CONTRACT });
  });

  it('never asks for gas', async () => {
    const post = jest.fn().mockResolvedValue(answer(200, { success: true, transactionHash: '0xabc' }));
    await claimFundsViaRelayer(CONTRACT, post);
    expect(post.mock.calls.map(([url]) => url)).not.toContain('/api/chain/fund-wallet');
  });

  it("fails with chainservice's reason when the claim did not go through", async () => {
    const post = jest.fn().mockResolvedValue(answer(400, { success: false, transactionHash: null, error: 'Claim funds transaction failed' }));
    await expect(claimFundsViaRelayer(CONTRACT, post)).rejects.toThrow('Claim funds transaction failed');
  });

  it.each([
    ['a 200 that says it failed', answer(200, { success: false })],
    ['a 200 with no transaction', answer(200, { success: true })],
    ['an answer that is not JSON', { ok: false, status: 502, json: async () => { throw new Error('not json'); } } as unknown as Response]
  ])('treats %s as not collected', async (_what, response) => {
    const post = jest.fn().mockResolvedValue(response);
    await expect(claimFundsViaRelayer(CONTRACT, post)).rejects.toThrow(/could not be collected/);
  });

  it('refuses to ask without a contract', async () => {
    const post = jest.fn();
    await expect(claimFundsViaRelayer('', post)).rejects.toThrow('Contract address is required');
    expect(post).not.toHaveBeenCalled();
  });
});
