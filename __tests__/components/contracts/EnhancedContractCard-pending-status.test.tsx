/**
 * Pending contracts on the dashboard must surface a clear status:
 * "PENDING FUNDING" — not just "PENDING" — so the buyer immediately
 * understands the next step is to fund the escrow.
 */

import { render, screen } from '@testing-library/react';
import EnhancedContractCard from '@/components/contracts/EnhancedContractCard';
import type { PendingContract } from '@/types';

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(() => ({
    user: { walletAddress: '0xbuyer', email: 'buyer@example.com' },
  })),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('@/components/ui/FarcasterNameDisplay', () => () => null);

const PENDING: PendingContract = {
  id: 'contract-1',
  sellerEmail: 'seller@example.com',
  buyerEmail: 'buyer@example.com',
  amount: 1000000,
  currency: 'USDC',
  sellerAddress: '0xseller',
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
  description: 'Pending contract',
  createdAt: Math.floor(Date.now() / 1000),
  createdBy: '0xbuyer',
  state: 'OK',
  adminNotes: [],
};

describe('EnhancedContractCard — the token each contract is in', () => {
  const token = () => screen.getByTestId('contract-token').textContent;

  it('shows the contract\'s own token beside its amount', () => {
    render(<EnhancedContractCard contract={{ ...PENDING, currency: 'microUSDT', currencySymbol: 'USDT' }} />);
    expect(token()).toBe('USDT');
  });

  it('reads it from the currency when the record has no symbol', () => {
    render(<EnhancedContractCard contract={{ ...PENDING, currency: 'microUSDT' }} />);
    expect(token()).toBe('USDT');
  });

  it('is USDC for a record from before there was a second token', () => {
    render(<EnhancedContractCard contract={PENDING} />);
    expect(token()).toBe('USDC');
  });
});

describe('EnhancedContractCard — pending status label', () => {
  it('renders "PENDING FUNDING" (not just "PENDING") for a pending contract', () => {
    render(<EnhancedContractCard contract={PENDING} />);

    expect(screen.getAllByText('PENDING FUNDING').length).toBeGreaterThan(0);
    // Make sure the bare "PENDING" label doesn't appear anywhere as a status.
    expect(screen.queryByText(/^PENDING$/)).not.toBeInTheDocument();
  });
});
