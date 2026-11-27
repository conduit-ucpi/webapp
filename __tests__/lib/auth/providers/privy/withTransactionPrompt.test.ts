/**
 * Privy's own prompt for an approval says "…permission for 0x… to spend tokens on your behalf".
 * A transaction that carries its own description is sent through Privy's sendTransaction so the
 * prompt says that instead; every other request reaches the provider exactly as before.
 */
jest.mock('@privy-io/react-auth', () => ({}));

import { withTransactionPrompt } from '@/lib/auth/providers/privy/PrivyHost';
import { getWalletPrompt, subscribeWalletPrompt, withWalletPrompt, type WalletPrompt } from '@/lib/auth/walletPromptChannel';

const ADDRESS = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
const TX = {
  from: ADDRESS,
  to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  data: '0x095ea7b3',
  value: '0x0',
  gas: '0x1d4c0',
  maxFeePerGas: '0x6acfc0',
  nonce: '0x7',
};
const SAYS = 'Allow up to 20.1 USDC to be converted into USDT for this payment. Nothing is spent at this step.';

function setup() {
  const provider = { request: jest.fn().mockResolvedValue('0xfrom-provider'), on: jest.fn() };
  const sendTransaction = jest.fn().mockResolvedValue({ hash: '0xfrom-privy' });
  const wrapped = withTransactionPrompt(provider as never, sendTransaction, ADDRESS);
  return { provider, sendTransaction, wrapped };
}
const send = (wrapped: { request: (args: any) => Promise<any> }) =>
  wrapped.request({ method: 'eth_sendTransaction', params: [TX] });

describe('withTransactionPrompt', () => {
  it('sends a described transaction through Privy with that description, and returns its hash', async () => {
    const { provider, sendTransaction, wrapped } = setup();

    const hash = await withWalletPrompt({ kind: 'transaction', summary: 'allowing…', walletDescription: SAYS }, () => send(wrapped));

    expect(hash).toBe('0xfrom-privy');
    expect(provider.request).not.toHaveBeenCalled();
    const [tx, options] = sendTransaction.mock.calls[0];
    expect(options).toEqual({ address: ADDRESS, uiOptions: { description: SAYS } });
    // The same transaction, with the gas limit under the name Privy reads it by.
    const { gas, ...rest } = TX;
    expect(tx).toEqual({ ...rest, gasLimit: gas });
  });

  it('leaves a transaction with no description of its own to the provider, untouched', async () => {
    const { provider, sendTransaction, wrapped } = setup();

    const hash = await withWalletPrompt({ kind: 'transaction', summary: 'sending 10.0 USDC' }, () => send(wrapped));

    expect(hash).toBe('0xfrom-provider');
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_sendTransaction', params: [TX] });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('leaves a transaction sent outside any prompt to the provider', async () => {
    const { provider, sendTransaction, wrapped } = setup();
    await send(wrapped);
    expect(provider.request).toHaveBeenCalledTimes(1);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('never reroutes anything but a transaction, even while a described one is open', async () => {
    const { provider, sendTransaction, wrapped } = setup();

    await withWalletPrompt({ kind: 'transaction', summary: 's', walletDescription: SAYS }, () =>
      wrapped.request({ method: 'eth_chainId', params: [] })
    );

    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_chainId', params: [] });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('passes a refusal in the wallet back to the caller', async () => {
    const { sendTransaction, wrapped } = setup();
    sendTransaction.mockRejectedValueOnce(new Error('User rejected the request'));

    await expect(
      withWalletPrompt({ kind: 'transaction', summary: 's', walletDescription: SAYS }, () => send(wrapped))
    ).rejects.toThrow('User rejected the request');
  });

  it('keeps the rest of the provider working', () => {
    const { provider, wrapped } = setup();
    (wrapped as any).on('accountsChanged', () => {});
    expect(provider.on).toHaveBeenCalled();
  });

  describe('our own notice', () => {
    const during = async (prompt: WalletPrompt, method = 'eth_sendTransaction') => {
      const { sendTransaction, provider, wrapped } = setup();
      let seen: WalletPrompt | null = null;
      const look = async () => {
        seen = getWalletPrompt();
        return { hash: '0xfrom-privy' };
      };
      sendTransaction.mockImplementation(look);
      provider.request.mockImplementation(look);
      await withWalletPrompt(prompt, () => wrapped.request({ method, params: [TX] }));
      return seen as WalletPrompt | null;
    };

    it("is told to stand down while Privy's screen says the sentence", async () => {
      const seen = await during({ kind: 'transaction', summary: 's', walletDescription: SAYS });
      expect(seen).toMatchObject({ saidByWallet: true });
    });

    it('stays for a transaction Privy describes in its own words', async () => {
      const seen = await during({ kind: 'transaction', summary: 'sending 10.0 USDC to 0x7b0e…F51B' });
      expect(seen).not.toHaveProperty('saidByWallet');
    });

    it('tells whoever is showing the notice, and clears when the wallet is done', async () => {
      const heard: Array<WalletPrompt | null> = [];
      const stop = subscribeWalletPrompt((prompt) => heard.push(prompt));
      await during({ kind: 'transaction', summary: 's', walletDescription: SAYS });
      stop();
      expect(heard.map((prompt) => (prompt?.kind === 'transaction' ? !!prompt.saidByWallet : prompt))).toEqual([false, true, null]);
    });
  });

  /**
   * The nonce and the gas are worked out for `from`. Signed by any other wallet, the transaction
   * is accepted and never confirms, and the page waits minutes for it (dev, 11 Nov 2026: built for
   * 0xc9D0… at nonce 460, signed by the embedded wallet 0x78A6…, whose nonce was 14).
   */
  describe('a transaction built for a different address than this wallet', () => {
    const OTHER = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
    const built = { method: 'eth_sendTransaction', params: [TX] };

    it('is refused at once, with or without a description, and nothing reaches the wallet', async () => {
      const provider = { request: jest.fn().mockResolvedValue('0xhash'), on: jest.fn() };
      const sendTransaction = jest.fn().mockResolvedValue({ hash: '0xhash' });
      const wrapped = withTransactionPrompt(provider as never, sendTransaction, OTHER);

      await expect(wrapped.request(built)).rejects.toThrow('Nothing was sent');
      await expect(
        withWalletPrompt({ kind: 'transaction', summary: 's', walletDescription: SAYS }, () => wrapped.request(built))
      ).rejects.toThrow('Nothing was sent');

      expect(provider.request).not.toHaveBeenCalled();
      expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('is not mistaken for one when only the case of the address differs', async () => {
      const { provider, wrapped } = setup();
      await wrapped.request({ method: 'eth_sendTransaction', params: [{ ...TX, from: ADDRESS.toLowerCase() }] });
      expect(provider.request).toHaveBeenCalledTimes(1);
    });

    it('does not stop anything that is not a transaction', async () => {
      const provider = { request: jest.fn().mockResolvedValue('0x2105'), on: jest.fn() };
      const wrapped = withTransactionPrompt(provider as never, jest.fn(), OTHER);
      await expect(wrapped.request({ method: 'eth_chainId', params: [] })).resolves.toBe('0x2105');
    });
  });
});
