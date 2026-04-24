import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../../../components/auth/ConfigProvider');
jest.mock('../../../components/auth');

// Override the global SDK mock with test-specific values
jest.mock('../../../hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    provider: null,
    isReady: true,
    getWeb3Service: jest.fn(),
    fundAndSendTransaction: jest.fn().mockResolvedValue('0xtxhash'),
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
    getNativeBalance: jest.fn().mockResolvedValue('1.0'),
    getUserAddress: jest.fn().mockResolvedValue('0xSellerAddress'),
  }),
}));

// Simplify BuyerInput so we can drive the form with fireEvent
jest.mock('../../../components/ui/BuyerInput', () => {
  return function MockBuyerInput({ value, onChange, placeholder, label, error }: any) {
    return (
      <div>
        <label>{label}</label>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value, 'email')}
        />
        {error && <p data-testid="buyer-email-error">{error}</p>}
      </div>
    );
  };
});

// Simplify Toast — the real one renders a portal and we don't care about it here
jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));

// WalletInfo hits lots of hooks — not relevant to this validation test
jest.mock('../../../components/ui/WalletInfo', () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-info-stub" />,
}));

import { useRouter } from 'next/router';
import CreateContractWizard from '../../../components/contracts/CreateContractWizard';
import { useConfig } from '../../../components/auth/ConfigProvider';
import { useAuth } from '../../../components/auth';

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const VALID_ARBITER = '0xdD870fA1b7C4700F2BD7f44238821C26f7392148';

describe('CreateContractWizard - arbiterAddress (advanced option)', () => {
  const mockConfig: any = {
    usdcContractAddress: '0x0000000000000000000000000000000000000001',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    moonPayApiKey: 'test-moonpay-key',
    minGasWei: '5',
    basePath: '',
    explorerBaseUrl: 'https://sepolia.basescan.org',
    serviceLink: 'http://localhost:3000',
    tokenSymbol: 'USDC',
    defaultTokenSymbol: 'USDC',
    usdcDetails: { symbol: 'USDC', address: '0x0000000000000000000000000000000000000001' },
  };

  const mockUser = {
    userId: 'test-user-id',
    email: 'seller@test.com',
    walletAddress: '0xSellerAddress',
    authProvider: 'web3auth' as const,
  };

  const buildAuth = (authenticatedFetch: any) => ({
    user: mockUser,
    isLoading: false,
    isConnected: true,
    address: '0xSellerAddress',
    error: null,
    disconnect: jest.fn(),
    getEthersProvider: jest.fn(),
    refreshUserData: jest.fn().mockResolvedValue(undefined),
    authenticatedFetch,
    hasVisitedBefore: jest.fn().mockReturnValue(false),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRouter.mockReturnValue({
      push: mockPush,
      basePath: '',
      pathname: '/create',
      query: {},
      asPath: '/create',
      events: { on: jest.fn(), off: jest.fn() },
    } as any);

    mockUseConfig.mockReturnValue({ config: mockConfig, isLoading: false } as any);
  });

  // Helpers ---------------------------------------------------------------

  const fillStepZero = (arbiter?: string) => {
    // Buyer email (mocked BuyerInput)
    fireEvent.change(screen.getByPlaceholderText('Search Farcaster user or enter email'), {
      target: { value: 'buyer@test.com' },
    });
    // Description
    fireEvent.change(screen.getByPlaceholderText(/brief description/i), {
      target: { value: 'Test payment description' },
    });

    if (typeof arbiter === 'string') {
      // Open the Advanced Options disclosure
      fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
      const arbiterInput = screen.getByPlaceholderText('0x...') as HTMLInputElement;
      fireEvent.change(arbiterInput, { target: { value: arbiter } });
    }
  };

  const clickContinue = () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  };

  // Tests -----------------------------------------------------------------

  it('does not show the arbiter field by default (advanced section collapsed)', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    expect(screen.queryByPlaceholderText('0x...')).not.toBeInTheDocument();
    // But the toggle button exists
    expect(screen.getByRole('button', { name: /advanced options/i })).toBeInTheDocument();
  });

  it('reveals the arbiter field after clicking Advanced Options', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
    expect(screen.getByText(/arbiter wallet address/i)).toBeInTheDocument();
  });

  it('advances past step 0 when arbiter address is blank (optional)', async () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillStepZero(); // No arbiter touched
    clickContinue();

    // Step 1 heading is "Payment terms"
    // Step 1 shows the amount input
    await waitFor(() => {
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    });
  });

  it('advances past step 0 when arbiter address is a valid checksummed address', async () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillStepZero(VALID_ARBITER);
    clickContinue();

    // Step 1 shows the amount input
    await waitFor(() => {
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    });
  });

  it('blocks step 0 and shows an error when arbiter address is invalid', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillStepZero('not-a-real-address');
    clickContinue();

    // Still on step 0 — amount input from step 1 has not appeared
    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument();
    expect(screen.getByText(/invalid arbiter wallet address/i)).toBeInTheDocument();
  });

  it('omits arbiterAddress from POST body entirely when blank', async () => {
    const authenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ contractId: 'abc-123' }),
    });
    mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);

    render(<CreateContractWizard />);

    // Step 0
    fillStepZero();
    clickContinue();

    // Step 1
    // Step 1 shows the amount input
    await waitFor(() =>
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '10.00' } });
    clickContinue();

    // Step 2 — submit
    // Step 2 shows the final "Create Payment Request" button
    let submitButton: HTMLElement;
    await waitFor(() => {
      submitButton = screen.getByRole('button', { name: /create payment request/i });
      expect(submitButton).toBeInTheDocument();
    });
    fireEvent.click(submitButton!);

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled());
    const [, options] = authenticatedFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body).not.toHaveProperty('arbiterAddress');
  });

  it('includes a checksummed arbiterAddress in the POST body when provided', async () => {
    const authenticatedFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ contractId: 'abc-123' }),
    });
    mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);

    render(<CreateContractWizard />);

    // Supply the arbiter in lowercase to prove we checksum on submit
    fillStepZero(VALID_ARBITER.toLowerCase());
    clickContinue();

    // Step 1 shows the amount input
    await waitFor(() =>
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '10.00' } });
    clickContinue();

    // Step 2 shows the final "Create Payment Request" button
    let submitButton: HTMLElement;
    await waitFor(() => {
      submitButton = screen.getByRole('button', { name: /create payment request/i });
      expect(submitButton).toBeInTheDocument();
    });
    fireEvent.click(submitButton!);

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled());
    const [, options] = authenticatedFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.arbiterAddress).toBe(VALID_ARBITER);
  });
});
