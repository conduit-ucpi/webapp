import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';

/**
 * MARKETPLACE_OPENSPEC §15.6b, §3.3A2a.
 *
 * Two properties are pinned here, and both were wrong in the superseded implementation:
 *
 *   1. **Every figure goes on-chain.** The old flow compared the two sides' figures itself and
 *      only sent a transaction when it believed they agreed — mirroring the contract's own
 *      consensus rule off-chain, which can only agree with it or be wrong. When it was wrong,
 *      users saw "agreement reached" while the chain held one vote and the money stayed locked.
 *
 *   2. **The order is chain first, record second.** A declined signature or a reverted
 *      transaction means nothing happened on-chain, and contractservice's dispute record — a
 *      record of what happened, not of what was intended — must hold nothing suggesting
 *      otherwise. Recording first is how "both parties agreed at 40%" ends up in front of users
 *      with the funds still locked.
 */

const submitSettlementVote = jest.fn();

jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    submitSettlementVote,
    nominateArbiter: jest.fn(),
    evictArbiter: jest.fn(),
    seatDefaultArbiter: jest.fn()
  })
}));

const refetchSettlement = jest.fn().mockResolvedValue(null);

jest.mock('@/hooks/useDisputeState', () => ({
  useSettlementState: () => ({
    data: {
      buyer: '0xbuyer',
      recipient: '0xseller',
      arbiter: null,
      // The other party is standing at 40%. Nothing about that should change whether OUR
      // submission is sent — only what the confirmation tells the user.
      buyerVote: 40,
      recipientVote: null,
      arbiterVote: null,
      resolvedBuyerPercentage: null
    },
    loading: false,
    error: null,
    refetch: refetchSettlement
  }),
  useArbiterState: () => ({
    data: null,
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(null)
  })
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { tokenSymbol: 'USDC', rpcUrl: 'http://rpc.test' } })
}));

jest.mock('@/components/auth', () => ({
  useAuth: () => ({ user: { walletAddress: '0xseller', email: 'seller@test.com' } })
}));

jest.mock('@/components/ui/FarcasterNameDisplay', () => {
  return function MockName({ walletAddress }: any) {
    return <span>{walletAddress}</span>;
  };
});

const contract: any = {
  id: 'contract-1',
  contractAddress: '0xescrow',
  buyerAddress: '0xbuyer',
  sellerAddress: '0xseller',
  buyerEmail: 'buyer@test.com',
  sellerEmail: 'seller@test.com',
  amount: 10_000_000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86_400,
  description: 'Fit-out',
  status: 'DISPUTED',
  createdAt: 0,
  disputes: []
};

function renderModal() {
  return render(
    <DisputeManagementModal isOpen onClose={jest.fn()} contract={contract} onRefresh={jest.fn()} />
  );
}

/** Fill in the comment, set a figure, and get as far as the confirmation step. */
function composeFigure(percent: number) {
  fireEvent.change(screen.getByPlaceholderText('Explain your position in the dispute...'), {
    target: { value: 'Partial delivery' }
  });
  fireEvent.change(screen.getByLabelText(/Settlement figure/i), { target: { value: String(percent) } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Submit ${percent}% to buyer`) }));
}

describe('Submitting a settlement figure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    submitSettlementVote.mockResolvedValue('0xtxhash');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  it('sends a figure that matches nobody — every submission goes on-chain', async () => {
    renderModal();
    composeFigure(25);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and sign/i }));

    await waitFor(() => expect(submitSettlementVote).toHaveBeenCalledWith('0xescrow', 25));
  });

  it('sends a figure that matches the other party', async () => {
    renderModal();
    composeFigure(40);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and sign/i }));

    await waitFor(() => expect(submitSettlementVote).toHaveBeenCalledWith('0xescrow', 40));
  });

  it('warns that a matching figure settles, before asking for the signature', async () => {
    renderModal();
    composeFigure(40);

    // The contract cannot tell a proposal from an acceptance. Saying so is the whole protection.
    expect(await screen.findByText(/This settles the dispute/i)).toBeInTheDocument();
  });

  it('tells contractservice only after the transaction succeeds', async () => {
    renderModal();
    composeFigure(25);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and sign/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const call = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).includes('/dispute')
    );
    expect(call).toBeDefined();
    expect(submitSettlementVote).toHaveBeenCalled();
    // Ordering, not merely both-happened: the record must never precede the chain.
    expect(submitSettlementVote.mock.invocationCallOrder[0]).toBeLessThan(
      (global.fetch as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('records nothing when the signature is declined', async () => {
    submitSettlementVote.mockRejectedValue(new Error('User rejected the request'));

    renderModal();
    composeFigure(25);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and sign/i }));

    await waitFor(() => expect(screen.getByText(/User rejected the request/i)).toBeInTheDocument());

    // Nothing happened on-chain, so no dispute entry may exist.
    const disputeCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes('/dispute')
    );
    expect(disputeCalls).toHaveLength(0);
  });

  it('reports settlement from a fresh chain read, not from what it just sent', async () => {
    // A second matching vote pays out in the same transaction, so the only honest source for
    // "did this settle" is the escrow itself after the send.
    refetchSettlement.mockResolvedValue({
      buyer: '0xbuyer',
      recipient: '0xseller',
      arbiter: null,
      buyerVote: 40,
      recipientVote: 40,
      arbiterVote: null,
      resolvedBuyerPercentage: 40
    });

    renderModal();
    composeFigure(40);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and sign/i }));

    expect(await screen.findByText(/Settled at 40% to the buyer/i)).toBeInTheDocument();
  });
});
