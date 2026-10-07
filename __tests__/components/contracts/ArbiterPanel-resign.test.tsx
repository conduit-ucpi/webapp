import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import ArbiterPanel from '@/components/contracts/ArbiterPanel';

/**
 * The seated arbiter's own view of the seat (§3.3A1c).
 *
 * They are not a party, so the nominate and evict controls the parties get would only produce
 * reverts for them; what they get instead is resignation, behind a confirmation, with the
 * on-chain call first and the contractservice record second.
 */
const resignArbiter = jest.fn();
const nominateArbiter = jest.fn();

jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    nominateArbiter,
    evictArbiter: jest.fn(),
    resignArbiter,
    seatDefaultArbiter: jest.fn()
  })
}));

const seatedState: any = {
  contractAddress: '0xescrow',
  cohort: 'MARKETPLACE_CAPABLE',
  arbiter: '0xarbiter',
  seated: true,
  sold: false,
  nominationDeadline: null,
  nominationWindowSeconds: 259200,
  nominatedByBuyer: null,
  nominatedByRecipient: null,
  nominationsMatch: false,
  lastArbiterActionAt: 1_700_000_000,
  evictableAt: null,
  // A funded escrow: the parties may nominate a replacement (v0.9.5) ...
  canNominate: true,
  canSeatDefaultArbiter: false,
  canEvictArbiter: false
};

describe('ArbiterPanel as the seated arbiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resignArbiter.mockResolvedValue('0xtx');
  });

  it('offers resignation, confirmed, and records it after the chain call', async () => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    const calls: string[] = [];
    resignArbiter.mockImplementation(async () => { calls.push('chain'); return '0xtx'; });
    const onResigned = jest.fn().mockImplementation(async () => { calls.push('record'); });

    render(<ArbiterPanel contractAddress="0xescrow" state={seatedState} loading={false} onChanged={onChanged} viewerRole="arbiter" onResigned={onResigned} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resign as tiebreaker' }));
    expect(resignArbiter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, resign' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(resignArbiter).toHaveBeenCalledWith('0xescrow');
    expect(calls).toEqual(['chain', 'record']);
    expect(screen.getByText('You have left the seat.')).toBeInTheDocument();
  });

  it('does not offer the arbiter the parties’ nomination control', () => {
    render(<ArbiterPanel contractAddress="0xescrow" state={seatedState} loading={false} onChanged={jest.fn()} viewerRole="arbiter" />);

    expect(screen.queryByRole('button', { name: 'Nominate' })).toBeNull();
    expect(screen.queryByLabelText('Nominate a tiebreaker')).toBeNull();
  });

  it('a failed recording does not undo or hide the on-chain resignation', async () => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    const onResigned = jest.fn().mockRejectedValue(new Error('403'));
    render(<ArbiterPanel contractAddress="0xescrow" state={seatedState} loading={false} onChanged={onChanged} viewerRole="arbiter" onResigned={onResigned} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resign as tiebreaker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, resign' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.getByText('You have left the seat.')).toBeInTheDocument();
  });

  it('a party still sees the nomination control, not resignation', () => {
    render(<ArbiterPanel contractAddress="0xescrow" state={seatedState} loading={false} onChanged={jest.fn()} viewerRole="buyer" />);

    expect(screen.getByRole('button', { name: 'Nominate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resign as tiebreaker' })).toBeNull();
  });
});
