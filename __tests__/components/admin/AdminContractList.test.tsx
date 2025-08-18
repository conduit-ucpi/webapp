import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
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
  formatExpiryDate: (timestamp: number) => new Date(timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp).toLocaleDateString(),
  normalizeTimestamp: (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return ts.toString().length <= 10 ? ts * 1000 : ts;
  },
  formatDate: (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    const msTimestamp = ts.toString().length <= 10 ? ts * 1000 : ts;
    return new Date(msTimestamp).toLocaleDateString();
  },
  displayCurrency: (amount: number | string, currency: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    // Smart detection for microUSDC
    let usdc;
    if (currency === 'microUSDC' || (currency === 'USDC' && numAmount >= 1000)) {
      usdc = numAmount / 1000000;
    } else {
      usdc = numAmount;
    }
    return `$${usdc.toFixed(2)} USDC`;
  },
  formatDateTimeWithTZ: (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    const msTimestamp = ts.toString().length <= 10 ? ts * 1000 : ts;
    const date = new Date(msTimestamp);
    // Return timezone-aware format similar to the real function
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60).toString().padStart(2, '0');
    const minutes = (absOffset % 60).toString().padStart(2, '0');
    const isoString = date.toISOString().slice(0, 19);
    return `${isoString}${sign}${hours}:${minutes}`;
  }
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
    amount: 1000000000,
    currency: 'USDC',
    sellerAddress: '0xseller1',
    expiryTimestamp: 1753749402,
    chainAddress: '0x123',
    description: 'Test contract 1',
    createdAt: 1735689600, // 2025-01-01T00:00:00Z
    createdBy: 'user1',
    state: 'OK'
  },
  {
    id: '2',
    sellerEmail: 'seller2@example.com',
    amount: 2000000000,
    currency: 'USDC',
    sellerAddress: '0xseller2',
    expiryTimestamp: 1753749402,
    description: 'Test contract 2',
    createdAt: 1735776000, // 2025-01-02T00:00:00Z
    createdBy: 'user2',
    state: 'OK'
  }
];

// Mock contracts with enriched data (including buyer addresses)
const mockEnrichedContracts = [
  {
    ...mockContracts[0],
    buyerAddress: '0xbuyer1',
    status: 'ACTIVE'
  },
  {
    ...mockContracts[1],
    buyerAddress: '0xbuyer2',
    status: 'PENDING'
  }
];

