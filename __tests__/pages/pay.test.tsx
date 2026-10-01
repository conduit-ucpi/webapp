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
import { decodePayResume, encodePayResume, withPayResume } from '@/lib/payResume';

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

  it("records the partner a payment is made under, alongside the terms, not as one of them", async () => {
    const { BrandProvider } = jest.requireActual('@conduit-ucpi/whitelabel-sdk');
    window.history.replaceState({}, '', '/pay?b=escrow-me');
    mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce({
      escrow_address: ESCROW,
      receipt: { contract_id: 'c-1' },
    });
    try {
      render(
        <BrandProvider
          brands={{ stabledrop: { id: 'stabledrop', name: 'Stabledrop.me' }, 'escrow-me': { id: 'escrow-me', name: 'Escrow Me' } }}
          defaultBrandId="stabledrop"
        >
          <PayPage />
        </BrandProvider>
      );
      fill();
      await screen.findByText('Confirm payment');
      expect(mockCall.mock.calls[0][1]).toMatchObject({ brand: 'escrow-me', description: 'Logo design' });
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('sends no brand on our own pages', async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage />);
    fill();
    await screen.findByText('Confirm payment');
    expect(mockCall.mock.calls[0][1]).not.toHaveProperty('brand');
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

/*
 * A payment REQUEST's link: made by ap2service's prepare (or contractservice's request email),
 * naming the buyer up front. Whoever signs in to pay, the escrow is the one the request named.
 */
describe('/pay from a request link', () => {
  // Made by ap2service's mcp_server._pay_link — the two sides must agree on the format.
  const FROM_PYTHON =
    'eyJzZWxsZXIiOiJtZXJjaGFudEBleGFtcGxlLmNvbSIsImFtb3VudCI6IjEyLjUiLCJleHBpcnlUaW1lc3RhbXAiOjE3OTM1MDAwMDAsImRlc2NyaXB0aW9uIjoiTG9nbyBkZXNpZ24gXHUyMDE0IGRyYWZ0IDIiLCJ0b2tlblN5bWJvbCI6IlVTREMiLCJleHRlcm5hbElkIjoibWNwLTFmMDQiLCJub21pbmFsQnV5ZXIiOiIweDM5QzMyMzZBMkY3RkNFNENjMjE1YTI0ZkZiMzJhQzQ4NjQ2YjIyODgifQ';
  const NAMED_BUYER = '0x39C3236A2F7FCE4Cc215a24fFb32aC48646b2288';

  it("reads ap2service's link exactly", () => {
    expect(decodePayResume(FROM_PYTHON)).toEqual({
      seller: 'merchant@example.com',
      amount: '12.5',
      expiryTimestamp: 1793500000,
      description: 'Logo design — draft 2',
      tokenSymbol: 'USDC',
      externalId: 'mcp-1f04',
      nominalBuyer: NAMED_BUYER,
    });
  });

  it('quotes the escrow the request named, with the signed-in wallet only as the payer', async () => {
    mockRouter.query = { resume: FROM_PYTHON };
    mockCall.mockResolvedValue(prepared());
    render(<PayPage />);

    await screen.findByText('Confirm payment');
    expect(mockCall.mock.calls[0][1]).toMatchObject({
      seller: 'merchant@example.com',
      amount: 12_500_000,
      nominal_buyer: NAMED_BUYER,
      payer: PAYER,
      external_id: 'mcp-1f04',
    });
    expect(screen.getByText('Who can dispute')).toBeInTheDocument();
    expect(screen.getByText(NAMED_BUYER)).toBeInTheDocument();
  });

  it('keeps the named buyer when it puts the payment back in the address bar', async () => {
    mockRouter.query = { resume: FROM_PYTHON };
    mockCall.mockResolvedValue(prepared());
    render(<PayPage />);
    await screen.findByText('Confirm payment');

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = replace.mock.calls.at(-1)[0] as string;
    expect(decodePayResume(new URL(url, 'https://x').searchParams.get('resume'))).toMatchObject({ nominalBuyer: NAMED_BUYER });
  });
});

/*
 * /pay inside a merchant's checkout (/contract-create). The terms are the merchant's, so there is
 * no form; what happens after is the checkout's, so it is handed back rather than done here.
 */
describe('/pay in a checkout', () => {
  const SELLER = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
  const handlers = () => ({ onPaid: jest.fn(), onFailed: jest.fn(), onCancel: jest.fn() });
  const terms = (overrides: Record<string, unknown> = {}) => ({
    seller: SELLER,
    amount: '10',
    description: 'Order 456',
    expiryTimestamp: 1900000000,
    ...overrides,
  });
  const receipt = {
    status: 'settled',
    receipt_claims: {
      'stabledrop.escrow': {
        contract_id: '507f1f77bcf86cd799439011',
        escrow_account: `eip155:8453:${ESCROW}`,
        funding_tx_hash: '0x' + 'cd'.repeat(32),
      },
    },
  };

  beforeEach(() => {
    mockRouter.asPath = `/contract-create?seller=${SELLER}&amount=10&return=https%3A%2F%2Fshop.example%2Fdone&order_id=456`;
  });

  it("prepares the merchant's terms as soon as the payer is signed in, with no form", async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage checkout={{ terms: terms(), ...handlers() }} />);

    await screen.findByText('Confirm payment');
    expect(screen.queryByPlaceholderText('Email address or wallet (0x…)')).toBeNull();
    expect(mockCall.mock.calls[0][1]).toMatchObject({
      seller: SELLER,
      amount: 10_000_000,
      expiry_timestamp: 1900000000,
      description: 'Order 456',
      nominal_buyer: PAYER,
    });
    // The terms are not the buyer's to edit.
    expect(screen.queryByLabelText('Back to payment terms')).toBeNull();
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('waits for sign-in, and can be cancelled from there', () => {
    signIn(false);
    const h = handlers();
    render(<PayPage checkout={{ terms: terms(), ...h }} />);

    expect(screen.getByTestId('wallet-gate')).toBeInTheDocument();
    expect(mockCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it('hands the receipt to the checkout once paid, and never rewrites its URL', async () => {
    const h = handlers();
    mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce(receipt);
    render(<PayPage checkout={{ terms: terms(), ...h }} />);
    fireEvent.click(await screen.findByRole('button', { name: /from this wallet/ }));

    await waitFor(() => expect(h.onPaid).toHaveBeenCalledTimes(1));
    expect(h.onPaid).toHaveBeenCalledWith({
      contractId: '507f1f77bcf86cd799439011',
      escrowAddress: ESCROW,
      txHash: '0x' + 'cd'.repeat(32),
    });
    // The merchant takes the buyer back; there is no "another payment" here.
    expect(screen.queryByRole('button', { name: 'Make another payment' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('hands off a transfer payment too, without a funding hash (the money arrived before settle)', async () => {
    const h = handlers();
    mockCall.mockResolvedValueOnce(prepared()).mockResolvedValueOnce({
      status: 'settled',
      receipt_claims: { 'stabledrop.escrow': { contract_id: 'c-2', escrow_account: `eip155:8453:${ESCROW}` } },
    });
    render(<PayPage checkout={{ terms: terms(), ...h }} />);
    const paid = await screen.findByRole('button', { name: 'I have paid' });
    mockBalances.escrow = '10';
    fireEvent.click(paid);

    await waitFor(() => expect(h.onPaid).toHaveBeenCalledWith({ contractId: 'c-2', escrowAddress: ESCROW, txHash: undefined }));
  });

  it('reports a refused prepare as a failure, and offers to try again or cancel', async () => {
    const h = handlers();
    mockCall.mockResolvedValueOnce({ error: 'amount_too_small', message: 'The minimum payment is $1. More detail.' });
    render(<PayPage checkout={{ terms: terms(), ...h }} />);

    expect(await screen.findByText('The minimum payment is $1.')).toBeInTheDocument();
    expect(h.onFailed).toHaveBeenCalledWith('The minimum payment is $1.', 'prepare');

    mockCall.mockResolvedValueOnce(prepared());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Confirm payment');
  });

  it('comes back to the checkout URL, merchant parameters intact, with the payment added', () => {
    const back = withPayResume(`/contract-create?seller=${SELLER}&return=https%3A%2F%2Fshop.example%2Fdone&order_id=456&resume=old`, 'new');
    const url = new URL(back, 'https://x');
    expect(url.pathname).toBe('/contract-create');
    expect(url.searchParams.get('return')).toBe('https://shop.example/done');
    expect(url.searchParams.get('order_id')).toBe('456');
    expect(url.searchParams.get('resume')).toBe('new');
  });

  it('resumes with the same escrow instead of preparing a new one', async () => {
    mockRouter.query = {
      resume: encodePayResume({
        seller: SELLER,
        amount: '10',
        expiryTimestamp: 1900000000,
        description: 'Order 456',
        tokenSymbol: 'USDC',
        externalId: 'mcp-123',
      }),
    };
    mockCall.mockResolvedValue(prepared());
    render(<PayPage checkout={{ terms: terms(), ...handlers() }} />);

    await screen.findByText('Confirm payment');
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall.mock.calls[0][1]).toMatchObject({ external_id: 'mcp-123' });
  });

  it("refuses a merchant description the form would not have allowed", async () => {
    const h = handlers();
    render(<PayPage checkout={{ terms: terms({ description: 'x'.repeat(161) }), ...h }} />);
    expect(await screen.findByText('Description must be 1-160 characters')).toBeInTheDocument();
    expect(h.onFailed).toHaveBeenCalledWith('Description must be 1-160 characters', 'prepare');
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('refuses a checkout that pays the signed-in wallet itself', async () => {
    const h = handlers();
    render(<PayPage checkout={{ terms: terms({ seller: PAYER }), ...h }} />);
    expect(await screen.findByText(/cannot make a payment to yourself/)).toBeInTheDocument();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('says an instant payment is instant', async () => {
    mockCall.mockResolvedValueOnce(prepared());
    render(<PayPage checkout={{ terms: terms({ expiryTimestamp: 0 }), ...handlers() }} />);

    await screen.findByText('Confirm payment');
    expect(mockCall.mock.calls[0][1]).toMatchObject({ expiry_timestamp: 0 });
  });
});

describe('/pay for a payment request (/contract-pay)', () => {
  const SELLER = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
  const ARBITER = '0x1111111111111111111111111111111111111111';
  const request = (overrides: Record<string, unknown> = {}) => ({
    id: '507f1f77bcf86cd799439011',
    terms: {
      seller: SELLER,
      amount: '10',
      amountBaseUnits: 10_000_000,
      description: 'Logo design',
      expiryTimestamp: 1900000000,
      tokenSymbol: 'USDC',
      arbiter: ARBITER,
      ...overrides,
    },
    sellerLabel: 'seller@example.com',
  });
  let fetchMock: jest.Mock;
  const answers = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });

  beforeEach(() => {
    mockRouter.asPath = '/contract-pay?contractId=507f1f77bcf86cd799439011';
    fetchMock = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({
      user: { email: 'buyer@example.com', walletAddress: PAYER },
      isLoading: false,
      isConnected: true,
      address: PAYER,
      authenticatedFetch: fetchMock,
    });
  });

  it('prepares the stored request as the signed-in buyer, not through the MCP tool', async () => {
    answers(200, prepared({}, { external_id: '507f1f77bcf86cd799439011' }));
    render(<PayPage request={request()} />);

    await screen.findByText('Confirm payment');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ap2/request/507f1f77bcf86cd799439011/prepare');
    expect(JSON.parse(init.body)).toEqual({ payer: PAYER });
    expect(mockCall).not.toHaveBeenCalled();
    // The seller by name, and no way to edit what they asked for.
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Back to payment terms')).toBeNull();
  });

  it('settles with the stored terms exactly — arbiter, request id and base units included', async () => {
    answers(200, prepared({}, { external_id: '507f1f77bcf86cd799439011' }));
    mockCall.mockResolvedValueOnce({ status: 'settled', dispute: { where: '/dashboard?contract=x' } });
    render(<PayPage request={request()} />);
    fireEvent.click(await screen.findByRole('button', { name: /from this wallet/ }));

    await screen.findByText('Paid into escrow', { selector: 'h2' });
    const [tool, args] = mockCall.mock.calls[0];
    expect(tool).toBe('settle_escrow_payment');
    expect(args).toMatchObject({
      seller: SELLER,
      amount: 10_000_000,
      expiry_timestamp: 1900000000,
      nominal_buyer: PAYER,
      description: 'Logo design',
      arbiter: ARBITER,
      external_id: '507f1f77bcf86cd799439011',
    });
    // One payment per request: nothing offers another, and the link stays the seller's.
    expect(screen.queryByRole('button', { name: 'Make another payment' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View this payment' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('leaves the arbiter out when the seller did not choose one', async () => {
    answers(200, prepared({}, { external_id: '507f1f77bcf86cd799439011' }));
    mockCall.mockResolvedValueOnce({ status: 'settled' });
    render(<PayPage request={request({ arbiter: undefined })} />);
    fireEvent.click(await screen.findByRole('button', { name: /from this wallet/ }));

    await screen.findByText('Paid into escrow', { selector: 'h2' });
    expect(mockCall.mock.calls[0][1]).not.toHaveProperty('arbiter');
  });

  it("says why ap2service refused, and offers to try again without a cancel that goes nowhere", async () => {
    answers(409, { detail: 'This request has already been paid.' });
    render(<PayPage request={request()} />);

    expect(await screen.findByText('This request has already been paid.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('refuses a request that pays the signed-in wallet itself, before asking anything', async () => {
    render(<PayPage request={request({ seller: PAYER })} />);
    expect(await screen.findByText(/cannot make a payment to yourself/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('a /pay link carrying a chosen arbiter', () => {
  it('reads it back, and refuses one that is not an address', () => {
    const base = {
      seller: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
      amount: '10',
      expiryTimestamp: 1900000000,
      description: 'Logo design',
      tokenSymbol: 'USDC',
      externalId: 'mcp-1',
    };
    const arbiter = '0x1111111111111111111111111111111111111111';
    expect(decodePayResume(encodePayResume({ ...base, arbiter }))).toEqual({ ...base, arbiter });
    expect(decodePayResume(encodePayResume({ ...base, arbiter: 'the usual one' }))).toBeNull();
  });
});
