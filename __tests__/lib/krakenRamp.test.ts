/**
 * Kraken's purchase page: only for what it has been seen to deliver, asked for in tokens, never
 * below its minimum, and always to the wallet that needs the money.
 */
import { KRAKEN_MINIMUM_USD, krakenDelivers, krakenPurchaseAmount, krakenRampUrl } from '@/lib/krakenRamp';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

describe('krakenDelivers', () => {
  it.each([
    ['USDC', 8453, true],
    ['usdc', 8453, true],
    // Kraken sells USDT, but not on Base (seen 2026-11-10).
    ['USDT', 8453, false],
    ['USDC', 1, false],
    ['USDC', undefined, false],
    [undefined, 8453, false],
  ])('%s on chain %s: %s', (token, chain, expected) => {
    expect(krakenDelivers(token as string | undefined, chain as number | undefined)).toBe(expected);
  });
});

describe('krakenPurchaseAmount', () => {
  it("asks for Kraken's minimum when less is needed", () => {
    expect(KRAKEN_MINIMUM_USD).toBe(11);
    expect(krakenPurchaseAmount(1.5)).toBe(11);
  });

  it('asks for what is needed above the minimum, rounded up to the cent', () => {
    expect(krakenPurchaseAmount(32.391)).toBe(32.4);
    expect(krakenPurchaseAmount(250)).toBe(250);
  });
});

describe('krakenRampUrl', () => {
  it('fills in the token, network, token amount and this wallet', () => {
    const url = new URL(krakenRampUrl({ walletAddress: WALLET, tokenSymbol: 'USDC', chainId: 8453, amount: 32.4 })!);
    expect(`${url.origin}${url.pathname}`).toBe('https://ramp.kraken.com/entry');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      fiat: 'USD',
      amount: '32.4',
      amount_type: 'crypto',
      payment_method: 'creditCard',
      crypto: 'USDC',
      network: 'Base',
      wallet_address: WALLET,
    });
  });

  it('has no address for a token or chain Kraken does not deliver', () => {
    expect(krakenRampUrl({ walletAddress: WALLET, tokenSymbol: 'USDT', chainId: 8453, amount: 20 })).toBeNull();
    expect(krakenRampUrl({ walletAddress: WALLET, tokenSymbol: 'USDC', chainId: 1, amount: 20 })).toBeNull();
  });
});
