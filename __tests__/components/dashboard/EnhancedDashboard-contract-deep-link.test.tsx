/**
 * `?contract=` on the dashboard, which is where an AP2 receipt's manage_url points.
 *
 * ⚠️ THE PERSON FOLLOWING THAT LINK IS ARRIVING COLD. They were handed it by a payment an agent
 *    made on their behalf; they may have no Conduit account, and no idea which of the escrows on
 *    this page is theirs. Dropping them on a list to go hunting is the difference between a
 *    dispute window somebody uses and one they give up on — and the window closes either way.
 *
 * The failure mode this guards is silent: the link keeps working, the page still loads, and the
 * only symptom is a reviewer who never finds their escrow.
 */

import { render, screen, waitFor } from '@testing-library/react';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import { useAuth } from '@/components/auth';
import { useRouter } from 'next/router';
import { ToastProvider } from '@/components/ui/Toast';

const renderDashboard = () =>
  render(
    <ToastProvider>
      <EnhancedDashboard />
    </ToastProvider>
  );

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));

jest.mock('@/components/contracts/ContractDetailsModal', () => () => (
  <div data-testid="contract-details-modal" />
));
jest.mock('@/components/contracts/DisputeManagementModal', () => () => null);

const CONTRACT_ID = 'deployed-contract-def456';
const ESCROW_ADDRESS = '0xC20858a932bB9a3EE46eA9b97476726c7f15bCaF';

function contractsResponse() {
  return [
    {
      contract: {
        id: CONTRACT_ID,
        sellerEmail: 'seller@example.com',
        buyerEmail: 'buyer@example.com',
        amount: 1000000,
        currency: 'USDC',
        sellerAddress: '0xseller',
        buyerAddress: '0xbuyer',
        chainAddress: ESCROW_ADDRESS,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'An escrow somebody was handed a link to',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: '0xbuyer',
        state: 'OK',
        adminNotes: [],
      },
      status: 'ACTIVE',
      blockchainStatus: 'ACTIVE',
      blockchainFunded: true,
      ctaType: 'VIEW_DETAILS',
      ctaLabel: 'View Details',
      ctaVariant: 'secondary',
    },
  ];
}

function mockRouterQuery(query: Record<string, string>) {
  (useRouter as jest.Mock).mockReturnValue({
    pathname: '/dashboard',
    push: jest.fn(),
    query,
  });
}

function mockAuth() {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => contractsResponse(),
  });
  (useAuth as jest.Mock).mockReturnValue({
    user: { walletAddress: '0xbuyer', email: 'buyer@example.com' },
    isLoading: false,
    isConnected: true,
    isAuthenticated: true,
    error: null,
    address: '0xbuyer',
    state: {
      isConnected: true,
      isLoading: false,
      isInitialized: true,
      isAuthenticated: true,
      address: '0xbuyer',
      providerName: 'reown',
      capabilities: null,
      error: null,
    },
    connect: jest.fn(),
    authenticateBackend: jest.fn(),
    requestAuthentication: jest.fn(),
    disconnect: jest.fn(),
    switchWallet: jest.fn(),
    getEthersProvider: jest.fn(),
    showWalletUI: jest.fn(),
    getProviderUserInfo: jest.fn(),
    authenticatedFetch: fetchImpl,
    hasVisitedBefore: jest.fn(),
    refreshUserData: jest.fn(),
    claimFunds: jest.fn(),
    raiseDispute: jest.fn(),
  });
}

describe('EnhancedDashboard — ?contract= opens that escrow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
  });

  it('opens the named contract once the list has loaded', async () => {
    mockRouterQuery({ contract: CONTRACT_ID });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('contract-details-modal')).toBeInTheDocument());
  });

  it('matches on the escrow address too, since a receipt holder may not have our id', async () => {
    mockRouterQuery({ contract: ESCROW_ADDRESS });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('contract-details-modal')).toBeInTheDocument());
  });

  it('matches an address case-insensitively', async () => {
    // Addresses arrive checksummed from receipts and lower case from event logs. Refusing on
    // case would reject a correct link for a reason nobody could see.
    mockRouterQuery({ contract: ESCROW_ADDRESS.toLowerCase() });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('contract-details-modal')).toBeInTheDocument());
  });

  it('opens nothing when no contract is named', async () => {
    mockRouterQuery({});

    renderDashboard();

    await waitFor(() => expect(screen.queryByText(/An escrow somebody/i)).toBeInTheDocument());
    expect(screen.queryByTestId('contract-details-modal')).not.toBeInTheDocument();
  });

  it('leaves the dashboard usable when the link names something that is not there', async () => {
    // A stale or mistyped link. Raising an error at somebody who cannot do anything about it
    // would be worse than showing them the list they can at least search.
    mockRouterQuery({ contract: 'no-such-contract' });

    renderDashboard();

    await waitFor(() => expect(screen.queryByText(/An escrow somebody/i)).toBeInTheDocument());
    expect(screen.queryByTestId('contract-details-modal')).not.toBeInTheDocument();
  });
});
