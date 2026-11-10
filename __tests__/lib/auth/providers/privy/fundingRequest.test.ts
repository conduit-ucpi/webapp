/**
 * "Add funds" through Privy: the wallet, chain and token must be exactly the ones asked for, and
 * closing the window must not read as a failure.
 */
import { depositFundsOptions, fundWalletResult } from '@/lib/auth/providers/privy/fundingRequest';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const TOKEN = '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb';

describe('depositFundsOptions', () => {
  it('funds this wallet on this chain, with the amount as a starting point', () => {
    expect(depositFundsOptions(WALLET, { amount: '15.00', asset: 'USDC', chainId: 8453 }, 8453)).toEqual({
      destination: { wallet: WALLET, chain: 'eip155:8453', asset: 'usdc' },
      fiat: { source: { defaultAsset: 'usd' }, defaultAmount: '15.00' },
    });
  });

  it('names any other token by its symbol, lower-case as Privy spells its own', () => {
    const options = depositFundsOptions(WALLET, { amount: '5', asset: { erc20: TOKEN, symbol: 'USDT' }, chainId: 8453 }, 8453);
    expect(options.destination.asset).toBe('usdt');
  });

  it('falls back to the address for a token with no symbol', () => {
    const options = depositFundsOptions(WALLET, { amount: '5', asset: { erc20: TOKEN }, chainId: 8453 }, 8453);
    expect(options.destination.asset).toBe(TOKEN);
  });

  it('asks for fiat only, since crypto deposits refuse an external wallet', () => {
    expect(depositFundsOptions(WALLET, { amount: '5', asset: 'USDC', chainId: 8453 }, 8453)).not.toHaveProperty('crypto');
  });
});

describe('fundWalletResult', () => {
  it.each(['submitted', 'confirmed'])('counts a %s purchase as completed', async (status) => {
    await expect(fundWalletResult(Promise.resolve({ method: 'fiat', status }))).resolves.toEqual({ status: 'completed', detail: status });
  });

  it.each(['User exited flow', 'User cancelled funding', 'Payment method selection was cancelled', 'USER_EXITED'])(
    'treats "%s" as the buyer closing the window',
    async (message) => {
      await expect(fundWalletResult(Promise.reject(new Error(message)))).resolves.toEqual({ status: 'cancelled', detail: message });
    }
  );

  it('still surfaces a real failure', async () => {
    await expect(fundWalletResult(Promise.reject(new Error('@stripe/crypto could not be loaded')))).rejects.toThrow(
      '@stripe/crypto could not be loaded'
    );
  });
});
