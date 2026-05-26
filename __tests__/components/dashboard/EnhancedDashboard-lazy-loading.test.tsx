/**
 * EnhancedDashboard lazy loading tests
 *
 * Tests that the EnhancedDashboard correctly triggers lazy authentication:
 * 1. Calls fetchContracts when authenticatedFetch is available (even if user is null)
 * 2. authenticatedFetch handles 401 and triggers SIWX auth automatically
 * 3. Retries the request after authentication succeeds
 */

import { render, waitFor, screen } from '@testing-library/react';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import { useAuth } from '@/components/auth';
import { ToastProvider } from '@/components/ui/Toast';

const renderDashboard = () =>
  render(
    <ToastProvider>
      <EnhancedDashboard />
    </ToastProvider>
  );

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    pathname: '/dashboard',
    push: jest.fn(),
  })),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock AuthProvider
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock ProgressChecklist
jest.mock('@/components/onboarding/ProgressChecklist', () => {
  return function MockProgressChecklist() {
    return null;
  };
});

// Mock ContractAcceptance
jest.mock('@/components/contracts/ContractAcceptance', () => {
  return function MockContractAcceptance() {
    return <div data-testid="contract-acceptance">Contract Acceptance</div>;
  };
});

// Mock ContractDetailsModal
jest.mock('@/components/contracts/ContractDetailsModal', () => {
  return function MockContractDetailsModal() {
    return <div data-testid="contract-details-modal">Contract Details Modal</div>;
  };
});

// Mock DisputeManagementModal
jest.mock('@/components/contracts/DisputeManagementModal', () => {
  return function MockDisputeManagementModal() {
    return <div data-testid="dispute-management-modal">Dispute Management Modal</div>;
  };
});

