import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

// Mock the dependencies BEFORE importing components
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');

// Override the global SDK mock with test-specific values
jest.mock('@/hooks/useSimpleEthers', () => ({
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

// Simplify Toast — the real one renders a portal and we don't care about it here
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));

import { useRouter } from 'next/router';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';

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

  /**
   * The single form screen: description, amount (the token field — the fiat one converts via a
   * live rate that does not resolve under jsdom) and, optionally, the arbiter under Advanced.
   */
  const fillForm = (arbiter?: string) => {
    fireEvent.change(screen.getByPlaceholderText("What's this payment for?"), {
      target: { value: 'Test payment description' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '10.00' } });

    if (typeof arbiter === 'string') {
      fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
      fireEvent.change(screen.getByPlaceholderText('0x...'), { target: { value: arbiter } });
    }
  };

  const clickContinue = () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  };

  /** The review screen's submit button, once the form has been accepted. */
  const submitButton = () => screen.findByRole('button', { name: /create payment request/i });

  const postedBody = async (authenticatedFetch: jest.Mock) => {
    fireEvent.click(await submitButton());
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled());
    const [url, options] = authenticatedFetch.mock.calls[0];
    expect(url).toBe('/api/ap2/request');
    return JSON.parse(options.body);
  };

  const okFetch = () =>
    jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ request_id: 'abc-123' }),
    });

  // Tests -----------------------------------------------------------------

  it('does not show the arbiter field by default (advanced section collapsed)', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    expect(screen.queryByPlaceholderText('0x...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /advanced options/i })).toBeInTheDocument();
  });

  it('reveals the arbiter field after clicking Advanced Options', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
    expect(screen.getByText(/arbiter wallet address/i)).toBeInTheDocument();
  });

  it('accepts the form with no arbiter (it is optional)', async () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillForm();
    clickContinue();

    expect(await submitButton()).toBeInTheDocument();
  });

  it('accepts the form with a valid arbiter address', async () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillForm(VALID_ARBITER);
    clickContinue();

    expect(await submitButton()).toBeInTheDocument();
  });

  it('stays on the form and says why when the arbiter address is invalid', () => {
    mockUseAuth.mockReturnValue(buildAuth(jest.fn()) as any);
    render(<CreateContractWizard />);

    fillForm('not-a-real-address');
    clickContinue();

    expect(screen.queryByRole('button', { name: /create payment request/i })).not.toBeInTheDocument();
    expect(screen.getByText(/invalid arbiter wallet address/i)).toBeInTheDocument();
  });

  it('sends no arbiter when none was given', async () => {
    const authenticatedFetch = okFetch();
    mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);
    render(<CreateContractWizard />);

    fillForm();
    clickContinue();

    expect(await postedBody(authenticatedFetch)).not.toHaveProperty('arbiter');
  });

  it('sends the arbiter checksummed, however it was typed', async () => {
    const authenticatedFetch = okFetch();
    mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);
    render(<CreateContractWizard />);

    fillForm(VALID_ARBITER.toLowerCase());
    clickContinue();

    expect((await postedBody(authenticatedFetch)).arbiter).toBe(VALID_ARBITER);
  });
});
