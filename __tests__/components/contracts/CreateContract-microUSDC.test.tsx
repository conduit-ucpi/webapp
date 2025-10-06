import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');
// jest.mock('../../../components/auth/Web3AuthContextProvider'); // Not needed

// Override the global SDK mock with test-specific values
jest.mock('../../../hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    provider: null,
    isReady: true,
    getWeb3Service: jest.fn(),
    fundAndSendTransaction: jest.fn().mockResolvedValue('0xtxhash'),
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
    getNativeBalance: jest.fn().mockResolvedValue('1.0'),
    getUserAddress: jest.fn().mockResolvedValue('0xSellerAddress'), // Test-specific address for CreateContract
  })
}));

import { useRouter } from 'next/router';
import CreateContract from '../../../components/contracts/CreateContract';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';
// import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthContextProvider'; // Not needed

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
// const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>; // Not needed

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web3Auth provider and window.alert
Object.defineProperty(window, 'web3authProvider', {
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert to prevent jsdom errors
global.alert = jest.fn();

// Mock BuyerInput component to simplify form interaction in tests
jest.mock('../../../components/ui/BuyerInput', () => {
  return function MockBuyerInput({ value, onChange, placeholder, label }: any) {
    return (
      <div>
        <label>{label}</label>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value, 'email')}
        />
      </div>
    );
  };
});

