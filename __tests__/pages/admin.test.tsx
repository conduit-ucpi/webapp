import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useRouter } from 'next/router';
import AdminPage from '@/pages/admin';
import { useAuth } from '@/components/auth/AuthProvider';
import { Contract } from '@/types';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock AuthProvider
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// Mock LoadingSpinner
jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ className, size }: { className?: string; size?: string }) {
    return <div data-testid="loading-spinner" className={className}>Loading...</div>;
  };
});

// Mock ConnectWallet
jest.mock('@/components/auth/ConnectWallet', () => {
  return function MockConnectWallet() {
    return <div data-testid="connect-wallet">Connect Wallet</div>;
  };
});

// Mock UI components
jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

jest.mock('@/components/ui/Input', () => {
  return function MockInput(props: any) {
    return <input {...props} />;
  };
});

// Mock ContractCard component
jest.mock('@/components/contracts/ContractCard', () => {
  return function MockContractCard({ contract }: { contract: Contract }) {
    return (
      <div data-testid="contract-card">
        <div>Contract: {contract.contractAddress}</div>
        <div>Buyer: {contract.buyerAddress}</div>
        <div>Seller: {contract.sellerAddress}</div>
        <div>Amount: {contract.amount}</div>
        <div>Status: {contract.status}</div>
      </div>
    );
  };
});

// Mock PendingContractCard component
jest.mock('@/components/contracts/PendingContractCard', () => {
  return function MockPendingContractCard({ contract }: { contract: any }) {
    return (
      <div data-testid="pending-contract-card">
        <div>ID: {contract.id}</div>
        <div>Chain Address: {contract.chainAddress}</div>
        <div>Amount: {contract.amount}</div>
        <div>Currency: {contract.currency}</div>
        <div>Description: {contract.description}</div>
        <div>Buyer Email: {contract.buyerEmail}</div>
        <div>Seller Email: {contract.sellerEmail}</div>
      </div>
    );
  };
});

// Mock AdminContractList component
jest.mock('@/components/admin/AdminContractList', () => {
  return function MockAdminContractList({ onContractSelect }: { onContractSelect?: (contract: any) => void }) {
    return (
      <div data-testid="admin-contract-list">
        <div>All Contracts</div>
        <button onClick={() => onContractSelect?.({ id: 'test-contract', amount: 100 })}>
          Select Contract
        </button>
      </div>
    );
  };
});

// Mock global fetch
global.fetch = jest.fn();

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('AdminPage', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      basePath: '',
      pathname: '/admin',
      query: {},
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isLocaleDomain: false,
      isReady: true,
      defaultLocale: 'en',
      domainLocales: [],
      isPreview: false,
      asPath: '/admin',
      route: '/admin',
      reload: jest.fn(),
    } as any);

    jest.clearAllMocks();
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    render(<AdminPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows connect wallet prompt when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    render(<AdminPage />);
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('You need to connect your wallet to access this page.')).toBeInTheDocument();
  });

  it('shows access denied when user is not admin', () => {
    mockUseAuth.mockReturnValue({
      user: {
        userId: '1',
        email: 'user@example.com',
        walletAddress: '0x123',
        userType: 'user',
      },
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    render(<AdminPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You are not authorized to access this page.')).toBeInTheDocument();
    expect(screen.getByText('Current user: user@example.com')).toBeInTheDocument();
  });

  it('shows admin dashboard when user is admin', () => {
    mockUseAuth.mockReturnValue({
      user: {
        userId: '1',
        email: 'admin@example.com',
        walletAddress: '0x123',
        userType: 'admin',
      },
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    render(<AdminPage />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Administrative tools and system management')).toBeInTheDocument();
    expect(screen.getByTestId('admin-contract-list')).toBeInTheDocument();
  });

  it('shows contract details when contract is selected from list', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        userId: '1',
        email: 'admin@example.com',
        walletAddress: '0x123',
        userType: 'admin',
      },
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    // Mock the raw data API endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contractservice: {
          source: 'contractservice',
          data: { id: 'test-contract', amount: 100 }
        },
        chainservice: {
          source: 'chainservice',
          message: 'Contract not deployed to chain'
        }
      })
    } as any);

    render(<AdminPage />);

    const selectButton = screen.getByText('Select Contract');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Contract Details')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
      expect(screen.getByText('Raw Service Data')).toBeInTheDocument();
    });
  });

  it('can close contract details', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        userId: '1',
        email: 'admin@example.com',
        walletAddress: '0x123',
        userType: 'admin',
      },
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });

    // Mock the raw data API endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contractservice: {
          source: 'contractservice',
          data: { id: 'test-contract', amount: 100 }
        },
        chainservice: {
          source: 'chainservice',
          message: 'Contract not deployed to chain'
        }
      })
    } as any);

    render(<AdminPage />);

    // Select a contract first
    const selectButton = screen.getByText('Select Contract');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Contract Details')).toBeInTheDocument();
    });
    
    // Close the details
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Contract Details')).not.toBeInTheDocument();
  });

});

describe('Contract Selection and Details', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        userId: '1',
        email: 'admin@example.com',
        walletAddress: '0x123',
        userType: 'admin',
      },
      isLoading: false,
      provider: null,
      login: jest.fn(),
      logout: jest.fn(),
    });
  });

  it('displays selected contract details', async () => {
    // Mock the raw data API endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contractservice: {
          source: 'contractservice',
          data: { id: 'test-contract', amount: 100 }
        },
        chainservice: {
          source: 'chainservice',
          message: 'Contract not deployed to chain'
        }
      })
    } as any);

    render(<AdminPage />);

    // Initially no contract details shown
    expect(screen.queryByText('Contract Details')).not.toBeInTheDocument();

    // Select a contract
    const selectButton = screen.getByText('Select Contract');
    fireEvent.click(selectButton);

    // Contract details should appear
    await waitFor(() => {
      expect(screen.getByText('Contract Details')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  it('shows pending contract card for contracts without chain address', async () => {
    // Mock the raw data API endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contractservice: {
          source: 'contractservice',
          data: { id: 'test-contract', amount: 100 }
        },
        chainservice: {
          source: 'chainservice',
          message: 'Contract not deployed to chain'
        }
      })
    } as any);

    render(<AdminPage />);

    // Mock the AdminContractList to select a contract without chainAddress
    const mockAdminList = screen.getByTestId('admin-contract-list');
    const selectButton = within(mockAdminList).getByText('Select Contract');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText('Pending Contract')).toBeInTheDocument();
      expect(screen.getByTestId('pending-contract-card')).toBeInTheDocument();
    });
  });
});