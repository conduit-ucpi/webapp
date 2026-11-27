/**
 * Zipchat's suggested questions (<zipchat-pdp-questions>) go under "Card or bank" on /contract-pay
 * when the buyer has to buy stablecoins to pay: the wallet is short. Not when it can pay, not
 * under "Crypto I already have", not in a seller's preview, and not on a partner's page, where
 * Zipchat's script never loads.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import { useOnrampMinimum } from '@/hooks/useOnrampMinimum';
import { useCoinbaseAvailability } from '@/hooks/useCoinbaseAvailability';
import { usePartnerBrand } from '@/theme/BrandProvider';

jest.mock('@/hooks/useOnrampMinimum');
jest.mock('@/hooks/useCoinbaseAvailability');
jest.mock('@/theme/BrandProvider', () => ({
  ...jest.requireActual('@/theme/BrandProvider'),
  usePartnerBrand: jest.fn(),
}));
jest.mock('@/hooks/useLinkAvailability', () => ({
  useLinkAvailability: () => ({ unavailable: false, countryName: null, overrule: jest.fn() }),
}));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => false, fundWallet: jest.fn() }),
}));

const props = (overrides: Record<string, unknown> = {}) => ({
  amountLabel: '20 USDC',
  amountInTokens: 20,
  balanceFloat: 0,
  tokenSymbol: 'USDC',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  tokenDecimals: 6,
  chainId: 8453,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  networkName: 'Base',
  isLoadingBalance: false,
  hasInsufficientBalance: true,
  isSameAddress: false,
  isPaymentInProgress: false,
  onPay: jest.fn(),
  onPayFromExternalWallet: jest.fn(),
  onRefreshBalance: jest.fn(),
  resolveEscrowAddress: async () => '0xcontract',
  elsewherePanel: <div>the payment address panel</div>,
  buyQuestions: true,
  ...overrides,
});

const questions = () => document.querySelector('zipchat-pdp-questions');

beforeEach(() => {
  (useOnrampMinimum as jest.Mock).mockReturnValue(null);
  (useCoinbaseAvailability as jest.Mock).mockReturnValue({ unavailable: false, countryName: null, overrule: jest.fn() });
  (usePartnerBrand as jest.Mock).mockReturnValue(null);
});

it('is under "Card or bank" when the wallet is short', () => {
  render(<PaymentActionPanel {...props()} />);
  const card = screen.getByRole('region', { name: 'Card or bank' });
  expect(card.querySelector('zipchat-pdp-questions')).not.toBeNull();
});

it('goes when the buyer answers "Crypto I already have"', () => {
  render(<PaymentActionPanel {...props()} />);
  fireEvent.click(screen.getByRole('button', { name: /Crypto I already have/ }));
  expect(questions()).toBeNull();
});

it('is not there when the wallet can pay', () => {
  render(<PaymentActionPanel {...props({ balanceFloat: 25, hasInsufficientBalance: false })} />);
  expect(questions()).toBeNull();
});

it('is only where the page asks for it (/contract-pay, not /pay)', () => {
  render(<PaymentActionPanel {...props({ buyQuestions: false })} />);
  expect(questions()).toBeNull();
});

it("is not in a seller's preview", () => {
  render(<PaymentActionPanel {...props({ preview: true })} />);
  expect(questions()).toBeNull();
});

it("is not on a partner's page, where Zipchat does not load", () => {
  (usePartnerBrand as jest.Mock).mockReturnValue({ id: 'partner' });
  render(<PaymentActionPanel {...props()} />);
  expect(questions()).toBeNull();
});
