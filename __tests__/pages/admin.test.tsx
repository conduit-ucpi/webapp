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

  describe('Pending Contract Functionality', () => {
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

    it('should fetch and display both deployed and pending contracts', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        expiryTimestamp: 1753749402,
        description: 'Deployed contract',
        status: 'ACTIVE',
        createdAt: '2025-07-29T07:53:08.257664303Z',
      };

      const pendingContractResponse = {
        id: '123',
        chainAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        amount: 15000,
        currency: 'USDC',
        description: 'Pending contract',
        buyerEmail: 'buyer@example.com',
        sellerEmail: 'seller@example.com',
        expiryTimestamp: 1753749402,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pendingContractResponse,
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByTestId('pending-contract-card')).toBeInTheDocument();
      });

      // Verify both API calls were made
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/contract?contractAddress=0x9d6018989136ba15157e9a020c12adcc50f5ca4e');
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/pending-contract?contractAddress=0x9d6018989136ba15157e9a020c12adcc50f5ca4e');

      // Verify deployed contract section
      expect(screen.getByText('Deployed Contract Details')).toBeInTheDocument();
      expect(screen.getByText('Contract: 0x9d6018989136ba15157e9a020c12adcc50f5ca4e')).toBeInTheDocument();

      // Verify pending contract section
      expect(screen.getByText('Pending Contract Details')).toBeInTheDocument();
      expect(screen.getByText('ID: 123')).toBeInTheDocument();
      expect(screen.getByText('Amount: 15000')).toBeInTheDocument();
      expect(screen.getByText('Currency: USDC')).toBeInTheDocument();
      expect(screen.getByText('Buyer Email: buyer@example.com')).toBeInTheDocument();
      expect(screen.getByText('Seller Email: seller@example.com')).toBeInTheDocument();
    });

    it('should show pending contract not found message when no pending contract exists', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Pending contract not found for this address' }),
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('No pending contract found for this address')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('pending-contract-card')).not.toBeInTheDocument();
    });

    it('should handle pending contract API error gracefully', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });

    it('should handle network error for pending contract request', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show clear button when pending contract data exists', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      const pendingContractResponse = {
        id: '123',
        chainAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        amount: 15000,
        currency: 'USDC',
        description: 'Pending contract',
        buyerEmail: 'buyer@example.com',
        sellerEmail: 'seller@example.com',
        expiryTimestamp: 1753749402,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pendingContractResponse,
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByTestId('pending-contract-card')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('should clear both deployed and pending contract data when clear button is clicked', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      const pendingContractResponse = {
        id: '123',
        chainAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        amount: 15000,
        currency: 'USDC',
        description: 'Pending contract',
        buyerEmail: 'buyer@example.com',
        sellerEmail: 'seller@example.com',
        expiryTimestamp: 1753749402,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pendingContractResponse,
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByTestId('pending-contract-card')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);

      expect(screen.queryByTestId('contract-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pending-contract-card')).not.toBeInTheDocument();
      expect(input).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('should show clear button when pending error exists even without contract data', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Pending contract not found for this address' }),
        } as Response);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('No pending contract found for this address')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('should continue displaying deployed contract when pending contract fetch fails', async () => {
      const deployedContractResponse = {
        contractAddress: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e',
        buyer: '0x43cd4ede85fa5334050325985cfdd9b1ce58671a',
        seller: '0x20e00e24101d8d7a330ba3a6aaa655d7766e7c1b',
        amount: 20000,
        status: 'ACTIVE',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => deployedContractResponse,
        } as Response)
        .mockRejectedValueOnce(new Error('Service unavailable'));

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const searchButton = screen.getByRole('button', { name: 'Search' });

      fireEvent.change(input, { target: { value: '0x9d6018989136ba15157e9a020c12adcc50f5ca4e' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      });

      // Deployed contract should still be visible
      expect(screen.getByText('Deployed Contract Details')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-contract-card')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { userType: 'admin', walletAddress: '0x123' },
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
      });
    });

    it('returns early when contract address is empty or whitespace only', async () => {
      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const form = input.closest('form');

      // Test empty string
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.submit(form!);

      // Test whitespace only
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(form!);

      // Should not make any fetch calls
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles malformed error response JSON', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock a response that fails JSON parsing
      const mockResponse = {
        ok: false,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '0x123' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch contract')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('handles pending contract fetch with malformed JSON response', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // First call succeeds (deployed contract)
      const deployedContractResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          contractAddress: '0x123',
          buyer: '0xbuyer',
          seller: '0xseller',
          amount: '100',
          status: 'active'
        })
      };

      // Second call has non-404 error status (pending contract)
      const pendingContractResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Server error' })
      };

      mockFetch
        .mockResolvedValueOnce(deployedContractResponse as any)
        .mockResolvedValueOnce(pendingContractResponse as any);

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '0x123' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('handles network errors during pending contract fetch', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // First call succeeds (deployed contract)
      const deployedContractResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          contractAddress: '0x123',
          buyer: '0xbuyer',
          seller: '0xseller',
          amount: '100',
          status: 'active'
        })
      };

      mockFetch
        .mockResolvedValueOnce(deployedContractResponse as any)
        .mockRejectedValueOnce(new Error('Network error'));

      render(<AdminPage />);

      const input = screen.getByPlaceholderText('Enter contract address (0x...)');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '0x123' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByTestId('contract-card')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Pending contract search failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});