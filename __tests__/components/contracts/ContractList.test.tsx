import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import { useRouter } from 'next/router';
import ContractList from '@/components/contracts/ContractList';
import { useAuth } from '@/components/auth';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/auth/Web3AuthContextProvider', () => ({
  useWeb3AuthInstance: jest.fn(),
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
    (useWeb3AuthInstance as jest.Mock).mockReturnValue({
      web3authProvider: null,
      isLoading: false,
      web3authInstance: null,
      onLogout: jest.fn(),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Dashboard endpoint calls', () => {
    it('should call unified /api/contracts/all endpoint on mount', async () => {
      const mockAllContracts = [
        {
          contract: {
            id: 'pending-1',
            sellerAddress: '0xseller1',
            amount: 100,
            description: 'Pending contract 1',
            expiryTimestamp: 1700000000,
            createdAt: 1699000000,
            chainAddress: null,
            sellerEmail: 'seller@test.com',
            buyerEmail: 'buyer@test.com',
            currency: 'USDC',
            state: 'OK'
          },
          blockchainQuerySuccessful: false
        },
        {
          contract: {
            id: 'deployed-1',
            chainAddress: '0xcontract1',
            sellerAddress: '0xseller2',
            amount: 200,
            description: 'Deployed contract 1',
            expiryTimestamp: 1700000000,
            createdAt: 1699000000,
            sellerEmail: 'seller2@test.com',
            buyerEmail: 'buyer2@test.com',
            currency: 'USDC',
            state: 'OK'
          },
          blockchainStatus: 'ACTIVE',
          blockchainFunded: true,
          blockchainQuerySuccessful: true,
          blockchainAmount: '200000000',
          blockchainBuyerAddress: '0xbuyer1',
          blockchainSellerAddress: '0xseller2',
          blockchainExpiryTimestamp: 1700000000,
          discrepancies: {}
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
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllContracts),
        })
      );

      render(<ContractList />);

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      // Verify unified endpoint was called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/combined-contracts');
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
        expect(screen.getByText('Failed to fetch contracts')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/combined-contracts');
    });


    it('should display both pending and deployed contracts after successful fetch', async () => {
      const mockAllContracts = [
        {
          contract: {
            id: 'pending-1',
            sellerAddress: '0xseller1',
            amount: 100,
            description: 'Pending contract 1',
            expiryTimestamp: 1700000000,
            createdAt: 1699000000,
            chainAddress: null,
            sellerEmail: 'seller1@test.com',
            buyerEmail: 'buyer1@test.com',
            currency: 'USDC',
            state: 'OK'
          },
          blockchainQuerySuccessful: false
        },
        {
          contract: {
            id: 'pending-2',
            sellerAddress: '0xseller3',
            amount: 150,
            description: 'Pending contract 2',
            expiryTimestamp: 1700000000,
            createdAt: 1699000000,
            chainAddress: null,
            sellerEmail: 'seller3@test.com',
            buyerEmail: 'buyer3@test.com',
            currency: 'USDC',
            state: 'OK'
          },
          blockchainQuerySuccessful: false
        },
        {
          contract: {
            id: 'deployed-1',
            chainAddress: '0xcontract1',
            sellerAddress: '0xseller2',
            amount: 200,
            description: 'Deployed contract 1',
            expiryTimestamp: 1700000000,
            createdAt: 1699000000,
            sellerEmail: 'seller2@test.com',
            buyerEmail: 'buyer2@test.com',
            currency: 'USDC',
            state: 'OK'
          },
          blockchainStatus: 'ACTIVE',
          blockchainFunded: true,
          blockchainQuerySuccessful: true,
          blockchainAmount: '200000000',
          blockchainBuyerAddress: '0xbuyer1',
          blockchainSellerAddress: '0xseller2',
          blockchainExpiryTimestamp: 1700000000,
          discrepancies: {}
        },
      ];

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAllContracts),
        })
      );

      render(<ContractList />);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        // All contracts should be displayed using unified ContractCard component
        const contractCards = screen.getAllByTestId('contract-card');
        expect(contractCards).toHaveLength(3);
        
        // Note: After unification, all contracts use the same ContractCard component
        // The component internally determines whether to show pending or regular behavior
        // based on the contract data structure
      });

      // Verify the correct content is displayed
      expect(screen.getByText('Showing 3 contracts')).toBeInTheDocument();
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
        expect(screen.getByText('No contracts are currently available in the system.')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/combined-contracts');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should call unified endpoint once', async () => {
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

      // Should only call the unified endpoint once
      expect(fetchTimes).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/combined-contracts');
    });
  });
});