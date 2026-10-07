import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';

/**
 * The seated tiebreaker opens the same modal the parties use. Two things change for them: the
 * figure form is framed as their vote, and the arbiter panel offers resignation rather than the
 * parties' nomination control. Both sides' filings are shown exactly as they are to the parties.
 */
jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    submitSettlementVote: jest.fn(), nominateArbiter: jest.fn(), evictArbiter: jest.fn(), resignArbiter: jest.fn(), seatDefaultArbiter: jest.fn()
  })
}));
jest.mock('@/hooks/useDisputeState', () => ({
  useSettlementState: () => ({
    data: { buyer: '0xbuyer', recipient: '0xseller', arbiter: '0xarbiter', buyerVote: 100, recipientVote: 0, arbiterVote: null, resolvedBuyerPercentage: null },
    loading: false, error: null, refetch: jest.fn().mockResolvedValue(null)
  }),
  useArbiterState: () => ({
    data: {
      arbiter: '0xarbiter', seated: true, sold: false, nominationDeadline: null, nominationWindowSeconds: 259200,
      nominatedByBuyer: null, nominatedByRecipient: null, nominationsMatch: false, lastArbiterActionAt: 1, evictableAt: null,
      canNominate: true, canSeatDefaultArbiter: false, canEvictArbiter: false
    },
    loading: false, error: null, refetch: jest.fn().mockResolvedValue(null)
  })
}));
jest.mock('@/components/auth/ConfigProvider', () => ({ useConfig: () => ({ config: { tokenSymbol: 'USDC' } }) }));
jest.mock('@/components/auth', () => ({ useAuth: () => ({ user: { walletAddress: '0xARBITER', email: 'arb@test.com' } }) }));
jest.mock('@/components/ui/FarcasterNameDisplay', () => function MockName({ walletAddress }: any) { return <span>{walletAddress}</span>; });

const contract: any = {
  id: 'contract-1', contractAddress: '0xescrow', buyerAddress: '0xbuyer', sellerAddress: '0xseller', arbiterAddress: '0xarbiter',
  buyerEmail: 'buyer@test.com', sellerEmail: 'seller@test.com', amount: 10_000_000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86_400, description: 'Fit-out', status: 'DISPUTED', createdAt: 0,
  disputes: [
    { reason: 'Only half the tiles arrived', refundPercent: 100, userEmail: 'buyer@test.com', timestamp: 1_700_000_000 },
    { reason: 'Everything was delivered and signed for', refundPercent: 0, userEmail: 'seller@test.com', timestamp: 1_700_000_100 }
  ]
};

describe('DisputeManagementModal for the seated tiebreaker', () => {
  it('shows both sides, frames the form as their vote, and offers resignation', () => {
    render(<DisputeManagementModal isOpen onClose={jest.fn()} contract={contract} onRefresh={jest.fn()} />);

    expect(screen.getByText('Only half the tiles arrived')).toBeInTheDocument();
    expect(screen.getByText('Everything was delivered and signed for')).toBeInTheDocument();
    expect(screen.getByText('Cast your tiebreaker vote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resign as tiebreaker' })).toBeInTheDocument();
    // Not a party: no nominating.
    expect(screen.queryByRole('button', { name: 'Nominate' })).toBeNull();
  });
});
