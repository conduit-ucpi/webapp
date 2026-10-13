/**
 * The details window's badge shows the contract's STATUS, the same as the dashboard card —
 * never the backend's call to action. It used to show `ctaLabel`, so an ordinary active deal
 * was headed "Raise Dispute", as if that were its state.
 */
import { render, screen, within } from '@testing-library/react';
import ContractDetailsModal from '@/components/contracts/ContractDetailsModal';
import type { Contract } from '@/types';

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(() => ({ user: { walletAddress: '0xbuyer', email: 'buyer@example.com' } })),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { chainId: 8453, explorerBaseUrl: 'https://base.blockscout.com' } }),
}));
jest.mock('@/components/contracts/ContractActions', () => () => <div data-testid="actions" />);
jest.mock('@/components/ui/FarcasterNameDisplay', () => () => null);
jest.mock('@/components/ui/Modal', () => ({ isOpen, title, children }: any) =>
  isOpen ? (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ) : null
);

const ACTIVE: Contract = {
  id: 'contract-1',
  contractAddress: '0xAfbc0229403B3b80055Ab297070bC73ef2d84964',
  buyerAddress: '0xbuyer',
  sellerAddress: '0xseller',
  amount: 1000,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 3600,
  description: 'UI test',
  status: 'ACTIVE',
  createdAt: Math.floor(Date.now() / 1000),
  funded: true,
  ctaType: 'RAISE_DISPUTE',
  ctaLabel: 'Raise Dispute',
  ctaVariant: 'action',
} as Contract;

const header = () => screen.getByRole('heading', { name: 'UI test' }).parentElement!.parentElement!;

describe('ContractDetailsModal — status badge', () => {
  it('shows the status of an active deal, not its call to action', () => {
    render(<ContractDetailsModal isOpen contract={ACTIVE} onClose={jest.fn()} onRefresh={jest.fn()} />);
    expect(within(header()).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(header()).queryByText('Raise Dispute')).toBeNull();
  });

  it('colours the badge by status, as the card does', () => {
    render(
      <ContractDetailsModal isOpen contract={{ ...ACTIVE, status: 'DISPUTED', ctaLabel: 'Manage Dispute' }} onClose={jest.fn()} onRefresh={jest.fn()} />
    );
    const badge = within(header()).getByText('DISPUTED');
    expect(badge.className).toContain('text-error-600');
  });
});
