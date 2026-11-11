/**
 * Converting one stablecoin to another in the buyer's wallet: where it is offered, what it may
 * cost, and that the calldata says what was asked.
 */
import {
  SWAP_VENUES,
  convertibleFrom,
  decodeSwap,
  encodeQuote,
  encodeSwap,
  isSwapRouter,
  maxAmountIn,
  purchaseAmountFor,
  swapVenue,
  withinPremium,
} from '@/lib/stablecoinSwap';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const WALLET = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A';
const base = SWAP_VENUES[8453];

describe('where a conversion is offered', () => {
  it('converts between USDC and USDT on Base, either way and whatever the case', () => {
    expect(swapVenue(8453, 'USDC', 'USDT')).toBe(base);
    expect(swapVenue(8453, 'usdt', 'usdc')).toBe(base);
  });

  it('offers nothing on a network with no venue, for an unlisted token, or a token into itself', () => {
    expect(swapVenue(84532, 'USDC', 'USDT')).toBeNull();
    expect(swapVenue(undefined, 'USDC', 'USDT')).toBeNull();
    expect(swapVenue(8453, 'DAI', 'USDT')).toBeNull();
    expect(swapVenue(8453, 'USDT', 'USDT')).toBeNull();
  });

  it('names the token a request could be paid with instead', () => {
    expect(convertibleFrom(8453, 'USDT')).toBe('USDC');
    expect(convertibleFrom(8453, 'USDC')).toBe('USDT');
    expect(convertibleFrom(8453, 'DAI')).toBeNull();
    expect(convertibleFrom(56, 'USDT')).toBeNull();
  });

  it("uses Uniswap's Base router, quoter and 0.01% pool", () => {
    expect(base).toEqual({
      router: '0x2626664c2603336E57B271c5C0b26F421741e481',
      quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      fee: 100,
      tokens: ['USDC', 'USDT'],
    });
  });
});

describe('what a conversion may cost', () => {
  it('allows half a percent over the quote for a moving price', () => {
    expect(maxAmountIn(BigInt(20_000_000))).toBe(BigInt(20_100_000));
  });

  it('accepts up to one percent over one-for-one and refuses more', () => {
    const out = BigInt(20_000_000);
    expect(withinPremium(BigInt(19_985_028), out, 6, 6)).toBe(true);
    expect(withinPremium(BigInt(20_200_000), out, 6, 6)).toBe(true);
    expect(withinPremium(BigInt(20_200_001), out, 6, 6)).toBe(false);
  });

  it('compares tokens of different decimals like for like', () => {
    const twenty18 = BigInt('20000000000000000000');
    expect(withinPremium(BigInt(20_100_000), twenty18, 6, 18)).toBe(true);
    expect(withinPremium(BigInt(21_000_000), twenty18, 6, 18)).toBe(false);
  });

  it('refuses a conversion into nothing', () => {
    expect(withinPremium(BigInt(1), BigInt(0), 6, 6)).toBe(false);
  });

  it('buys one percent over the cost, rounded up to the cent', () => {
    expect(purchaseAmountFor(20)).toBe(20.2);
    expect(purchaseAmountFor(19.985028)).toBe(20.19);
  });
});

describe('the calldata', () => {
  const call = {
    tokenIn: USDC,
    tokenOut: USDT,
    recipient: WALLET,
    amountOut: BigInt(20_000_000),
    amountInMaximum: BigInt(20_100_000),
  };

  it('reads back exactly what was asked: tokens, recipient, exact amount out and the ceiling', () => {
    expect(decodeSwap(encodeSwap(base, call))).toEqual(call);
  });

  it('is not mistaken for a swap when it is something else', () => {
    expect(decodeSwap('0xa9059cbb' + '00'.repeat(64))).toBeNull();
    expect(decodeSwap('0x')).toBeNull();
  });

  it('asks the quoter for an exact amount out through the same pool', () => {
    const data = encodeQuote(base, USDC, USDT, BigInt(20_000_000));
    expect(data.toLowerCase()).toContain(USDC.slice(2).toLowerCase());
    expect(data.toLowerCase()).toContain(USDT.slice(2).toLowerCase());
    expect(data).toContain((100).toString(16).padStart(64, '0'));
  });

  it('knows its own router and no other address', () => {
    expect(isSwapRouter(base.router.toLowerCase())).toBe(true);
    expect(isSwapRouter(USDC)).toBe(false);
    expect(isSwapRouter(undefined)).toBe(false);
  });
});
