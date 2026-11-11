/**
 * /pay and /contract-pay, for a request in USDT from a wallet holding USDC: the wallet converts
 * exactly what it is short of, into itself, and then pays the ordinary way. What matters is that
 * nothing is converted twice, nothing is converted that cannot be afforded, and nothing is paid
 * before the converted money is in the wallet.
 */
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { SWAP_VENUES } from '@/lib/stablecoinSwap';

const PAYER = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';
const SELLER = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
const venue = SWAP_VENUES[8453];

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/contract-pay',
    isReady: true,
    query: {},
    asPath: '/contract-pay?contractId=507f1f77bcf86cd799439011',
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');
jest.mock('@/lib/ap2Mcp', () => ({
  ...jest.requireActual('@/lib/ap2Mcp'),
  callAp2Tool: jest.fn(),
}));
// What the chain reads back, by holder and token.
const mockHeld = { usdt: '0', usdc: '25', escrow: '0' };
const mockTransfer = jest.fn();
const mockQuote = jest.fn();
const mockSwap = jest.fn();
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    transferToContract: mockTransfer,
    prewarmTransferToContract: jest.fn().mockResolvedValue(undefined),
    quoteSwap: mockQuote,
    swapForExactOutput: mockSwap,
    getTokenBalance: async (owner: string, token: string) => {
      if (owner.toLowerCase() === '0x7b0e8fa36cf4e8ae5416f759692759ae7745f51b') return mockHeld.escrow;
      return token.toLowerCase() === '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2' ? mockHeld.usdt : mockHeld.usdc;
    },
  }),
}));
const showToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock('@/components/auth/WalletChoiceCards', () => () => <div data-testid="wallet-gate" />);
jest.mock('@/components/contracts/AddFundsModal', () => () => null);
jest.mock('@/lib/escrow/verificationRpc', () => ({
  getVerificationReader: () => ({ predictEscrowAddress: jest.fn().mockResolvedValue('0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B') }),
}));
process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = '0x95B1d60FdaFd727378EF2c16108351b619F8F5e5';

import PayPage from '@/pages/pay';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { callAp2Tool } from '@/lib/ap2Mcp';

const mockCall = callAp2Tool as jest.Mock;
const request = () => ({
  id: '507f1f77bcf86cd799439011',
  terms: {
    seller: SELLER,
    amount: '20',
    amountBaseUnits: 20_000_000,
    description: 'Logo design',
    expiryTimestamp: 1900000000,
    tokenSymbol: 'USDT',
  },
  sellerLabel: 'seller@example.com',
});
const prepared = {
  escrow_address: ESCROW,
  fund_by_transfer: { payment_uri: `ethereum:${USDT}@8453/transfer?address=${ESCROW}&uint256=20000000` },
  external_id: '507f1f77bcf86cd799439011',
  external_id_bytes32: '0x' + 'ef'.repeat(32),
  parties: { seller: { address: SELLER } },
  seller_receives_estimate: '19.400000 USDT',
  platform_fee_estimate: '0.600000 USDT',
  dispute: { until: '2026-10-05T07:31:17Z' },
};
const tokens = [
  { symbol: 'USDC', address: USDC, decimals: 6, name: 'USD Coin', enabled: true },
  { symbol: 'USDT', address: USDT, decimals: 6, name: 'Tether USD', enabled: true },
];
const QUOTED = BigInt(19_985_028);
const usingUsdc = () => screen.findByRole('button', { name: /Pay 20 USDT using your USDC \(about 19\.99 USDC\)/ });

beforeEach(() => {
  jest.clearAllMocks();
  mockCall.mockReset();
  Object.assign(mockHeld, { usdt: '0', usdc: '25', escrow: '0' });
  mockQuote.mockReset();
  mockQuote.mockResolvedValue(QUOTED);
  // A conversion that lands: the wallet holds the USDT by the time it returns.
  mockSwap.mockReset();
  mockSwap.mockImplementation(async () => {
    mockHeld.usdt = '20';
    mockHeld.usdc = '5.014972';
    return '0x' + 'aa'.repeat(32);
  });
  mockTransfer.mockReset();
  mockTransfer.mockImplementation(async () => {
    mockHeld.escrow = '20';
    return '0x' + 'cd'.repeat(32);
  });
  (useConfig as jest.Mock).mockReturnValue({
    config: {
      chainId: 8453,
      defaultArbiterAddress: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C',
      rpcUrl: 'https://mainnet.base.org',
      supportedTokens: tokens,
      defaultToken: tokens[0],
    },
    isLoading: false,
  });
  (useAuth as jest.Mock).mockReturnValue({
    user: { email: 'buyer@example.com', walletAddress: PAYER },
    isLoading: false,
    isConnected: true,
    address: PAYER,
    authenticatedFetch: jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => prepared }),
  });
});

