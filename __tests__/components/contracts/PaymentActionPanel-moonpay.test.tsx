/**
 * The MoonPay option on the pay screen, and the flag that hides it.
 *
 * MOONPAY_API_KEY reaches the client as config.moonPayApiKey. It is empty in
 * production today, so the default state of this button is "absent" — and that
 * is the case worth pinning, because a half-built on-ramp appearing on a live
 * payment screen is the failure that matters.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/lib/moonPayOnramp', () => ({ openMoonPayOnramp: jest.fn() }));
jest.mock('@/lib/coinbaseOnramp', () => ({ openCoinbaseOnramp: jest.fn() }));
jest.mock('@/components/contracts/AddFundsModal', () => ({
  __esModule: true,
  default: () => null,
}));

import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useConfig } from '@/components/auth/ConfigProvider';
import { openMoonPayOnramp } from '@/lib/moonPayOnramp';

const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockOpen = openMoonPayOnramp as jest.MockedFunction<typeof openMoonPayOnramp>;

const ESCROW = '0x1111111111111111111111111111111111111111';

const baseProps = {
  amountLabel: '1.5000 USDC',
  amountInTokens: 1.5,
  balanceFloat: 10,
  tokenSymbol: 'USDC',
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: '0xB9C9000000000000000000000000000000000000',
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: false,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  resolveEscrowAddress: jest.fn().mockResolvedValue(ESCROW),
  contractId: 'contract-123',
};

const withConfig = (config: Record<string, unknown>) =>
  mockUseConfig.mockReturnValue({ config, isLoading: false } as any);

const moonPayButton = () => screen.queryByRole('button', { name: /bank transfer or card/i });

describe('PaymentActionPanel - MoonPay', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('the feature flag', () => {
    it('hides the option when MOONPAY_API_KEY is unset', () => {
      withConfig({ coinbaseProjectId: 'cb-project' });
      render(<PaymentActionPanel {...baseProps} />);

      expect(moonPayButton()).not.toBeInTheDocument();
    });

    it('hides it for an empty key, which is what production returns today', () => {
      // config.moonPayApiKey is '' live. A truthiness check is the whole gate,
      // so an empty string has to read as off.
      withConfig({ moonPayApiKey: '' });
      render(<PaymentActionPanel {...baseProps} />);

      expect(moonPayButton()).not.toBeInTheDocument();
    });

    it('shows it once a key is configured', () => {
      withConfig({ moonPayApiKey: 'pk_test_key' });
      render(<PaymentActionPanel {...baseProps} />);

      expect(moonPayButton()).toBeInTheDocument();
    });

    it('leaves the Coinbase option alone either way', () => {
      // The two routes are independent: MoonPay carries bank transfer, Coinbase
      // carries cards. Turning one on must not disturb the other.
      withConfig({ moonPayApiKey: 'pk_test_key', coinbaseProjectId: 'cb-project' });
      render(<PaymentActionPanel {...baseProps} />);

      expect(moonPayButton()).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /card or bank transfer/i })).toBeInTheDocument();
    });
  });

  describe('what it needs before it can offer the route', () => {
    it('stays hidden without a contract id to sign for', () => {
      withConfig({ moonPayApiKey: 'pk_test_key' });
      render(<PaymentActionPanel {...baseProps} contractId={undefined} />);

      expect(moonPayButton()).not.toBeInTheDocument();
    });

    it('stays hidden where there is no escrow to fund', () => {
      withConfig({ moonPayApiKey: 'pk_test_key' });
      render(<PaymentActionPanel {...baseProps} resolveEscrowAddress={undefined} />);

      expect(moonPayButton()).not.toBeInTheDocument();
    });
  });

  describe('opening it', () => {
    it('deploys the escrow first, then opens MoonPay with only the contract id', async () => {
      // The address is resolved so it exists by the time the signer looks for
      // it — but it is NOT handed to openMoonPayOnramp. The box reads it off
      // the contract, so a tampered client cannot redirect the funds.
      withConfig({ moonPayApiKey: 'pk_test_key' });
      render(<PaymentActionPanel {...baseProps} />);

      await userEvent.click(moonPayButton()!);

      expect(baseProps.resolveEscrowAddress).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: 'contract-123' })
      );
      const [arg] = mockOpen.mock.calls[0];
      expect(arg).not.toHaveProperty('walletAddress');
      expect(arg).not.toHaveProperty('escrowAddress');
    });

    it('does not open MoonPay if the escrow cannot be prepared', async () => {
      withConfig({ moonPayApiKey: 'pk_test_key' });
      render(
        <PaymentActionPanel
          {...baseProps}
          resolveEscrowAddress={jest.fn().mockResolvedValue(null)}
        />
      );

      await userEvent.click(moonPayButton()!);

      expect(mockOpen).not.toHaveBeenCalled();
      expect(await screen.findByText(/could not prepare the escrow/i)).toBeInTheDocument();
    });

    it('shows the failure rather than silently doing nothing', async () => {
      withConfig({ moonPayApiKey: 'pk_test_key' });
      mockOpen.mockRejectedValueOnce(new Error('MoonPay is not configured'));
      render(<PaymentActionPanel {...baseProps} />);

      await userEvent.click(moonPayButton()!);

      expect(await screen.findByText(/MoonPay is not configured/i)).toBeInTheDocument();
    });
  });
});
