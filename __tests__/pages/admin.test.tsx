import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Contract Search')).toBeInTheDocument();
  });

  it('maps API response correctly when searching for contract', async () => {
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

    // Mock API response with backend field names
    const mockApiResponse = {
      contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
      buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
      seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
      amount: 20000,
      expiryTimestamp: 1753749402,
      description: 'Reverse problem',
      funded: true,
      status: 'CLAIMED',
      createdAt: '2025-07-29T07:53:08.257664303Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    render(<AdminPage />);

    const input = screen.getByPlaceholderText('Enter contract address (0x...)');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('contract-card')).toBeInTheDocument();
    });

    // Verify the mapping worked correctly
    expect(screen.getByText('Contract: 0x9d6018989136ba15157e9a020c12adcc50f5ca4e')).toBeInTheDocument();
    expect(screen.getByText('Buyer: 0x43cd4ede85fa5334050325985cfdd9b1ce58671a')).toBeInTheDocument();
    expect(screen.getByText('Seller: 0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b')).toBeInTheDocument();
    expect(screen.getByText('Amount: 20000')).toBeInTheDocument();
    expect(screen.getByText('Status: CLAIMED')).toBeInTheDocument();
  });

  it('handles API response with existing field names', async () => {
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

    // Mock API response with frontend field names (already correct)
    const mockApiResponse = {
      contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
      buyerAddress: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
      sellerAddress: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
      amount: 20000,
      expiryTimestamp: 1753749402,
      description: 'Reverse problem',
      funded: true,
      status: 'CLAIMED',
      createdAt: '2025-07-29T07:53:08.257664303Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    render(<AdminPage />);

    const input = screen.getByPlaceholderText('Enter contract address (0x...)');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('contract-card')).toBeInTheDocument();
    });

    // Verify existing field names still work
    expect(screen.getByText('Contract: 0x9d6018989136ba15157e9a020c12adcc50f5ca4e')).toBeInTheDocument();
    expect(screen.getByText('Buyer: 0x43cd4ede85fa5334050325985cfdd9b1ce58671a')).toBeInTheDocument();
    expect(screen.getByText('Seller: 0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b')).toBeInTheDocument();
  });

  it('handles API error correctly', async () => {
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

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Contract not found' }),
    } as Response);

    render(<AdminPage />);

    const input = screen.getByPlaceholderText('Enter contract address (0x...)');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    fireEvent.change(input, { target: { value: '0xinvalid' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Contract not found')).toBeInTheDocument();
    });
  });

  it('clears search results when clear button is clicked', async () => {
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

    const mockApiResponse = {
      contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
      buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
      seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
      amount: 20000,
      expiryTimestamp: 1753749402,
      description: 'Reverse problem',
      status: 'CLAIMED',
      createdAt: '2025-07-29T07:53:08.257664303Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    render(<AdminPage />);

    const input = screen.getByPlaceholderText('Enter contract address (0x...)');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('contract-card')).toBeInTheDocument();
    });

    const clearButton = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(clearButton);

    expect(screen.queryByTestId('contract-card')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});