import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OfferFundingPanel from '@/components/marketplace/OfferFundingPanel';

/**
 * Paying an offer from the connected wallet must open it ONCE.
 *
 * ⚠️ THE QR CONTROLLER OPENS OFFERS TOO. Giving it the vault address starts its balance poll,
 *    which sees the deposit and calls fund-offer itself. Armed the moment the deposit landed,
 *    it raced fundOffer's own open: every wallet-funded offer was opened twice and the second
 *    relay reverted at the gas payer's expense. It may only be armed once the open has failed,
 *    where it drives the "Open my offer" recovery.
 */

const mockFundOffer = jest.fn();
const mockCreateContract = jest.fn();

jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({ fundOffer: mockFundOffer })
}));

jest.mock('@/hooks/useQrPayment', () => ({
  useQrPayment: () => ({
    createContract: mockCreateContract,
    checkAndActivate: jest.fn(),
    qrActivationStatus: 'idle'
  })
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { chainId: 8453, tokenSymbol: 'USDC', defaultToken: { decimals: 6 } } })
}));

jest.mock('@/components/auth', () => ({
  useAuth: () => ({ authenticatedFetch: jest.fn() })
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({ getTokenBalance: jest.fn().mockResolvedValue('10') })
}));

jest.mock('@/components/contracts/PaymentActionPanel', () => ({
  __esModule: true,
  default: ({ onPay }: { onPay: () => void }) => (
    <button type="button" onClick={onPay}>Pay from wallet</button>
  )
}));

jest.mock('@/components/contracts/QrPaymentPanel', () => ({
  __esModule: true,
  default: () => null
}));

function renderPanel(onFunded = jest.fn()) {
  render(
    <OfferFundingPanel
      vaultAddress="0x66a7000000000000000000000000000000cb5600"
      tokenAddress="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      offerAmount="900"
      lpAddress="0xd36698991EF328275c8F9598A33B2378D7ecE183"
      onFunded={onFunded}
      onCancel={jest.fn()}
    />
  );
  return onFunded;
}

describe('OfferFundingPanel wallet route', () => {
  beforeEach(() => {
    mockFundOffer.mockReset();
    mockCreateContract.mockReset();
  });

  it('opens the offer through fundOffer alone when it succeeds', async () => {
    mockFundOffer.mockImplementation(async (_v, _t, _a, onDeposited?: () => void) => {
      onDeposited?.();
      return '0xtransfer';
    });
    const onFunded = renderPanel();

    fireEvent.click(screen.getByText('Pay from wallet'));

    await waitFor(() => expect(onFunded).toHaveBeenCalled());
    expect(mockCreateContract).not.toHaveBeenCalled();
  });

  it('arms the recovery only after the deposit landed and the open failed', async () => {
    mockFundOffer.mockImplementation(async (_v, _t, _a, onDeposited?: () => void) => {
      onDeposited?.();
      throw new Error('Your deposit arrived, but the offer could not be opened. Retry opening it.');
    });
    renderPanel();

    fireEvent.click(screen.getByText('Pay from wallet'));

    await waitFor(() => expect(mockCreateContract).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Open my offer')).toBeTruthy();
  });

  it('does not arm the recovery when the transfer itself failed', async () => {
    mockFundOffer.mockRejectedValue(new Error('User rejected the request'));
    renderPanel();

    fireEvent.click(screen.getByText('Pay from wallet'));

    expect(await screen.findByText('User rejected the request')).toBeTruthy();
    expect(mockCreateContract).not.toHaveBeenCalled();
  });
});
