/**
 * /contract-pay: a thin wrapper over /pay. It finds the request, says when it cannot be paid, and
 * hands PayPage the stored terms — exactly, since they are the escrow's address.
 */
import { render, screen } from '@testing-library/react';

const mockRouter = { isReady: true, query: { contractId: 'req-1' } as Record<string, string>, push: jest.fn(), replace: jest.fn() };
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/auth/ConfigProvider');
jest.mock('@/components/auth');
jest.mock('@/hooks/usePayableContract');
jest.mock('@/components/contracts/PaymentRequestIntro', () => function PaymentRequestIntro() {
  return <div data-testid="intro" />;
});
const payPage = jest.fn((_props: any) => <div data-testid="pay-page" />);
jest.mock('@/pages/PayPage', () => ({ __esModule: true, default: (props: any) => payPage(props) }));

import ContractPay from '@/pages/ContractPayPage';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { usePayableContract } from '@/hooks/usePayableContract';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const contract = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  sellerAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
  sellerEmail: 'seller@example.com',
  amount: 12_500_000,
  currency: 'microUSDC',
  currencySymbol: 'USDC',
  expiryTimestamp: 1900000000,
  description: 'Logo design',
  ...overrides,
});
const loaded = (value: unknown, error: string | null = null) =>
  (usePayableContract as jest.Mock).mockReturnValue({ contract: value, isLoadingContract: false, contractError: error });

beforeEach(() => {
  jest.clearAllMocks();
  (useConfig as jest.Mock).mockReturnValue({
    config: { chainId: 8453, supportedTokens: [{ symbol: 'USDC', address: USDC, decimals: 6 }] },
  });
  (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isConnected: true, address: '0xb', authenticatedFetch: jest.fn() });
});

it('hands PayPage the stored terms, the amount exactly as stored', () => {
  loaded(contract({ arbiterAddress: '0x1111111111111111111111111111111111111111' }));
  render(<ContractPay />);

  const { request } = payPage.mock.calls[0][0];
  expect(request).toMatchObject({
    id: 'req-1',
    sellerLabel: 'seller@example.com',
    terms: {
      seller: '0x742d35cc6634c0532925a3b844bc9e7595f0beb0',
      amount: '12.5',
      amountBaseUnits: 12_500_000,
      description: 'Logo design',
      expiryTimestamp: 1900000000,
      tokenSymbol: 'USDC',
      arbiter: '0x1111111111111111111111111111111111111111',
    },
  });
});

it("does not name a seller by contractservice's placeholder email", () => {
  loaded(contract({ sellerEmail: 'createdempty@conduit-ucpi.com' }));
  render(<ContractPay />);
  expect(payPage.mock.calls[0][0].request.sellerLabel).toBeUndefined();
});

it('says an expired request has expired, rather than that it does not exist', () => {
  loaded(null, 'This payment request has expired.');
  render(<ContractPay />);
  expect(screen.getByText('Payment Request Expired')).toBeInTheDocument();
  expect(payPage).not.toHaveBeenCalled();
});

it('says a missing request is missing', () => {
  loaded(null, 'Failed to fetch contract');
  render(<ContractPay />);
  expect(screen.getByText('Payment Request Not Found')).toBeInTheDocument();
});

it('shows a signed-out visitor the intro before anything else', () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoading: false, isConnected: false, address: null });
  loaded(null);
  render(<ContractPay />);
  expect(screen.getByTestId('intro')).toBeInTheDocument();
});
