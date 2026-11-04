/**
 * The dashboard's view of an instant payment. An expiry of 0 is EscrowContract's instant-transfer
 * sentinel, and read as a date it showed "Expiry Date: 1970" with a red "Expired" on a payment that
 * had simply reached the seller. Its re-sent payment link also described a protected payment.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContractDetailsModal from '@/components/contracts/ContractDetailsModal';
import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import { contractStatusDisplay, isInstantPayment } from '@/utils/contractStatusDisplay';
import type { Contract } from '@/types';

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(() => ({ user: { walletAddress: '0xseller', email: 'seller@example.com' } })),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { chainId: 8453, explorerBaseUrl: 'https://base.blockscout.com' } }),
}));
jest.mock('@/components/contracts/ContractActions', () => () => <div data-testid="actions" />);
jest.mock('@/components/ui/FarcasterNameDisplay', () => ({ identifier, walletAddress }: any) => (
  <span>{identifier || walletAddress || '-'}</span>
));
jest.mock('@/components/ui/Modal', () => ({ isOpen, title, children }: any) =>
  isOpen ? (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ) : null
);
jest.mock('@/components/contracts/SendRequestScreen', () => ({ instant }: { instant?: boolean }) => (
  <div data-testid="send-screen">{instant ? 'instant' : 'protected'}</div>
));

const contract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract-1',
    contractAddress: '0xAfbc0229403B3b80055Ab297070bC73ef2d84964',
    buyerAddress: '0xbuyer',
    sellerAddress: '0xseller',
    amount: 1000,
    expiryTimestamp: 0,
    description: 'Instant test',
    status: 'CLAIMED',
    createdAt: Math.floor(Date.now() / 1000),
    funded: true,
    ...overrides,
  }) as Contract;

const details = (overrides: Partial<Contract> = {}) =>
  render(<ContractDetailsModal isOpen contract={contract(overrides)} onClose={jest.fn()} />);

describe('an instant payment on the dashboard', () => {
  it('only an expiry of exactly zero is instant', () => {
    expect(isInstantPayment(0)).toBe(true);
    expect(isInstantPayment(1736899200)).toBe(false);
    expect(isInstantPayment(undefined)).toBe(false);
  });

  it('reads as paid rather than claimed, because nobody claimed it', () => {
    expect(contractStatusDisplay('CLAIMED', false, true).label).toBe('PAID');
    expect(contractStatusDisplay('CLAIMED', false).label).toBe('CLAIMED');
    expect(contractStatusDisplay('CLAIMED', false, true).color).toBe(contractStatusDisplay('CLAIMED', false).color);
  });

  it('shows no 1970 date, expiry or funding row once paid', () => {
    details();

    expect(screen.queryByText('Expiry Date')).toBeNull();
    expect(screen.queryByText(/Expired/)).toBeNull();
    expect(screen.queryByText(/19(69|70)/)).toBeNull();
    expect(screen.queryByText('Funding Status')).toBeNull();
    expect(screen.getByText('Payment Type')).toBeInTheDocument();
    expect(screen.getByText('Instant')).toBeInTheDocument();
    expect(screen.getByText(/Paid straight to the seller/)).toBeInTheDocument();
    expect(screen.getAllByText('PAID').length).toBeGreaterThan(0);
  });

  it('says what will happen while it is still unpaid', () => {
    details({ status: 'CREATED', funded: false });

    expect(screen.queryByText(/Expired/)).toBeNull();
    expect(screen.getByText(/Goes straight to the seller when paid/)).toBeInTheDocument();
    expect(screen.getByText('Funding Status')).toBeInTheDocument();
  });

  it('re-sends its payment link as an instant payment, not a protected one', async () => {
    render(<EnhancedContractCard contract={contract({ status: 'PENDING', funded: false })} />);

    await userEvent.click(screen.getByRole('button', { name: /send payment link/i }));

    expect(screen.getByTestId('send-screen')).toHaveTextContent('instant');
  });
});

describe('a party with no email', () => {
  const FULL_BUYER = '0x78a6000000000000000000000000000000afbd';

  it('is not called Unknown in the details window', () => {
    details({ buyerAddress: FULL_BUYER, buyerEmail: undefined, sellerEmail: undefined });

    expect(screen.queryByText('Unknown')).toBeNull();
  });

  it('keeps the name line when there is an email', () => {
    details({ buyerAddress: FULL_BUYER, buyerEmail: 'buyer@example.com', sellerEmail: 'seller@example.com' });

    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
  });

  it('is named by wallet on the card', () => {
    render(<EnhancedContractCard contract={contract({ buyerAddress: FULL_BUYER, buyerEmail: undefined })} />);

    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.getByText(/0x78a6/)).toBeInTheDocument();
  });

  it('reads as Unknown on the card only when there is no wallet either', () => {
    render(<EnhancedContractCard contract={contract({ buyerAddress: undefined, buyerEmail: undefined })} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

describe('a dated payment on the dashboard', () => {
  const past = Math.floor(Date.now() / 1000) - 3600;

  it('keeps its expiry date, expired warning, funding row and status', () => {
    details({ expiryTimestamp: past });

    expect(screen.getByText('Expiry Date')).toBeInTheDocument();
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.getByText('Funding Status')).toBeInTheDocument();
    expect(screen.getAllByText('CLAIMED').length).toBeGreaterThan(0);
    expect(screen.queryByText('Payment Type')).toBeNull();
  });

  it('re-sends its payment link as a protected payment', async () => {
    render(
      <EnhancedContractCard
        contract={contract({ status: 'PENDING', funded: false, expiryTimestamp: past + 7200 })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /send payment link/i }));

    expect(screen.getByTestId('send-screen')).toHaveTextContent('protected');
  });
});