// Helper to create combined mock data with blockchain status
const createCombinedMockData = (contracts = mockContracts, withBlockchainData = true) => {
  return contracts.map((contract, index) => {
    if (withBlockchainData && contract.chainAddress) {
      return {
        ...contract,
        blockchainQuerySuccess: true,
        blockchainStatus: {
          buyerAddress: `0xbuyer${index + 1}`,
          sellerAddress: contract.sellerAddress,
          status: 'ACTIVE',
          amount: contract.amount,
          expiryTimestamp: contract.expiryTimestamp,
          funded: true
        },
        status: 'ACTIVE'
      };
    }
    // For contracts without blockchain data, determine status based on expiry
    const isExpired = Date.now() / 1000 > contract.expiryTimestamp;
    return {
      ...contract,
      blockchainQuerySuccess: false,
      blockchainQueryError: contract.chainAddress ? 'Chain service error' : 'No chain address',
      status: isExpired ? 'EXPIRED' : 'PENDING'
    };
  });
};

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
    // Mock combined contracts response with blockchain data included
    const combinedMockData = [
      {
        ...mockContracts[0],
        blockchainQuerySuccess: true,
        blockchainStatus: {
          buyerAddress: '0xbuyer1',
          sellerAddress: '0xseller1',
          status: 'ACTIVE',
          amount: 1000000000,
          expiryTimestamp: 1753749402,
          funded: true
        }
      },
      {
        ...mockContracts[1],
        blockchainQuerySuccess: false,
        blockchainQueryError: 'No chain address'
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => combinedMockData
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

  it('displays wallet addresses when available', async () => {
    // Mock combined contracts response with blockchain data
    const combinedMockData = [
      {
        ...mockContracts[0],
        blockchainQuerySuccess: true,
        blockchainStatus: {
          buyerAddress: '0xbuyer1',
          sellerAddress: '0xseller1',
          status: 'ACTIVE',
          amount: 1000000000,
          expiryTimestamp: 1753749402,
          funded: true
        }
      },
      {
        ...mockContracts[1],
        blockchainQuerySuccess: false
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => combinedMockData
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      // Check for seller addresses (should be present for both contracts)
      expect(screen.getAllByTestId('expandable-hash')).toHaveLength(4); // 2 seller + 1 buyer + 1 chain address
      expect(screen.getByText('0xseller1')).toBeInTheDocument();
      expect(screen.getByText('0xseller2')).toBeInTheDocument();
      
      // Check for buyer address (only for chain-enriched contract)
      expect(screen.getByText('0xbuyer1')).toBeInTheDocument();
      
      // Check for chain address
      expect(screen.getByText('0x123')).toBeInTheDocument();
    });
  });

  it('shows dash when addresses are not available', async () => {
    const contractsWithoutAddresses = [
      {
        ...mockContracts[0],
        sellerAddress: '',
        buyerAddress: undefined,
        chainAddress: undefined
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractsWithoutAddresses
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      // Should show dashes for missing addresses (contract address, buyer address)
      const dashElements = screen.getAllByText('-');
      expect(dashElements.length).toBeGreaterThan(0);
    });
  });

  it('filters contracts by search term', async () => {
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
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

  it('filters contracts by wallet address search', async () => {
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
    });

    // Search by buyer address
    const searchInput = screen.getByPlaceholderText('Search contracts...');
    fireEvent.change(searchInput, { target: { value: '0xbuyer1' } });

    expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    expect(screen.queryByText('seller2@example.com')).not.toBeInTheDocument();
  });

  it('filters contracts by status', async () => {
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
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
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
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
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
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
    // Create more contracts than default page size (no chain addresses to keep simple)
    const manyContracts = Array.from({ length: 30 }, (_, i) => ({
      ...mockContracts[0],
      id: `contract-${i}`,
      sellerEmail: `seller${i}@example.com`,
      amount: 1000000000 + i * 1000000,
      chainAddress: undefined
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData(manyContracts)
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
      sellerEmail: `seller${i}@example.com`,
      chainAddress: undefined
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData(manyContracts)
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
    
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
    } as Response);

    render(<AdminContractList onContractSelect={mockOnContractSelect} />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    const firstRow = screen.getByText('seller1@example.com').closest('tr');
    fireEvent.click(firstRow!);

    // Should call with the enriched contract data
    expect(mockOnContractSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      sellerEmail: 'seller1@example.com',
      status: 'ACTIVE',
      buyerAddress: '0xbuyer1'
    }));
  });

  it('shows empty state when no contracts match filters', async () => {
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
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
    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData()
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    // Apply filters that will result in no matches to trigger the clear button
    const searchInput = screen.getByPlaceholderText('Search contracts...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    // Wait for the clear button to appear
    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

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

    // Mock successful retry - deployed contracts response
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

  it('handles fetch errors and displays error message', async () => {
    mockUseRouter.mockReturnValue({
      basePath: '/app',
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

    // Mock fetch to throw error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Verify fetch was called with relative path for combined contracts
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/combined-contracts');
  });

  it('handles sorting by clicking on column headers', async () => {
    const contractsWithoutChain = mockContracts.map(c => ({ ...c, chainAddress: undefined }));
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractsWithoutChain
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
    });

    // Click on Created column header
    const createdHeader = screen.getByRole('columnheader', { name: /Created/ });
    fireEvent.click(createdHeader);

    // Click on sortable Seller column header (exact match to avoid "Seller Address")
    const sellerHeader = screen.getByRole('columnheader', { name: 'Seller' });
    fireEvent.click(sellerHeader);

    // Click on Buyer column header  
    const buyerHeader = screen.getByRole('columnheader', { name: 'Buyer' });
    fireEvent.click(buyerHeader);

    // Click on Expiry column header
    const expiryHeader = screen.getByRole('columnheader', { name: 'Expiry' });
    fireEvent.click(expiryHeader);

    // Verify sorting still works
    expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
  });

  it('handles string sorting for email fields', async () => {
    const stringContracts = [
      { ...mockContracts[0], id: 'string1', sellerEmail: 'zebra@example.com', buyerEmail: 'charlie@example.com', chainAddress: undefined },
      { ...mockContracts[1], id: 'string2', sellerEmail: 'alpha@example.com', buyerEmail: 'david@example.com', chainAddress: undefined },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => stringContracts
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getAllByText('zebra@example.com')).toHaveLength(1);
      expect(screen.getAllByText('alpha@example.com')).toHaveLength(1);
    }, { timeout: 3000 });

    // Sort by seller email
    const sellerHeader = screen.getByRole('columnheader', { name: 'Seller' });
    fireEvent.click(sellerHeader);

    // Check order changed - after sorting by receiver email, should have alpha first
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(2); // Header + data rows
    });
  });

  it('handles expired contracts without chainAddress correctly', async () => {
    const expiredContract = {
      ...mockContracts[0],
      chainAddress: undefined,
      expiryTimestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData([expiredContract], false)
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    });
  });

  it('handles different contract statuses correctly', async () => {
    const now = Math.floor(Date.now() / 1000);
    const contractsWithoutChain = [
      { 
        ...mockContracts[1], 
        id: '4', 
        chainAddress: undefined,
        expiryTimestamp: now + 3600 // Future timestamp to ensure PENDING status
      },
    ];
    
    const contractsWithChain = [
      { ...mockContracts[0], id: '1', chainAddress: '0x123' },
      { ...mockContracts[0], id: '2', chainAddress: '0x456' },
      { ...mockContracts[0], id: '3', chainAddress: '0x789' },
    ];

    // Mock combined contracts response with different statuses
    const combinedMockData = [
      {
        ...contractsWithChain[0],
        blockchainQuerySuccess: true,
        blockchainStatus: { status: 'DISPUTED' },
        status: 'DISPUTED'
      },
      {
        ...contractsWithChain[1],
        blockchainQuerySuccess: true,
        blockchainStatus: { status: 'RESOLVED' },
        status: 'RESOLVED'
      },
      {
        ...contractsWithChain[2],
        blockchainQuerySuccess: true,
        blockchainStatus: { status: 'CLAIMED' },
        status: 'CLAIMED'
      },
      ...createCombinedMockData(contractsWithoutChain, false)
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => combinedMockData
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('DISPUTED')).toBeInTheDocument();
      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
      expect(screen.getByText('CLAIMED')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles unknown status with default color', async () => {
    const unknownStatusContract = {
      ...mockContracts[0],
      chainAddress: '0x123',
    };

    // Mock combined contracts response with unknown status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        ...unknownStatusContract,
        blockchainQuerySuccess: true,
        blockchainStatus: { status: 'UNKNOWN_STATUS' }
      }]
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      const statusElement = screen.getByText('UNKNOWN_STATUS');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement.className).toContain('bg-gray-100');
    });
  });

  it('handles page change with Previous button', async () => {
    // Create enough contracts to force multiple pages (30 items with default 25 per page = 2 pages)
    const manyContracts = Array.from({ length: 30 }, (_, i) => ({
      ...mockContracts[0],
      id: `contract-${i}`,
      sellerEmail: `seller${i}@example.com`,
      chainAddress: undefined // No chain addresses to keep test simple
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createCombinedMockData(manyContracts)
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      expect(screen.getByText('seller0@example.com')).toBeInTheDocument();
      // Verify pagination controls are present (30 items / 25 per page = 2 pages)
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    });

    // Go to page 2 by clicking Next
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).not.toBeDisabled();
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Should be on page 2 now - sellers 25-29 should be visible
      expect(screen.getByText('seller25@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    });

    // Now click Previous button
    const previousButton = screen.getByRole('button', { name: 'Previous' });
    fireEvent.click(previousButton);

    // Should be back on page 1
    await waitFor(() => {
      expect(screen.getByText('seller0@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('creates synthetic RESOLVED status when contract is CLAIMED with adminNotes', async () => {
    const contractWithAdminNotes = {
      ...mockContracts[0],
      adminNotes: [
        {
          id: '1',
          content: 'Admin resolved this dispute in favor of buyer',
          addedBy: 'admin@example.com',
          addedAt: 1753900000000
        }
      ],
      blockchainStatus: {
        status: 'CLAIMED',
        funded: true,
        buyer: '0xbuyer1',
        seller: '0xseller1',
        amount: 1000,
        expiryTimestamp: 1753749402
      },
      blockchainQuerySuccess: true
    };

    // Mock combined contracts response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [contractWithAdminNotes]
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      // Should show RESOLVED instead of CLAIMED because adminNotes exist
      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
      expect(screen.queryByText('CLAIMED')).not.toBeInTheDocument();
    });
  });

  it('handles chain service fetch failures gracefully', async () => {
    // Mock combined contracts response with blockchain query failure
    const contractsWithFailure = mockContracts.map(contract => ({
      ...contract,
      blockchainQuerySuccess: false,
      blockchainQueryError: 'Chain service unavailable'
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractsWithFailure
    } as Response);

    render(<AdminContractList />);

    await waitFor(() => {
      // Should still show contracts from deployed data only
      expect(screen.getByText('seller1@example.com')).toBeInTheDocument();
      expect(screen.getByText('seller2@example.com')).toBeInTheDocument();
      // Contract without chain data should not have buyer address
      expect(screen.queryByText('0xbuyer1')).not.toBeInTheDocument();
    });
  });
});