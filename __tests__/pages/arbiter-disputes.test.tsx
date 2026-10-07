import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import ArbiterDisputesPage from '@/pages/ArbiterDisputesPage';

/**
 * The tiebreaker's screen lists the escrows naming them (contractservice `?role=arbiter`) and
 * opens the SAME dispute modal the parties use. The modal is mocked here; its behaviour for an
 * arbiter viewer is pinned in its own tests.
 */
const fetcher = jest.fn();
let connected = true;

jest.mock('@/components/auth', () => ({
  useAuth: () => ({ isLoading: false, isConnected: connected, authenticatedFetch: fetcher, user: { walletAddress: '0xarbiter' } })
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { tokenSymbol: 'USDC' } })
}));
jest.mock('@/components/ui/FarcasterNameDisplay', () => function MockName({ walletAddress, identifier }: any) {
  return <span>{identifier || walletAddress}</span>;
});
jest.mock('@/components/contracts/DisputeManagementModal', () => function MockModal({ isOpen, contract }: any) {
  return isOpen ? <div data-testid="dispute-modal">modal for {contract.id}</div> : null;
});

function item(id: string, status: string, chainAddress = '0x' + id) {
  return {
    contract: {
      id, chainAddress, buyerEmail: 'buyer@test.com', sellerEmail: 'seller@test.com',
      buyerAddress: '0xbuyer', sellerAddress: '0xseller', amount: 5_000_000, expiryTimestamp: 1_800_000_000,
      description: `Escrow ${id}`, createdAt: 0, arbiterAddress: '0xarbiter', disputes: status === 'DISPUTED' ? [{ reason: 'x', refundPercent: 100, userEmail: 'buyer@test.com', timestamp: 1 }] : []
    },
    status, blockchainStatus: status, ctaType: 'NONE', ctaLabel: '', ctaVariant: 'STATUS'
  };
}

describe('ArbiterDisputesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connected = true;
    fetcher.mockResolvedValue({ ok: true, json: async () => [item('d1', 'DISPUTED'), item('a1', 'ACTIVE'), item('c1', 'CLAIMED')] });
  });

  it('asks contractservice for the arbiter role and groups disputed escrows first', async () => {
    render(<ArbiterDisputesPage />);

    await waitFor(() => expect(screen.getByText('Escrow d1')).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledWith('/api/combined-contracts?role=arbiter');

    expect(screen.getByText('Needs your decision')).toBeInTheDocument();
    expect(screen.getByText('Other escrows naming you as tiebreaker')).toBeInTheDocument();
    expect(screen.getByText('Escrow a1')).toBeInTheDocument();
    // Closed escrows have no seat worth showing.
    expect(screen.queryByText('Escrow c1')).toBeNull();
  });

  it('opens the shared dispute modal for the chosen escrow', async () => {
    render(<ArbiterDisputesPage />);
    await waitFor(() => expect(screen.getByText('Escrow d1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Review dispute' }));

    expect(screen.getByTestId('dispute-modal')).toHaveTextContent('modal for d1');
  });

  it('says so when nobody has named the viewer', async () => {
    fetcher.mockResolvedValue({ ok: true, json: async () => [] });
    render(<ArbiterDisputesPage />);

    await waitFor(() => expect(screen.getByText('Nobody has named you as a tiebreaker yet.')).toBeInTheDocument());
  });

  it('asks a signed-out visitor to sign in rather than fetching', () => {
    connected = false;
    render(<ArbiterDisputesPage />);

    expect(screen.getByText('Sign in to see the disputes you have been asked to decide.')).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
