import { render, fireEvent, waitFor } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import DisputeManagementModal from '@/components/contracts/DisputeManagementModal';

/**
 * The seated tiebreaker opens the same modal the parties use. Two things change for them: the
 * figure form is framed as their vote, and the arbiter panel offers resignation rather than the
 * parties' nomination control. Both sides' filings are shown exactly as they are to the parties.
 */
const mockResignArbiter = jest.fn();
jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    submitSettlementVote: jest.fn(), nominateArbiter: jest.fn(), evictArbiter: jest.fn(), resignArbiter: mockResignArbiter, seatDefaultArbiter: jest.fn()
  })
}));
const mockApiFetch = jest.fn();
jest.mock('@/lib/apiFetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
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

  /**
   * contractservice lists the arbiter's /disputes screen by the seat it has recorded, so after a
   * seat action it is told to re-read the chain - and before the list is refreshed, or the list
   * comes back with the escrow the arbiter just left.
   */
  it('after resigning, records the note, has the seat re-read, then refreshes the list', async () => {
    const calls: string[] = [];
    mockResignArbiter.mockImplementation(async () => { calls.push('chain'); return '0xtx'; });
    mockApiFetch.mockImplementation(async (path: string) => { calls.push(path); return { ok: true, status: 200 }; });
    const onRefresh = jest.fn(() => { calls.push('list'); });

    render(<DisputeManagementModal isOpen onClose={jest.fn()} contract={contract} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resign as tiebreaker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, resign' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(calls).toEqual([
      'chain',
      '/api/contracts/contract-1/dispute',
      '/api/contracts/contract-1/arbiter-seat/refresh',
      'list'
    ]);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/contracts/contract-1/arbiter-seat/refresh', { method: 'POST' });
  });

  it('a failed seat refresh still refreshes the list', async () => {
    mockResignArbiter.mockResolvedValue('0xtx');
    mockApiFetch.mockImplementation(async (path: string) =>
      path.endsWith('/arbiter-seat/refresh') ? { ok: false, status: 503 } : { ok: true, status: 200 });
    const onRefresh = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<DisputeManagementModal isOpen onClose={jest.fn()} contract={contract} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resign as tiebreaker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, resign' }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(errorSpy).toHaveBeenCalledWith('Arbiter seat refresh failed: 503');
    errorSpy.mockRestore();
  });
});
