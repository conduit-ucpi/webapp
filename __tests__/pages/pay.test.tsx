/**
 * /pay: a buyer pushes a payment through ap2service's MCP tools.
 *
 * The page decides nothing, so what matters is the wire: the terms it hands prepare and settle
 * must be the same (they ARE the escrow's address), the payer and the nominal buyer must be the
 * signed-in wallet, and the wallet must sign exactly the typed data prepare returned.
 */

import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { ethers } from 'ethers';

// A fixed throwaway key: createRandom needs a Buffer jsdom does not provide.
const payerWallet = new ethers.Wallet('0x' + '11'.repeat(32));
const PAYER = payerWallet.address;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ESCROW = '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B';

const push = jest.fn();
const replace = jest.fn();
const mockRouter: { query: Record<string, string>; asPath: string } = { query: {}, asPath: '/pay' };
jest.mock('next/router', () => ({
  useRouter: () => ({
    push,
    replace,
    pathname: '/pay',
    isReady: true,
    query: mockRouter.query,
    asPath: mockRouter.asPath,
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');
jest.mock('@/lib/ap2Mcp', () => ({
  ...jest.requireActual('@/lib/ap2Mcp'),
  callAp2Tool: jest.fn(),
}));
// What the chain reads back: the payer's wallet, and the escrow address (empty until funded).
const mockBalances = { wallet: '100.0', escrow: '0' };
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    getWeb3Service: async () => ({ getSigner: async () => payerWallet }),
    getTokenBalance: async (owner: string) =>
      owner.toLowerCase() === '0x7b0e8fa36cf4e8ae5416f759692759ae7745f51b' ? mockBalances.escrow : mockBalances.wallet,
  }),
}));
const showToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock('@/components/auth/WalletChoiceCards', () => () => <div data-testid="wallet-gate" />);

import PayPage from '@/pages/pay';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { callAp2Tool } from '@/lib/ap2Mcp';
import { decodePayResume, encodePayResume } from '@/lib/payResume';

const mockCall = callAp2Tool as jest.Mock;

const typedData = {
  domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: PAYER,
    to: ESCROW,
    value: '10000000',
    validAfter: '0',
    validBefore: '1900000000',
    nonce: '0x' + 'ab'.repeat(32),
  },
};

const prepared = (overrides: Record<string, unknown> = {}, top: Record<string, unknown> = {}) => ({
  escrow_address: ESCROW,
  fund_by_transfer: { payment_uri: `ethereum:${USDC}@8453/transfer?address=${ESCROW}&uint256=10000000` },
  external_id: 'mcp-123',
  seller_receives_estimate: '9.700000 USDC',
  platform_fee_estimate: '0.300000 USDC',
  fund_by_signature: {
    typed_data: typedData,
    authorization: typedData.message,
    payer_can_cover: true,
    ...overrides,
  },
  dispute: { until: '2026-10-05T07:31:17Z' },
  ...top,
});