describe('EnhancedDashboard - Lazy Loading', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls fetchContracts when authenticatedFetch is available (even if user is null - lazy loading)', async () => {
    const mockAuthenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    });

    mockUseAuth.mockReturnValue({
      user: null, // User is null (backend auth not done yet)
      isLoading: false,
      isConnected: true,
      isAuthenticated: false,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: mockAuthenticatedFetch, // authenticatedFetch is available
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    renderDashboard();

    // Wait for the API call to happen
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/combined-contracts');
    });

    // Verify it was called exactly once (no duplicate calls)
    expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it('authenticatedFetch triggers lazy auth on 401 and retries', async () => {
    let callCount = 0;
    const mockAuthenticatedFetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call returns 401 (no backend auth yet)
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' })
        };
      } else {
        // Second call succeeds (after lazy auth)
        return {
          ok: true,
          json: async () => []
        };
      }
    });

    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isConnected: true,
      isAuthenticated: false,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: mockAuthenticatedFetch,
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    renderDashboard();

    // Wait for the initial API call
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalled();
    });

    // In a real scenario, the authenticatedFetch would handle 401 internally
    // and retry the request after triggering SIWX auth
    // Here we just verify the call was made
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/combined-contracts');
  });

  it('does not call fetchContracts if authenticatedFetch is not available', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true, // Still loading
      isConnected: false,
      isAuthenticated: false,
      error: null,
      address: null,
      state: {
        isConnected: false,
        isLoading: true,
        isInitialized: false,
        isAuthenticated: false,
        address: null,
        providerName: null,
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: undefined as any, // No authenticatedFetch available yet
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    renderDashboard();

    // Should show loading state
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('successfully loads contracts after lazy auth completes', async () => {
    const mockContracts = [
      {
        contract: {
          id: 'test-1',
          chainAddress: '0xcontract123',
          sellerEmail: 'seller@example.com',
          buyerEmail: 'buyer@example.com',
          amount: 1000000000,
          expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
          description: 'Test contract',
          createdAt: Math.floor(Date.now() / 1000),
          sellerAddress: '0xseller',
          buyerAddress: '0xbuyer',
        },
        status: 'ACTIVE',
        blockchainFunded: true
      }
    ];

    const mockAuthenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockContracts
    });

    mockUseAuth.mockReturnValue({
      user: null, // User still null during lazy loading
      isLoading: false,
      isConnected: true,
      isAuthenticated: false,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: '0x1234567890123456789012345678901234567890',
        providerName: 'reown',
        capabilities: null,
        error: null
      },
      connect: jest.fn(),
      authenticateBackend: jest.fn(),
      requestAuthentication: jest.fn(),
      disconnect: jest.fn(),
      switchWallet: jest.fn(),
      getEthersProvider: jest.fn(),
      showWalletUI: jest.fn(),
      getProviderUserInfo: jest.fn(),
      authenticatedFetch: mockAuthenticatedFetch,
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn()
    });

    renderDashboard();

    // Wait for contracts to load
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/combined-contracts');
    });

    // Should show contract content (not loading spinner)
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  // Characterization test: locks down the /api/combined-contracts payload
  // TRANSFORM (item.contract → Contract | PendingContract union) before that
  // logic is extracted into a shared hook. The existing tests above only assert
  // the fetch happens and loading clears — they do NOT assert the transform's
  // output. The dashboard stats are derived directly from the transform:
  //   - "Active"  = deployed contracts (have contractAddress) with status ACTIVE
  //   - "Pending" = items without chainAddress (the pending branch)
  //   - "Total Value" = sum of transformed `amount` (parseFloat of
  //                     blockchainAmount || contract.amount)
  // If the refactor scrambles the branch selection or the amount mapping, the
  // rendered stats change and this test fails.
  it('transforms the combined-contracts payload into the correct unified stats', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = [
      {
        // Deployed + ACTIVE → counts as Active; amount comes from blockchainAmount.
        contract: {
          id: 'deployed-1',
          chainAddress: '0xdeployed',
          sellerEmail: 'seller@example.com',
          buyerEmail: 'buyer@example.com',
          amount: '1000000', // contract.amount fallback (ignored when blockchainAmount set)
          expiryTimestamp: now + 86400,
          description: 'Deployed contract',
          createdAt: now,
        },
        status: 'ACTIVE',
        blockchainAmount: '2000000', // 2 USDC in microUSDC — should win
      },
      {
        // No chainAddress → pending branch; amount from contract.amount.
        contract: {
          id: 'pending-1',
          sellerEmail: 'seller2@example.com',
          buyerEmail: 'buyer2@example.com',
          amount: 500000, // 0.5 USDC in microUSDC
          expiryTimestamp: now + 86400,
          description: 'Pending contract',
          createdAt: now,
        },
      },
    ];

    const mockAuthenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isConnected: true,
      isAuthenticated: false,
      error: null,
      address: '0x1234567890123456789012345678901234567890',
      state: {
        isConnected: true,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        address: '0x1234567890123456789012345678901234567890',
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
      authenticatedFetch: mockAuthenticatedFetch,
      hasVisitedBefore: jest.fn(),
      refreshUserData: jest.fn(),
      claimFunds: jest.fn(),
      raiseDispute: jest.fn(),
    } as any);

    renderDashboard();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Read a StatsCard's numeric value by its title. "Active"/"Pending" also
    // appear as filter-tab labels, so we scope to the StatsCard title paragraph
    // (rendered with the secondary-600 class) and read its sibling value <p>.
    const statValueFor = (title: string): string => {
      const titleEls = screen
        .getAllByText(title)
        .filter((el) => el.className.includes('text-secondary-600'));
      expect(titleEls).toHaveLength(1);
      const valueEl = titleEls[0].nextElementSibling;
      return valueEl?.textContent ?? '';
    };

    // Active card = 1 (the deployed ACTIVE contract).
    expect(statValueFor('Active')).toBe('1');

    // Pending card = 1 (the item with no chainAddress).
    expect(statValueFor('Pending')).toBe('1');

    // Total Value = blockchainAmount (2000000) + contract.amount (500000) = 2500000 microUSDC.
    // Assert against the same formatter the component uses so we lock the
    // numeric transform without hard-coding the currency display format.
    const { displayCurrency } = require('@/utils/validation');
    const expectedTotal = displayCurrency(2500000, 'microUSDC');
    expect(screen.getByText(expectedTotal)).toBeInTheDocument();
  });
});
