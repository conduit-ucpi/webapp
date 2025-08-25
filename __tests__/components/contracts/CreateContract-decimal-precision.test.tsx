import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth/AuthProvider');
jest.mock('../../../components/auth/Web3AuthContextProvider');
jest.mock('../../../lib/web3');

import { useRouter } from 'next/router';
import CreateContract from '../../../components/contracts/CreateContract';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth/AuthProvider';
import { useWeb3AuthInstance } from '../../../components/auth/Web3AuthContextProvider';

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWeb3AuthInstance = useWeb3AuthInstance as jest.MockedFunction<typeof useWeb3AuthInstance>;
// Mock Web3Auth provider
Object.defineProperty(window, 'web3authProvider', {
  value: {
    request: jest.fn(),
  },
  writable: true,
});

// Mock window.alert to prevent jsdom errors
global.alert = jest.fn();

describe('CreateContract Decimal Precision', () => {
  const mockConfig = {
    web3AuthClientId: 'test-client-id',
    web3AuthNetwork: 'testnet',
    usdcContractAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    basePath: '',
    explorerBaseUrl: 'https://testnet.snowtrace.io',
    serviceLink: 'http://localhost:3000'
  };

  const mockUser = {
    userId: 'test-user-id',
    email: 'seller@example.com',
    walletAddress: '0x123'
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
      connect: jest.fn(),
      walletAddress: null,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
      getWalletProvider: jest.fn(),
      logout: jest.fn(),
    });

    mockUseWeb3AuthInstance.mockReturnValue({
      web3authProvider: null,
      isLoading: false,
      web3authInstance: null,
      onLogout: jest.fn(),
    });

    // Mock Web3Service
    const mockWeb3Service = {
      initializeProvider: jest.fn().mockResolvedValue(undefined),
      getUserAddress: jest.fn().mockResolvedValue('0x123'),
    };

    const { Web3Service } = require('../../../lib/web3');
    Web3Service.mockImplementation(() => mockWeb3Service);
  });

  it('should accept amount with 3 decimal places (0.001)', async () => {
    render(<CreateContract />);

    const amountInput = screen.getByPlaceholderText('100.00');

    // Test that 0.001 is accepted by the input
    fireEvent.change(amountInput, { target: { value: '0.001' } });

    expect(amountInput).toHaveValue(0.001);

    // Verify the input step attribute allows 3 decimal places
    expect(amountInput).toHaveAttribute('step', '0.001');
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('min', '0');
  });

  it('should accept various 3 decimal place amounts', async () => {
    render(<CreateContract />);

    const amountInput = screen.getByPlaceholderText('100.00');

    const testValues = ['0.001', '1.123', '100.999', '0.500'];

    for (const value of testValues) {
      fireEvent.change(amountInput, { target: { value } });
      expect(amountInput).toHaveValue(parseFloat(value));
    }
  });

  it('should still accept 2 decimal place amounts', async () => {
    render(<CreateContract />);

    const amountInput = screen.getByPlaceholderText('100.00');

    fireEvent.change(amountInput, { target: { value: '100.50' } });
    expect(amountInput).toHaveValue(100.5);

    fireEvent.change(amountInput, { target: { value: '0.01' } });
    expect(amountInput).toHaveValue(0.01);
  });

  it('should accept whole numbers', async () => {
    render(<CreateContract />);

    const amountInput = screen.getByPlaceholderText('100.00');

    fireEvent.change(amountInput, { target: { value: '100' } });
    expect(amountInput).toHaveValue(100);
  });

  it('should prevent negative amounts', async () => {
    render(<CreateContract />);

    const amountInput = screen.getByPlaceholderText('100.00');

    // The min="0" attribute should prevent negative values
    expect(amountInput).toHaveAttribute('min', '0');
  });

  it('should validate amount correctly with 3 decimal places in form submission', async () => {
    // Mock fetch for the contract creation API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ contractId: '123' }),
    });

    render(<CreateContract />);

    // Fill in the form with valid data including 3 decimal places
    const buyerEmailInput = screen.getByPlaceholderText('buyer@example.com');
    const amountInput = screen.getByPlaceholderText('100.00');
    const descriptionInput = screen.getByPlaceholderText(/brief description/i);

    fireEvent.change(buyerEmailInput, { target: { value: 'buyer@example.com' } });
    fireEvent.change(amountInput, { target: { value: '0.001' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test payment' } });

    // Set a valid future date
    const payoutInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().slice(0, 16);
    fireEvent.change(payoutInput, { target: { value: tomorrowString } });

    const submitButton = screen.getByRole('button', { name: /Request Payment from Buyer/i });

    // The form should not show validation errors for 0.001
    expect(screen.queryByText(/Invalid amount/i)).not.toBeInTheDocument();

    // Form should be submittable (button enabled)
    expect(submitButton).not.toBeDisabled();
  });
});