function signIn(connected = true) {
  (useAuth as jest.Mock).mockReturnValue({
    user: connected ? { email: 'buyer@example.com', walletAddress: PAYER } : null,
    isLoading: false,
    isConnected: connected,
    address: connected ? PAYER : null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps queued answers; a test that queues one it never uses would leak it.
  mockCall.mockReset();
  mockRouter.query = {};
  mockRouter.asPath = '/pay';
  mockBalances.wallet = '100.0';
  mockBalances.escrow = '0';
  (useConfig as jest.Mock).mockReturnValue({
    config: {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      supportedTokens: [{ symbol: 'USDC', address: USDC, decimals: 6, name: 'USD Coin', enabled: true }],
      defaultToken: { symbol: 'USDC', address: USDC, decimals: 6, name: 'USD Coin' },
    },
    isLoading: false,
  });
  signIn();
});

function fill(seller = 'seller@example.com') {
  fireEvent.change(screen.getByPlaceholderText('Email address or wallet (0x…)'), { target: { value: seller } });
  fireEvent.change(screen.getByPlaceholderText("What's this payment for?"), { target: { value: 'Logo design' } });
  fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('/pay', () => {
  it('asks a signed-out visitor to sign in first', () => {
    signIn(false);
    render(<PayPage />);
    expect(screen.getByTestId('wallet-gate')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Email address or wallet (0x…)')).toBeNull();
  });

  it('does not offer the seller-side fee guidance or an arbiter override', () => {
    render(<PayPage />);
    expect(screen.queryByText('Advanced Options')).toBeNull();
    expect(screen.queryByText(/you receive/i)).toBeNull();
  });

  it('asks prepare for the terms, in base units, with the signed-in wallet as payer and disputer', async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fill();

    await screen.findByText('Confirm payment');
    const [tool, args] = mockCall.mock.calls[0];
    expect(tool).toBe('prepare_escrow_payment');
    expect(args).toMatchObject({
      seller: 'seller@example.com',
      amount: 10_000_000,
      nominal_buyer: PAYER,
      payer: PAYER,
      token_symbol: 'USDC',
      description: 'Logo design',
    });
    expect(args.expiry_timestamp).toBeGreaterThan(Date.now() / 1000);
    // The quote is ap2service's, not the page's.
    expect(screen.getByText('9.700000 USDC')).toBeInTheDocument();
    expect(screen.getByText('0.300000 USDC')).toBeInTheDocument();
  });

  it('signs exactly what prepare returned and settles the same terms with it', async () => {
    mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce({
      status: 'settled',
      dispute: { where: 'https://stabledrop.me/dashboard?contract=abc' },
    });
    render(<PayPage />);
    fill();
    fireEvent.click(await screen.findByRole('button', { name: /from this wallet/ }));

    await screen.findByText('Paid into escrow', { selector: 'h2' });
    const [, prepareArgs] = mockCall.mock.calls[0];
    const [tool, settleArgs] = mockCall.mock.calls[1];
    expect(tool).toBe('settle_escrow_payment');
    const { payer: _payer, ...terms } = prepareArgs;
    expect(settleArgs).toMatchObject({ ...terms, external_id: 'mcp-123', authorization: typedData.message });
    // The signature is the payer's, over the token's own domain: what the token will accept.
    const recovered = ethers.verifyTypedData(typedData.domain, typedData.types, typedData.message, settleArgs.signature);
    expect(recovered).toBe(PAYER);

    fireEvent.click(screen.getByRole('button', { name: 'View this payment' }));
    expect(push).toHaveBeenCalledWith('/dashboard?contract=abc');
  });

  it('offers to add funds, not to pay, when the wallet is short — as /contract-pay does', async () => {
    mockBalances.wallet = '5';
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fill();

    expect(await screen.findByRole('button', { name: 'Add funds to this wallet' })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', { name: /from this wallet/ })).toBeDisabled());
  });

  it('going back and pressing Continue with the same terms keeps the same escrow', async () => {
    mockCall.mockResolvedValue(prepared());
    render(<PayPage />);
    fill();
    await screen.findByText('Confirm payment');

    fireEvent.click(screen.getByLabelText('Back to payment terms'));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByText('Confirm payment');

    expect(mockCall.mock.calls[0][1]).not.toHaveProperty('external_id');
    expect(mockCall.mock.calls[1][1]).toMatchObject({ external_id: 'mcp-123' });
  });

  it('changed terms get a new escrow, and the address shown follows it', async () => {
    const SECOND = '0x704AAAD9b0E82d6d889417FEd58b4a410C73258A';
    mockCall
      .mockResolvedValueOnce(prepared())
      .mockResolvedValueOnce(prepared({}, { escrow_address: SECOND, external_id: 'mcp-456' }));
    render(<PayPage />);
    fill();
    expect(await screen.findByDisplayValue(ESCROW)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Back to payment terms'));
    fireEvent.change(await screen.findByPlaceholderText('0.0000'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // The bug: the panel kept offering the first escrow while settle checked the second.
    expect(await screen.findByDisplayValue(SECOND)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(ESCROW)).toBeNull();
    expect(mockCall.mock.calls[1][1]).not.toHaveProperty('external_id');
  });

  it('offers the escrow address and QR for paying from any other wallet', async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fill();

    expect(await screen.findByText('Or pay from another wallet')).toBeInTheDocument();
    expect(await screen.findByDisplayValue(ESCROW)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I have paid' })).toBeInTheDocument();
  });

  it('"I have paid" settles the funded address through the same tool, unsigned, with the same terms', async () => {
    mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage />);
    fill();
    const paid = await screen.findByRole('button', { name: 'I have paid' });

    mockBalances.escrow = '10';
    fireEvent.click(paid);

    await screen.findByText('Paid into escrow', { selector: 'h2' });
    const [, prepareArgs] = mockCall.mock.calls[0];
    const [tool, settleArgs] = mockCall.mock.calls[1];
    expect(tool).toBe('settle_escrow_payment');
    const { payer: _payer, ...terms } = prepareArgs;
    expect(settleArgs).toEqual({ ...terms, external_id: 'mcp-123' });
  });

  it('does not settle an address that holds nothing yet', async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fill();
    fireEvent.click(await screen.findByRole('button', { name: 'I have paid' }));

    expect(await screen.findByText(/No payment found|not found|haven't received/i)).toBeInTheDocument();
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('withholds the transfer routes when ap2service could not put the escrow on file', async () => {
    mockCall.mockResolvedValueOnce(prepared({}, { fund_by_transfer: 'Not offered: could not be put on file' }));
    render(<PayPage />);
    fill();

    expect(await screen.findByRole('button', { name: /from this wallet/ })).toBeInTheDocument();
    expect(screen.queryByText('Or pay from another wallet')).toBeNull();
    expect(screen.queryByDisplayValue(ESCROW)).toBeNull();
  });

  it('says why it cannot sign when ap2service could not build the authorization', async () => {
    mockCall.mockResolvedValueOnce(prepared({ typed_data: undefined, authorization: undefined }));
    render(<PayPage />);
    fill();

    expect(await screen.findByText(/can't be signed for right now/)).toBeInTheDocument();
    // The transfer routes do not need a signature, so they are still there.
    expect(screen.getByText('Or pay from another wallet')).toBeInTheDocument();
  });

  it.each([
    ['0.5', false],
    ['0.002', false],
    ['0.001', true],
    ['1', true],
  ])('checks the site rule before asking ap2service: %s allowed=%s', async (value, allowed) => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fireEvent.change(screen.getByPlaceholderText('Email address or wallet (0x…)'), { target: { value: 'seller@example.com' } });
    fireEvent.change(screen.getByPlaceholderText("What's this payment for?"), { target: { value: 'Logo design' } });
    fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    if (allowed) {
      await waitFor(() => expect(mockCall).toHaveBeenCalled());
    } else {
      expect(await screen.findByText('Enter $1.00 or more, or exactly 0.001 for a free test')).toBeInTheDocument();
      expect(mockCall).not.toHaveBeenCalled();
    }
  });

  it('refuses an amount below the minimum under the amount field, before there is anything to pay', async () => {
    mockCall.mockResolvedValueOnce({
      error: 'settlement_refused',
      retryable: false,
      message:
        'The minimum payment is 1 USD. This one is below the minimum (1000 base units, under 1000000 at 6 decimals): we pay gas...',
    });
    render(<PayPage />);
    fill();

    expect(await screen.findByText('The minimum payment is 1 USD.')).toBeInTheDocument();
    // Still on the form: no review, no address, nothing to pay into.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByText('Confirm payment')).toBeNull();
    expect(showToast).not.toHaveBeenCalled();

    // Changing the amount clears it.
    fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '5' } });
    expect(screen.queryByText('The minimum payment is 1 USD.')).toBeNull();
  });

  it('says why settle refused a transfer, instead of "no payment found"', async () => {
    mockCall
      .mockResolvedValueOnce(prepared())
      .mockResolvedValueOnce({ error: 'settlement_refused', message: 'The minimum payment is 1 USD. …' });
    render(<PayPage />);
    fill();
    const paid = await screen.findByRole('button', { name: 'I have paid' });

    mockBalances.escrow = '10';
    fireEvent.click(paid);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'The minimum payment is 1 USD. …' }))
    );
    expect(screen.queryByText('Paid into escrow', { selector: 'h2' })).toBeNull();
  });

  it("shows prepare's refusal and stays on the form", async () => {
    mockCall.mockResolvedValueOnce({ error: 'sanctioned_party', message: 'A party is on a sanctions list' });
    render(<PayPage />);
    fill();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'A party is on a sanctions list' }))
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('refuses a seller that is neither an email nor a wallet without calling anything', () => {
    render(<PayPage />);
    fill('not a person');
    expect(screen.getByText('Enter an email address or a wallet address.')).toBeInTheDocument();
    expect(mockCall).not.toHaveBeenCalled();
  });

  describe('resuming from the URL', () => {
    const RESUME = {
      seller: 'seller@example.com',
      amount: '10',
      expiryTimestamp: 1893456000,
      description: 'Logo design',
      tokenSymbol: 'USDC',
      externalId: 'mcp-123',
    };

    it('puts the payment in the address bar once it is on the review screen', async () => {
      mockCall.mockResolvedValueOnce(prepared());
      render(<PayPage />);
      fill();
      await screen.findByText('Confirm payment');

      await waitFor(() => expect(replace).toHaveBeenCalled());
      const url = replace.mock.calls.at(-1)[0] as string;
      const resume = decodePayResume(new URL(url, 'https://x').searchParams.get('resume'));
      expect(resume).toMatchObject({ seller: 'seller@example.com', amount: '10', externalId: 'mcp-123' });
    });

    it('comes back to the same escrow: prepare is asked again with the same external id', async () => {
      mockRouter.query = { resume: encodePayResume(RESUME) };
      mockCall.mockResolvedValueOnce(prepared());
      render(<PayPage />);

      await screen.findByText('Confirm payment');
      const [tool, args] = mockCall.mock.calls[0];
      expect(tool).toBe('prepare_escrow_payment');
      expect(args).toMatchObject({
        seller: 'seller@example.com',
        amount: 10_000_000,
        expiry_timestamp: 1893456000,
        description: 'Logo design',
        external_id: 'mcp-123',
        nominal_buyer: PAYER,
        payer: PAYER,
      });
    });

    it('settles a card payment that landed while the buyer was at Coinbase', async () => {
      mockRouter.query = { resume: encodePayResume(RESUME) };
      mockBalances.escrow = '10';
      mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce({ status: 'settled' });
      render(<PayPage />);

      await screen.findByText('Paid into escrow', { selector: 'h2' });
      expect(mockCall.mock.calls[1][1]).toMatchObject({ external_id: 'mcp-123' });
      expect(mockCall.mock.calls[1][1]).not.toHaveProperty('signature');
    });

    it('waits for sign-in without dropping the link', async () => {
      signIn(false);
      mockRouter.query = { resume: encodePayResume(RESUME) };
      render(<PayPage />);

      expect(screen.getByTestId('wallet-gate')).toBeInTheDocument();
      expect(mockCall).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it('ignores a malformed link and shows the empty form', () => {
      mockRouter.query = { resume: 'garbage' };
      render(<PayPage />);

      expect(screen.getByPlaceholderText('Email address or wallet (0x…)')).toHaveValue('');
      expect(mockCall).not.toHaveBeenCalled();
    });
  });
});
