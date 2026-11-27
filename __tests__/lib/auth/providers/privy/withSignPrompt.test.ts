jest.mock('@privy-io/react-auth', () => ({}));

import { SIGN_PROMPT_DESCRIPTION, withSignPrompt } from '@/lib/auth/providers/privy/PrivyHost';

const ADDRESS = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';
const TYPED = {
  domain: { name: 'USD Coin', version: '2', chainId: 8453 },
  types: { TransferWithAuthorization: [{ name: 'from', type: 'address' }] },
  primaryType: 'TransferWithAuthorization',
  message: { from: ADDRESS }
};

function setup() {
  const provider = { request: jest.fn().mockResolvedValue('0xfrom-provider'), on: jest.fn() };
  const signTypedData = jest.fn().mockResolvedValue({ signature: '0xfrom-privy' });
  const wrapped = withSignPrompt(provider as never, signTypedData, ADDRESS);
  return { provider, signTypedData, wrapped };
}

describe('withSignPrompt', () => {
  it('says the signature costs no GAS fees — not that the payment is free', () => {
    expect(SIGN_PROMPT_DESCRIPTION).toBe("Signing this message won't cost you any gas fees.");
  });

  it('signs typed data through Privy with that text, as ethers sends it', async () => {
    const { provider, signTypedData, wrapped } = setup();

    const signature = await wrapped.request({
      method: 'eth_signTypedData_v4',
      params: [ADDRESS, JSON.stringify(TYPED)]
    });

    expect(signature).toBe('0xfrom-privy');
    expect(signTypedData).toHaveBeenCalledWith(TYPED, {
      address: ADDRESS,
      uiOptions: { description: SIGN_PROMPT_DESCRIPTION }
    });
    expect(provider.request).not.toHaveBeenCalled();
  });

  it('accepts the typed data as an object too', async () => {
    const { signTypedData, wrapped } = setup();

    await wrapped.request({ method: 'eth_signTypedData_v4', params: [ADDRESS, TYPED] });

    expect(signTypedData.mock.calls[0][0]).toEqual(TYPED);
  });

  it('leaves every other request, and the rest of the provider, alone', async () => {
    const { provider, signTypedData, wrapped } = setup();

    expect(await wrapped.request({ method: 'personal_sign', params: ['0x00', ADDRESS] })).toBe('0xfrom-provider');
    (wrapped as unknown as { on: (e: string) => void }).on('accountsChanged');

    expect(signTypedData).not.toHaveBeenCalled();
    expect(provider.on).toHaveBeenCalledWith('accountsChanged');
  });
});
