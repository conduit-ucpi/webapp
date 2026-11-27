/**
 * The conversion's two wallet steps. The approval spends nothing, and the notice over the wallet
 * must not announce "This one moves funds" beside a sentence saying nothing is spent (seen on
 * dev, 11 Nov 2026). The swap itself does move funds, and is announced as doing so.
 */
import { renderHook } from '@testing-library/react';
import { SWAP_VENUES, decodeSale } from '@/lib/stablecoinSwap';
import { asSwapApproval } from '@/lib/swapSteps';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const venue = SWAP_VENUES[8453];

const mockSend = jest.fn();
const mockAllowance = jest.fn();
jest.mock('@/lib/web3', () => ({
  Web3Service: {
    getInstance: () => ({
      isServiceInitialized: () => true,
      getUserAddress: async () => '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A',
      getTokenAllowance: mockAllowance,
      fundAndSendTransaction: mockSend,
    }),
  },
}));
jest.mock('@/components/auth', () => ({ useAuth: () => ({ isConnected: true, getEthersProvider: jest.fn() }) }));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config: { chainId: 8453 } }) }));
jest.mock('@/utils/mobileLogger', () => ({ mLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// The real hook: the suite's setup replaces it with a stand-in everywhere else.
const { useSimpleEthers } = jest.requireActual('@/hooks/useSimpleEthers');

const swap = {
  tokenIn: USDC,
  tokenInDecimals: 6,
  tokenOut: USDT,
  amountOut: BigInt(20_000_000),
  amountInMaximum: BigInt(20_100_000),
};
const prompts = { approve: 'Allow up to 20.1 USDC…', convert: 'Convert up to 20.1 USDC…' };

beforeEach(() => {
  jest.useFakeTimers();
  mockSend.mockReset();
  mockSend.mockResolvedValue('0xhash');
  mockAllowance.mockReset();
});
afterEach(() => jest.useRealTimers());

const run = async () => {
  const { result } = renderHook(() => useSimpleEthers());
  const done = result.current.swapForExactOutput(venue, swap, prompts);
  await jest.advanceTimersByTimeAsync(5000);
  return done;
};

describe('sellExactInput', () => {
  const sale = { tokenIn: USDT, tokenInDecimals: 6, tokenOut: USDC, amountIn: BigInt(20_000_000), amountOutMinimum: BigInt(19_873_232) };
  const sell = async () => {
    const { result } = renderHook(() => useSimpleEthers());
    const done = result.current.sellExactInput(venue, sale, prompts);
    await jest.advanceTimersByTimeAsync(5000);
    return done;
  };

  it('approves exactly what is being sold, then sends the router a sale of it into the wallet itself', async () => {
    mockAllowance.mockResolvedValueOnce('0').mockResolvedValue('20');
    expect(await sell()).toBe('0xhash');

    const [approval, conversion] = mockSend.mock.calls.map(([tx]) => tx);
    expect(approval).toMatchObject({ to: USDT, walletDescription: prompts.approve, movesFunds: false });
    expect(asSwapApproval(approval)).toEqual({ tokenAddress: USDT, amount: '20000000' });
    expect(conversion).toMatchObject({ to: venue.router, walletDescription: prompts.convert });
    expect(decodeSale(conversion.data)).toEqual({
      tokenIn: USDT, tokenOut: USDC, recipient: '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A',
      amountIn: BigInt(20_000_000), amountOutMinimum: BigInt(19_873_232),
    });
  });

  it('skips the approval when the router may already take that much', async () => {
    mockAllowance.mockResolvedValue('20');
    await sell();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('swapForExactOutput', () => {
  it('approves without claiming funds move, then converts and says that one does', async () => {
    // Nothing allowed at first; the approval shows on chain at the next look.
    mockAllowance.mockResolvedValueOnce('0').mockResolvedValue('20.1');
    await run();

    expect(mockSend).toHaveBeenCalledTimes(2);
    const [approval, conversion] = mockSend.mock.calls.map(([tx]) => tx);
    expect(approval).toMatchObject({ to: USDC, walletDescription: prompts.approve, movesFunds: false });
    expect(conversion).toMatchObject({ to: venue.router, walletDescription: prompts.convert });
    expect(conversion.movesFunds).toBeUndefined();
  });

  it('skips the approval when the router may already spend enough', async () => {
    mockAllowance.mockResolvedValue('50');
    await run();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe(venue.router);
  });
});