describe('CreateContract - microUSDC Amount Handling', () => {
  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    usdcContractAddress: '0x123456789',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    maxGasPriceGwei: '0.001',
    maxGasCostGwei: '0.15',
    usdcGrantFoundryGas: '150000',
    depositFundsFoundryGas: '150000',
    basePath: '',
    explorerBaseUrl: 'https://testnet.snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  const mockUser = {
    userId: 'test-user-id',
    email: 'seller@test.com',
    walletAddress: '0xSellerAddress',
    authProvider: 'web3auth' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      basePath: '',
      pathname: '/create',
      query: {},
      asPath: '/create',
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    } as any);

    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isConnected: true,
      error: null,
      disconnect: jest.fn(),
      getEthersProvider: jest.fn(),
      authenticatedFetch: jest.fn(),
      hasVisitedBefore: jest.fn().mockReturnValue(false),
    });

    // mockUseWeb3AuthInstance.mockReturnValue({
    //   web3authProvider: null,
    //   isLoading: false,
    //   web3authInstance: null,
    //   onLogout: jest.fn(),
    // });

    // SDK is mocked at the module level and returns the correct address
  });

  describe('Amount conversion to microUSDC', () => {
    const setupFormAndSubmit = async (amount: string) => {
      // Mock successful API response for authenticatedFetch (used by CreateContract)
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, contractId: 'test-id' }),
      };

      // The CreateContract component uses authenticatedFetch, not global fetch
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isConnected: true,
        error: null,
        disconnect: jest.fn(),
        getEthersProvider: jest.fn(),
        authenticatedFetch: jest.fn().mockResolvedValue(mockResponse),
        hasVisitedBefore: jest.fn().mockReturnValue(false),
      });

      render(<CreateContract />);

      // Fill out the form
      fireEvent.change(screen.getByPlaceholderText('Search Farcaster user or enter email'), {
        target: { value: 'buyer@test.com' },
      });

      fireEvent.change(screen.getByPlaceholderText('100.00'), {
        target: { value: amount },
      });

      fireEvent.change(screen.getByPlaceholderText(/brief description/i), {
        target: { value: 'Test contract description' },
      });

      // Set payout date to tomorrow in LOCAL time (not UTC)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Format as local datetime-local format YYYY-MM-DDTHH:MM
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      const hours = tomorrow.getHours().toString().padStart(2, '0');
      const minutes = tomorrow.getMinutes().toString().padStart(2, '0');
      const dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;

      const expectedDatePattern = new RegExp(dateTimeValue.substring(0, 10) + 'T');
      const dateInput = screen.getByDisplayValue(expectedDatePattern);
      fireEvent.change(dateInput, {
        target: { value: dateTimeValue },
      });

      // Submit the form
      const form = screen.getByRole('button', { name: /request payment from buyer/i }).closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole('button', { name: /request payment from buyer/i }));
      }

      // Wait for the API call
      await waitFor(() => {
        const mockAuth = mockUseAuth.mock.results[mockUseAuth.mock.results.length - 1].value;
        expect(mockAuth.authenticatedFetch).toHaveBeenCalled();
      }, { timeout: 5000 });

      // Get the authenticatedFetch call arguments
      const mockAuth = mockUseAuth.mock.results[mockUseAuth.mock.results.length - 1].value;
      const [url, options] = mockAuth.authenticatedFetch.mock.calls[0];
      return options; // Return the request options
    };

    it('should convert 0.25 USDC to 250000 microUSDC', async () => {
      const requestOptions = await setupFormAndSubmit('0.25');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(250000); // 0.25 * 1,000,000
    });

    it('should convert 1.00 USDC to 1000000 microUSDC', async () => {
      const requestOptions = await setupFormAndSubmit('1.00');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(1000000); // 1.00 * 1,000,000
    });

    it('should convert 10.50 USDC to 10500000 microUSDC', async () => {
      const requestOptions = await setupFormAndSubmit('10.50');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(10500000); // 10.50 * 1,000,000
    });

    it('should handle decimal amounts correctly', async () => {
      const requestOptions = await setupFormAndSubmit('0.123456');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(123456); // 0.123456 * 1,000,000
    });

    it('should handle whole numbers without decimals', async () => {
      const requestOptions = await setupFormAndSubmit('5');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(5000000); // 5 * 1,000,000
    });

    it('should handle very small amounts', async () => {
      const requestOptions = await setupFormAndSubmit('0.000001');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(1); // 0.000001 * 1,000,000
    });

    it('should handle large amounts', async () => {
      const requestOptions = await setupFormAndSubmit('1000.99');

      const requestBody = JSON.parse(requestOptions.body);
      expect(requestBody.amount).toBe(1000990000); // 1000.99 * 1,000,000
    });

    describe('Edge cases and potential issues', () => {
      it('should handle floating point precision correctly', async () => {
        const requestOptions = await setupFormAndSubmit('0.1');

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.amount).toBe(100000); // 0.1 * 1,000,000
      });

      it('should handle string amounts that require parsing', async () => {
        // Note: HTML number inputs normalize values, so this tests a clean decimal
        const requestOptions = await setupFormAndSubmit('2.5');

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.amount).toBe(2500000); // 2.5 * 1,000,000
      });

      it('should handle amounts entered as integers', async () => {
        const requestOptions = await setupFormAndSubmit('100');

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.amount).toBe(100000000); // 100 * 1,000,000
      });

      it('should ensure amount is always an integer (no fractional microUSDC)', async () => {
        const requestOptions = await setupFormAndSubmit('0.1234567'); // More than 6 decimal places

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.amount).toBe(123457); // Properly rounded to integer microUSDC
        expect(Number.isInteger(requestBody.amount)).toBe(true);
      });

      it('should handle scientific notation input', async () => {
        // This tests if parseFloat handles scientific notation correctly
        const requestOptions = await setupFormAndSubmit('1e-6'); // 0.000001

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody.amount).toBe(1); // 0.000001 * 1,000,000
      });
    });

    describe('API request structure validation', () => {
      it('should send the correct request structure with microUSDC amount', async () => {
        const requestOptions = await setupFormAndSubmit('0.25');

        expect(requestOptions.method).toBe('POST');
        expect(requestOptions.headers['Content-Type']).toBe('application/json');

        const requestBody = JSON.parse(requestOptions.body);
        expect(requestBody).toEqual({
          buyerEmail: 'buyer@test.com',
          buyerFarcasterHandle: '',
          sellerEmail: 'seller@test.com',
          sellerAddress: '0xSellerAddress',
          amount: 250000, // microUSDC format
          currency: 'microUSDC',
          description: 'Test contract description',
          expiryTimestamp: expect.any(Number),
          serviceLink: 'http://localhost:3000'
        });
      });

      it('should maintain other request properties when converting amounts', async () => {
        const requestOptions = await setupFormAndSubmit('1.5');

        const requestBody = JSON.parse(requestOptions.body);

        // Verify all expected properties are present and correct
        expect(requestBody.buyerEmail).toBe('buyer@test.com');
        expect(requestBody.sellerEmail).toBe('seller@test.com');
        expect(requestBody.sellerAddress).toBe('0xSellerAddress');
        expect(requestBody.amount).toBe(1500000); // 1.5 * 1,000,000
        expect(requestBody.currency).toBe('microUSDC');
        expect(requestBody.description).toBe('Test contract description');
        expect(typeof requestBody.expiryTimestamp).toBe('number');
        expect(requestBody.expiryTimestamp).toBeGreaterThan(Date.now() / 1000);
      });
    });
  });

  describe('Error handling with amount conversion', () => {
    it('should handle API errors gracefully without exposing microUSDC details', async () => {
      // Mock error response for authenticatedFetch
      const mockErrorResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Contract creation failed' }),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isConnected: true,
        error: null,
        disconnect: jest.fn(),
        getEthersProvider: jest.fn(),
        authenticatedFetch: jest.fn().mockResolvedValue(mockErrorResponse),
        hasVisitedBefore: jest.fn().mockReturnValue(false),
      });

      render(<CreateContract />);

      // Fill out form and submit
      fireEvent.change(screen.getByPlaceholderText('Search Farcaster user or enter email'), {
        target: { value: 'buyer@test.com' },
      });

      fireEvent.change(screen.getByPlaceholderText('100.00'), {
        target: { value: '0.25' },
      });

      fireEvent.change(screen.getByPlaceholderText(/brief description/i), {
        target: { value: 'Test description' },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Format as local datetime-local format YYYY-MM-DDTHH:MM
      const year = tomorrow.getFullYear();
      const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
      const day = tomorrow.getDate().toString().padStart(2, '0');
      const hours = tomorrow.getHours().toString().padStart(2, '0');
      const minutes = tomorrow.getMinutes().toString().padStart(2, '0');
      const dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      const expectedDatePattern = new RegExp(dateTimeValue.substring(0, 10) + 'T');
      const dateInput = screen.getByDisplayValue(expectedDatePattern);
      fireEvent.change(dateInput, {
        target: { value: dateTimeValue },
      });

      const form = screen.getByRole('button', { name: /request payment from buyer/i }).closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole('button', { name: /request payment from buyer/i }));
      }

      // The component should handle the error without crashing
      await waitFor(() => {
        const mockAuth = mockUseAuth.mock.results[mockUseAuth.mock.results.length - 1].value;
        expect(mockAuth.authenticatedFetch).toHaveBeenCalled();
      });

      // Verify the request was made with correct microUSDC amount despite the error
      const mockAuth = mockUseAuth.mock.results[mockUseAuth.mock.results.length - 1].value;
      const [url, options] = mockAuth.authenticatedFetch.mock.calls[0];
      const requestBody = JSON.parse(options.body);
      expect(requestBody.amount).toBe(250000);
    });
  });
});