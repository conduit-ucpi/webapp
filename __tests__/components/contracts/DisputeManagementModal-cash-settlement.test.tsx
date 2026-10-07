import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';
import { CASH_SETTLEMENT_CONFIRMED_REASON, SETTLED_IN_CASH_REASON } from '@/lib/cashSettlement';

/**
 * The seller's half of the "I settled in cash" shortcut.
 *
 * The buyer's button puts 100% on-chain with the sentinel reason. On its own that settles nothing:
 * the seller has to match it. Without a tailored prompt they land in the generic settle form and
 * must work out for themselves that the answer is "type 100". So when BOTH halves are present —
 * the 100% standing on-chain and the sentinel in the record — the seller gets a one-click
 * confirmation. It still runs through the ordinary confirm-and-sign step, because every figure on
 * this screen is confirmed before it is sent.
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

let buyerVote: number | null = 100;
let viewer = '0xseller';

jest.mock('@/hooks/useDisputeState', () => ({
  useSettlementState: () => ({
    data: {
      buyer: '0xbuyer',
      recipient: '0xseller',
      arbiter: null,
      buyerVote,
      recipientVote: null,
      arbiterVote: null,
      resolvedBuyerPercentage: null
    },
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(null)
  }),
  useArbiterState: () => ({ data: null, loading: false, error: null, refetch: jest.fn().mockResolvedValue(null) })
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { tokenSymbol: 'USDC', rpcUrl: 'http://rpc.test' } })
}));

jest.mock('@/components/auth', () => ({
  useAuth: () => ({ user: { walletAddress: viewer, email: `${viewer}@test.com` } })
}));

jest.mock('@/components/ui/FarcasterNameDisplay', () => {
  return function MockName({ walletAddress }: any) {
    return <span>{walletAddress}</span>;
  };
});

function contractWith(disputes: any[]): any {
  return {
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
    disputes
  };
}

const cashClaim = { reason: SETTLED_IN_CASH_REASON, refundPercent: 100, userEmail: 'buyer@test.com', timestamp: 1_700_000_000 };

function renderModal(disputes: any[]) {
  return render(<DisputeManagementModal isOpen onClose={jest.fn()} contract={contractWith(disputes)} onRefresh={jest.fn()} />);
}

describe('Confirming a cash settlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buyerVote = 100;
    viewer = '0xseller';
    submitSettlementVote.mockResolvedValue('0xtxhash');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });

  it('offers the seller a one-click match that sends 100% and records the confirmation', async () => {
    renderModal([cashClaim]);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm cash settlement' }));
    // The ordinary confirmation step still stands between the click and the chain.
    expect(submitSettlementVote).not.toHaveBeenCalled();
    expect(screen.getByText(/Send 100% to the buyer on-chain\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and sign' }));

    await waitFor(() => expect(submitSettlementVote).toHaveBeenCalledWith('0xescrow', 100));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/contracts/contract-1/dispute');
    expect(JSON.parse(init.body)).toMatchObject({ reason: CASH_SETTLEMENT_CONFIRMED_REASON, refundPercent: 100 });
  });

  it('is not offered when the buyer gave a different reason for their 100%', () => {
    renderModal([{ ...cashClaim, reason: 'Goods never arrived' }]);
    expect(screen.queryByRole('button', { name: 'Confirm cash settlement' })).toBeNull();
  });

  it('is not offered when the 100% is not actually standing on-chain', () => {
    buyerVote = null;
    renderModal([cashClaim]);
    expect(screen.queryByRole('button', { name: 'Confirm cash settlement' })).toBeNull();
  });

  it('is not offered to the buyer', () => {
    viewer = '0xbuyer';
    renderModal([cashClaim]);
    expect(screen.queryByRole('button', { name: 'Confirm cash settlement' })).toBeNull();
  });
});
