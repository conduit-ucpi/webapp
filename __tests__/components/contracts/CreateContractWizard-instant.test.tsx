/**
 * The "Instantly" release option on the create form.
 *
 * EscrowContract treats EXPIRY_TIMESTAMP == 0 as an instant transfer: the
 * deposit pays the seller in the same transaction and raiseDispute reverts
 * (EscrowContract.sol:619, :705, :1156). The contract has always supported it,
 * but the UI control that produced the zero was removed in c14d8d1 when two
 * overlapping checkboxes were collapsed into a delivery-method choice. Nothing
 * failed: `isInstantPayment` stayed in the wizard with no setter, and the
 * submit kept sending `form.payoutTimestamp` unconditionally, so the feature
 * was dead for months without a red test.
 *
 * What makes that regression invisible is that every check but one is about
 * rendering. The assertion that matters is on the POST body — a toggle that
 * flips state but never reaches the request is exactly the failure that
 * happened, and only the wire format catches it.
 */

import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    provider: null,
    isReady: true,
    getWeb3Service: jest.fn(),
    fundAndSendTransaction: jest.fn().mockResolvedValue('0xtxhash'),
    getUSDCBalance: jest.fn().mockResolvedValue('100.0'),
    getNativeBalance: jest.fn().mockResolvedValue('1.0'),
    getTokenBalance: jest.fn().mockResolvedValue('100.0'),
    getUserAddress: jest.fn().mockResolvedValue('0xSellerAddress'),
  }),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/ui/WalletInfo', () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-info-stub" />,
}));

import { useRouter } from 'next/router';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('CreateContractWizard - instant release', () => {
  const mockConfig: any = {
    usdcContractAddress: '0x0000000000000000000000000000000000000001',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    minGasWei: '5',
    basePath: '',
    explorerBaseUrl: 'https://sepolia.basescan.org',
    serviceLink: 'http://localhost:3000',
    tokenSymbol: 'USDC',
    defaultTokenSymbol: 'USDC',
    usdcDetails: { symbol: 'USDC', address: '0x0000000000000000000000000000000000000001' },
  };

  const buildAuth = (authenticatedFetch: any) => ({
    user: {
      userId: 'test-user-id',
      email: 'seller@test.com',
      walletAddress: '0xSellerAddress',
      authProvider: 'web3auth' as const,
    },
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
      push: jest.fn(),
      basePath: '',
      pathname: '/create',
      query: {},
      asPath: '/create',
      events: { on: jest.fn(), off: jest.fn() },
    } as any);
    mockUseConfig.mockReturnValue({ config: mockConfig, isLoading: false } as any);
  });

  const okFetch = () =>
    jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ contractId: 'abc-123' }),
    });

  const dateInput = () => document.querySelector('input[type="datetime-local"]');

  /** Fill the single form screen, then walk through review to submit. */
  const fillAndSubmit = async () => {
    fireEvent.change(screen.getByPlaceholderText("What's this payment for?"), {
      target: { value: 'Test payment description' },
    });
    // The token field, not the fiat one beside it: the fiat input converts via
    // a live rate, which does not resolve under jsdom.
    fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '10.00' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    let submitButton: HTMLElement;
    await waitFor(() => {
      submitButton = screen.getByRole('button', { name: /create payment request/i });
      expect(submitButton).toBeInTheDocument();
    });
    fireEvent.click(submitButton!);
  };

  const postedBody = async (authenticatedFetch: jest.Mock) => {
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled());
    const [, options] = authenticatedFetch.mock.calls[0];
    return JSON.parse(options.body);
  };

  describe('the control itself', () => {
    it('offers a date by default, with the picker showing', () => {
      mockUseAuth.mockReturnValue(buildAuth(okFetch()) as any);
      render(<CreateContractWizard />);

      expect(screen.getByRole('radio', { name: 'On a date' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
      expect(dateInput()).toBeInTheDocument();
    });

    it('replaces the picker with the no-dispute warning when Instantly is chosen', () => {
      mockUseAuth.mockReturnValue(buildAuth(okFetch()) as any);
      render(<CreateContractWizard />);

      fireEvent.click(screen.getByRole('radio', { name: 'Instantly' }));

      // A date field left on screen would imply the date still applies.
      expect(dateInput()).not.toBeInTheDocument();
      expect(screen.getByText(/neither side can raise a dispute/i)).toBeInTheDocument();
    });

    it('goes back to the picker when the date option is reselected', () => {
      mockUseAuth.mockReturnValue(buildAuth(okFetch()) as any);
      render(<CreateContractWizard />);

      fireEvent.click(screen.getByRole('radio', { name: 'Instantly' }));
      fireEvent.click(screen.getByRole('radio', { name: 'On a date' }));

      expect(dateInput()).toBeInTheDocument();
    });
  });

  describe('what reaches the API', () => {
    it('posts a zero expiry when Instantly is chosen', async () => {
      const authenticatedFetch = okFetch();
      mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);
      render(<CreateContractWizard />);

      fireEvent.click(screen.getByRole('radio', { name: 'Instantly' }));
      await fillAndSubmit();

      // Zero is the sentinel, so this must be the number 0 and not '' or
      // undefined — a falsy stand-in would not survive the contract's
      // `EXPIRY_TIMESTAMP == 0` check the same way.
      expect(await postedBody(authenticatedFetch)).toMatchObject({ expiryTimestamp: 0 });
    });

    it('posts the chosen date, not the sentinel, on the default path', async () => {
      const authenticatedFetch = okFetch();
      mockUseAuth.mockReturnValue(buildAuth(authenticatedFetch) as any);
      render(<CreateContractWizard />);

      await fillAndSubmit();

      const body = await postedBody(authenticatedFetch);
      expect(body.expiryTimestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('the review screen', () => {
    it('says the release is instant rather than showing a date', async () => {
      mockUseAuth.mockReturnValue(buildAuth(okFetch()) as any);
      render(<CreateContractWizard />);

      fireEvent.click(screen.getByRole('radio', { name: 'Instantly' }));
      fireEvent.change(screen.getByPlaceholderText("What's this payment for?"), {
        target: { value: 'Test payment description' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.0000'), { target: { value: '10.00' } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() =>
        expect(screen.getByText(/instant, on confirmation/i)).toBeInTheDocument()
      );
    });
  });
});
