import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContractList from '@/components/contracts/ContractList';
import { useAuth } from '@/components/auth/AuthProvider';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// Mock child components
jest.mock('@/components/contracts/ContractCard', () => {
  return function MockContractCard({ contract }: any) {
    return <div data-testid="contract-card">{contract.contractAddress}</div>;
  };
});

jest.mock('@/components/contracts/PendingContractCard', () => {
  return function MockPendingContractCard({ contract }: any) {
    return <div data-testid="pending-contract-card">{contract.id}</div>;
  };
});

jest.mock('@/components/contracts/ContractAcceptance', () => {
  return function MockContractAcceptance({ contract }: any) {
    return <div data-testid="contract-acceptance">{contract.id}</div>;
  };
});

jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

// Mock fetch
global.fetch = jest.fn();

describe('ContractList', () => {
  const mockRouter = {
    basePath: '',
    pathname: '/dashboard',
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  };

  const mockUser = {
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Dashboard endpoint calls', () => {
    it('should call both /api/contracts and /api/contracts/deployed endpoints on mount', async () => {
      const mockPendingContracts = [
        {
          id: 'pending-1',
          sellerAddress: '0xseller1',
          amount: 100,
          description: 'Pending contract 1',
          expiryTimestamp: 1700000000,
          createdAt: 1699000000,
        },
      ];

      const mockDeployedContracts = [
        {
          id: 'deployed-1',
          chainAddress: '0xcontract1',
          sellerAddress: '0xseller2',
          amount: 200,
          description: 'Deployed contract 1',
          expiryTimestamp: 1700000000,
          createdAt: 1699000000,
        },
      ];

      const mockChainData = {
        contractAddress: '0xcontract1',
        status: 'ACTIVE',
        buyerAddress: '0xbuyer1',
        sellerAddress: '0xseller2',
        amount: 200,
        expiryTimestamp: 1700000000,
        description: 'Deployed contract 1',
        createdAt: 1699000000,
      };

      // Mock fetch responses
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPendingContracts),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDeployedContracts),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockChainData),
          })
        );

      render(<ContractList />);

      // Wait for initial loading to complete and chain data to be fetched
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Wait for the chain data fetch to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      // Verify both endpoints were called
      expect(global.fetch).toHaveBeenCalledWith('/api/contracts');
      expect(global.fetch).toHaveBeenCalledWith('/api/contracts/deployed');
      expect(global.fetch).toHaveBeenCalledWith('/api/chain/contract/0xcontract1');
    });

    it('should handle errors when fetching pending contracts fails', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to fetch pending contracts' }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        );

      render(<ContractList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch pending contracts')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/contracts');
      expect(global.fetch).toHaveBeenCalledWith('/api/contracts/deployed');
    });

    it('should handle errors when fetching deployed contracts fails', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to fetch deployed contracts' }),
          })
        );

      render(<ContractList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch deployed contracts')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/contracts');
      expect(global.fetch).toHaveBeenCalledWith('/api/contracts/deployed');
    });

    it('should display both pending and deployed contracts after successful fetch', async () => {
      const mockPendingContracts = [
        {
          id: 'pending-1',
          sellerAddress: '0xseller1',
          amount: 100,
          description: 'Pending contract 1',
          expiryTimestamp: 1700000000,
          createdAt: 1699000000,
        },
        {
          id: 'pending-2',
          sellerAddress: '0xseller3',
          amount: 150,
          description: 'Pending contract 2',
          expiryTimestamp: 1700000000,
          createdAt: 1699000000,
        },
      ];

      const mockDeployedContracts = [
        {
          id: 'deployed-1',
          chainAddress: '0xcontract1',
          sellerAddress: '0xseller2',
          amount: 200,
          description: 'Deployed contract 1',
          expiryTimestamp: 1700000000,
          createdAt: 1699000000,
        },
      ];

      const mockChainData = {
        contractAddress: '0xcontract1',
        status: 'ACTIVE',
        buyerAddress: '0xbuyer1',
        sellerAddress: '0xseller2',
        amount: 200,
        expiryTimestamp: 1700000000,
        description: 'Deployed contract 1',
        createdAt: 1699000000,
      };

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockPendingContracts),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDeployedContracts),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockChainData),
          })
        );

      render(<ContractList />);

      // Wait for all fetches to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      await waitFor(() => {
        // Should show 2 pending contract cards
        const pendingCards = screen.getAllByTestId('pending-contract-card');
        expect(pendingCards).toHaveLength(2);
        
        // Should show 1 deployed contract card
        const contractCards = screen.getAllByTestId('contract-card');
        expect(contractCards).toHaveLength(1);
      });

      // Verify the correct content is displayed
      expect(screen.getByText('Showing 3 of 3 contracts')).toBeInTheDocument();
    });

    it('should not make API calls when user is not authenticated', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      render(<ContractList />);

      // Wait a bit to ensure no calls are made
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle empty responses from both endpoints', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        );

      render(<ContractList />);

      await waitFor(() => {
        expect(screen.getByText('No contracts found')).toBeInTheDocument();
        expect(screen.getByText('Create your first escrow contract to get started.')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/contracts');
      expect(global.fetch).toHaveBeenCalledWith('/api/contracts/deployed');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should call both endpoints in parallel, not sequentially', async () => {
      const fetchTimes: number[] = [];
      
      (global.fetch as jest.Mock)
        .mockImplementation(() => {
          fetchTimes.push(Date.now());
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        });

      render(<ContractList />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Both fetches should be called at nearly the same time (within 50ms)
      expect(fetchTimes).toHaveLength(2);
      const timeDiff = Math.abs(fetchTimes[1] - fetchTimes[0]);
      expect(timeDiff).toBeLessThan(50);
    });
  });
});