describe('paying a USDT request with USDC', () => {
  it('quotes exactly what the wallet is short of, once', async () => {
    render(<PayPage request={request()} />);
    await usingUsdc();
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote).toHaveBeenCalledWith(venue, USDC, USDT, BigInt(20_000_000));
  });

  it('converts the shortfall into the wallet, then pays USDT the ordinary way and settles', async () => {
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request()} />);
    fireEvent.click(await usingUsdc());

    await screen.findByText('Payment protected', { selector: 'h2' });
    expect(mockSwap).toHaveBeenCalledTimes(1);
    expect(mockSwap).toHaveBeenCalledWith(
      venue,
      {
        tokenIn: USDC,
        tokenInDecimals: 6,
        tokenOut: USDT,
        amountOut: BigInt(20_000_000),
        // The quote plus half a percent.
        amountInMaximum: BigInt(20_084_953),
      },
      // What the wallet's own prompt says at each step: how much, of what, into what, and why.
      {
        approve: 'Allow up to 20.084953 USDC to be converted into USDT for this payment. Nothing is spent at this step.',
        convert: 'Convert up to 20.084953 USDC into exactly 20.0 USDT. The USDT stays in your wallet until you pay.',
      }
    );
    expect(mockTransfer).toHaveBeenCalledTimes(1);
    expect(mockTransfer).toHaveBeenCalledWith(USDT, ESCROW, '20000000', expect.any(String));
    // Converted first, paid second.
    expect(mockSwap.mock.invocationCallOrder[0]).toBeLessThan(mockTransfer.mock.invocationCallOrder[0]);
    expect(mockCall.mock.calls[0][0]).toBe('settle_escrow_payment');
  });

  it('converts only the part that is missing when the wallet holds some USDT', async () => {
    mockHeld.usdt = '12.5';
    mockQuote.mockResolvedValue(BigInt(7_494_000));
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request()} />);
    fireEvent.click(await screen.findByRole('button', { name: /using your USDC \(about 7\.50 USDC\)/ }));

    await screen.findByText('Payment protected', { selector: 'h2' });
    expect(mockSwap.mock.calls[0][1].amountOut).toBe(BigInt(7_500_000));
    expect(mockTransfer).toHaveBeenCalledWith(USDT, ESCROW, '20000000', expect.any(String));
  });

  it('never takes more than the wallet holds, even inside the allowance for a moving price', async () => {
    mockHeld.usdc = '20';
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request()} />);
    fireEvent.click(await usingUsdc());

    await waitFor(() => expect(mockSwap).toHaveBeenCalled());
    expect(mockSwap.mock.calls[0][1].amountInMaximum).toBe(BigInt(20_000_000));
  });

  it('never converts twice: with the USDT already in the wallet, pressing again only pays', async () => {
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request()} />);
    const pay = await usingUsdc();
    // An earlier conversion landed, and the screen has not caught up.
    mockHeld.usdt = '20';
    fireEvent.click(pay);

    await screen.findByText('Payment protected', { selector: 'h2' });
    expect(mockSwap).not.toHaveBeenCalled();
    expect(mockTransfer).toHaveBeenCalledWith(USDT, ESCROW, '20000000', expect.any(String));
  });

  it('converts and sends nothing when the price has moved past the cap since the button was drawn', async () => {
    render(<PayPage request={request()} />);
    const pay = await usingUsdc();
    mockQuote.mockResolvedValue(BigInt(20_300_000));
    fireEvent.click(pay);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Converting to USDT costs too much right now. Nothing was converted.' }))
    );
    expect(mockSwap).not.toHaveBeenCalled();
    expect(mockTransfer).not.toHaveBeenCalled();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('converts and sends nothing when the wallet no longer holds enough USDC', async () => {
    render(<PayPage request={request()} />);
    const pay = await usingUsdc();
    mockHeld.usdc = '3';
    fireEvent.click(pay);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'The conversion now costs more USDC than your wallet holds. Nothing was converted.' }))
    );
    expect(mockSwap).not.toHaveBeenCalled();
    expect(mockTransfer).not.toHaveBeenCalled();
  });

  it('pays nothing when the buyer turns the conversion down in their wallet', async () => {
    mockSwap.mockRejectedValueOnce(new Error('User rejected the request'));
    render(<PayPage request={request()} />);
    fireEvent.click(await usingUsdc());

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    expect(mockTransfer).not.toHaveBeenCalled();
    expect(mockCall).not.toHaveBeenCalled();
    // Still there to try again.
    expect(await usingUsdc()).toBeEnabled();
  });

  it('offers to add USDC, not to pay, when the wallet holds too little of either', async () => {
    mockHeld.usdc = '5';
    render(<PayPage request={request()} />);

    expect(await screen.findByRole('button', { name: 'Add USDC to this wallet' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Pay 20 USDT from this wallet/ })).toBeDisabled();
    expect(await screen.findByText('You need about 14.99 more USDC to pay this. Add USDC first.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Buy USDT directly/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not offer a conversion the pool prices past the cap', async () => {
    mockQuote.mockResolvedValue(BigInt(21_000_000));
    render(<PayPage request={request()} />);

    expect(await screen.findByText(/can't be converted to USDT right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay 20 USDT from this wallet/ })).toBeDisabled();
  });

  it('asks for no quote and offers no conversion when the wallet already holds the USDT', async () => {
    mockHeld.usdt = '50';
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay 20 USDT from this wallet' }));

    await screen.findByText('Payment protected', { selector: 'h2' });
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockSwap).not.toHaveBeenCalled();
  });

  it('offers no conversion on a network with nowhere to convert', async () => {
    (useConfig as jest.Mock).mockReturnValue({
      config: {
        chainId: 84532,
        defaultArbiterAddress: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C',
        rpcUrl: 'https://sepolia.base.org',
        supportedTokens: tokens,
        defaultToken: tokens[0],
      },
      isLoading: false,
    });
    render(<PayPage request={request()} />);

    expect(await screen.findByRole('button', { name: /Pay 20 USDT from this wallet/ })).toBeDisabled();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
