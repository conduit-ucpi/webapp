import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import AdminContractList from '@/components/admin/AdminContractList';
import { PendingContract } from '@/types';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ size }: { size?: string }) {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

jest.mock('@/components/ui/Input', () => {
  return function MockInput(props: any) {
    return <input {...props} />;
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

jest.mock('@/components/ui/ExpandableHash', () => {
  return function MockExpandableHash({ hash }: { hash: string }) {
    return <span data-testid="expandable-hash">{hash}</span>;
  };
});

jest.mock('@/utils/validation', () => ({
  formatUSDC: (amount: number) => amount.toFixed(2),
  formatExpiryDate: (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString()
}));

// Mock global fetch
global.fetch = jest.fn();

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const mockContracts: PendingContract[] = [
  {
    id: '1',
    sellerEmail: 'seller1@example.com',
    buyerEmail: 'buyer1@example.com',
    amount: 1000,
    currency: 'USDC',
    sellerAddress: '0xseller1',
    expiryTimestamp: 1753749402,
    chainAddress: '0x123',
    description: 'Test contract 1',
    createdAt: '2025-01-01T00:00:00Z',
    createdBy: 'user1'
  },
  {
    id: '2',
    sellerEmail: 'seller2@example.com',
    amount: 2000,
    currency: 'USDC',
    sellerAddress: '0xseller2',
    expiryTimestamp: 1753749402,
    description: 'Test contract 2',
    createdAt: '2025-01-02T00:00:00Z',
    createdBy: 'user2'
  }
];

describe('AdminContractList', () => {
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

  it('renders loading spinner initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AdminContractList />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('renders contract table with data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('All Contracts')).toBeInTheDocument();
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
      expect(screen.getByText('$1000.00 USDC')).toBeInTheDocument();
      expect(screen.getByText('$2000.00 USDC')).toBeInTheDocument();
    });
  });

  it('filters contracts by search term', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search contracts...');
    fireEvent.change(searchInput, { target: { value: 'seller1' } });

    expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    expect(screen.queryByText('seller2@example.com')).not.toBeInTheDocument();
  });

  it('filters contracts by status', async () => {
    const contractsWithStatus = mockContracts.map((contract, index) => ({
      ...contract,
      status: index === 0 ? 'ACTIVE' : 'PENDING'
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractsWithStatus
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
    });

    const statusFilter = screen.getByDisplayValue('All Status');
    fireEvent.change(statusFilter, { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.queryByText('seller2@example.com')).not.toBeInTheDocument();
    });
  });

  it('filters contracts by chain address presence', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
    });

    const chainFilter = screen.getByDisplayValue('All Types');
    fireEvent.change(chainFilter, { target: { value: 'YES' } });

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.queryByText('seller2@example.com')).not.toBeInTheDocument();
    });
  });

  it('sorts contracts by different fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('All Contracts')).toBeInTheDocument();
    });

    // Click on amount column to sort
    const amountHeader = screen.getByText(/Amount/);
    fireEvent.click(amountHeader);

    // Should show sort indicator
    expect(screen.getByText(/Amount ↑/)).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    // Create more contracts than default page size
    const manyContracts = Array.from({ length: 30 }, (_, i) => ({
      ...mockContracts[0],
      id: `contract-${i}`,
      sellerEmail: `seller${i}@example.com`,
      amount: 1000 + i
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => manyContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('changes items per page', async () => {
    const manyContracts = Array.from({ length: 30 }, (_, i) => ({
      ...mockContracts[0],
      id: `contract-${i}`,
      sellerEmail: `seller${i}@example.com`
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => manyContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument(); // 25 per page default
    });

    const itemsPerPageSelect = screen.getByDisplayValue('25');
    fireEvent.change(itemsPerPageSelect, { target: { value: '10' } });

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument(); // Now 10 per page
  });

  it('calls onContractSelect when row is clicked', async () => {
    const mockOnContractSelect = jest.fn();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList onContractSelect={mockOnContractSelect} />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    const firstRow = screen.getByText('seller1@example.com').closest('tr');
    fireEvent.click(firstRow!);

    expect(mockOnContractSelect).toHaveBeenCalledWith(mockContracts[0]);
  });

  it('shows empty state when no contracts match filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search contracts...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No contracts match your filters')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    // Apply filters
    const searchInput = screen.getByPlaceholderText('Search contracts...');
    fireEvent.change(searchInput, { target: { value: 'seller1' } });

    const statusFilter = screen.getByDisplayValue('All Status');
    fireEvent.change(statusFilter, { target: { value: 'ACTIVE' } });

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Types')).toBeInTheDocument();
  });

  it('retries fetch when try again button is clicked', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    // Mock successful retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContracts
    } as Response);

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });
  });
});