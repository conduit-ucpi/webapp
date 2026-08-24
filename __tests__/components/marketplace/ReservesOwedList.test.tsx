import { render, screen } from '@testing-library/react';
import ReservesOwedList from '@/components/marketplace/ReservesOwedList';
import { useSellerReserves } from '@/hooks/useMarketplaceData';
import { useConfig } from '@/components/auth/ConfigProvider';
import type { ReserveView } from '@/types/marketplace';

/**
 * The supplier's only view of money owed to them (§6.7).
 *
 * ⚠️ WHAT IS PINNED HERE IS THE ABSENCE OF A FIGURE, NOT ITS PRESENCE. Two of the five states —
 *    a dispute still in flight, and an escrow nobody could read — have no knowable answer, and
 *    the failure mode is silent: a component that quietly falls back to the full reserve tells a
 *    supplier they are getting money the contract is about to give someone else. The renders
 *    still succeed, the number is just wrong, so only a test catches it.
 */

jest.mock('@/hooks/useMarketplaceData', () => ({
  useSellerReserves: jest.fn(),
  // Releasing reconciles the chain before re-reading the list, because the row closes only
  // once `HoldbackReleased` is in the index and nothing guarantees the push put it there.
  useRefreshFromChain: jest.fn(() => ({
    refresh: jest.fn(),
    refreshing: false,
    lastResult: null,
    error: null
  }))
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn()
}));

jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({ releaseHoldback: jest.fn() })
}));

const mockUseSellerReserves = useSellerReserves as jest.MockedFunction<typeof useSellerReserves>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

const SELLER = '0x1111111111111111111111111111111111111111';

const reserve = (overrides: Partial<ReserveView> = {}): ReserveView => ({
  vaultAddress: '0xvault',
  escrowContract: '0xescrow',
  lp: '0xlp',
  token: '0xtoken',
  holdback: '100000000', // 100 USDC
  state: 'LIVE',
  dueBack: '100000000',
  releasable: false,
  maturity: null,
  resolvedBuyerPercentage: null,
  lastEventAt: 1_754_000_000,
  ...overrides
});

function showing(reserves: ReserveView[], { error = null }: { error?: string | null } = {}) {
  mockUseSellerReserves.mockReturnValue({
    data: reserves,
    loading: false,
    error,
    refetch: jest.fn()
  });
  return render(<ReservesOwedList sellerAddress={SELLER} />);
}

describe('reserves owed to a supplier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConfig.mockReturnValue({ config: { tokenSymbol: 'USDC' } } as any);
  });

  it('renders nothing at all when no reserve is owed', () => {
    // The dashboard belongs to everyone; almost nobody has ever sold a payment.
    const { container } = showing([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the full reserve while the contract is running, and says it is conditional', () => {
    showing([reserve({ state: 'LIVE', dueBack: '100000000' })]);

    expect(screen.getByText(/100(\.\d+)? USDC held back/i)).toBeInTheDocument();
    // ⚠️ The buyer can dispute right up to maturity, so this figure is not owed yet.
    expect(screen.getByText(/unless the customer disputes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return my reserve/i })).not.toBeInTheDocument();
  });

  it('gives NO figure while a dispute is open', () => {
    showing([reserve({ state: 'DISPUTED', dueBack: null })]);

    expect(screen.getByText(/not known until it resolves/i)).toBeInTheDocument();
    // The reserve is named only as a ceiling — never as an amount coming back.
    expect(screen.getByText(/up to \$?100(\.\d+)? USDC/i)).toBeInTheDocument();
  });

  it('offers collection once the contract settled clean', () => {
    showing([reserve({ state: 'SETTLED', dueBack: '100000000', releasable: true })]);

    expect(screen.getByText(/100(\.\d+)? USDC due back to you/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return my reserve/i })).toBeEnabled();
    // Relayed: pressing it costs nothing and needs no wallet.
    expect(screen.getByText(/needs no signature/i)).toBeInTheDocument();
  });

  it('shows only the remainder after a resolved dispute', () => {
    // 5% of the payment went to the customer, and it came out of the reserve first.
    showing([
      reserve({ state: 'RESOLVED', dueBack: '50000000', releasable: true, resolvedBuyerPercentage: 5 })
    ]);

    expect(screen.getByText(/50(\.\d+)? USDC due back to you/i)).toBeInTheDocument();
    expect(screen.getByText(/5% of the payment went to the customer/i)).toBeInTheDocument();
  });

  it('keeps a released reserve listed, showing what was actually paid', () => {
    // A row that vanishes on payment shows a disappearance, not a payment.
    showing([reserve({ state: 'RELEASED', dueBack: '40000000', releasable: false })]);

    expect(screen.getByText(/40(\.\d+)? USDC returned to you/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return my reserve/i })).not.toBeInTheDocument();
  });

  it('says the state is unknown rather than claiming nothing is owed', () => {
    // ⚠️ An unreadable contract must never render as "nothing due" — the opposite statement
    //    about the same money.
    showing([reserve({ state: 'UNKNOWN', dueBack: null })]);

    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return my reserve/i })).not.toBeInTheDocument();
  });

  it('puts the collectable reserves first', () => {
    showing([
      reserve({ vaultAddress: '0xa', state: 'RELEASED', dueBack: '10000000' }),
      reserve({ vaultAddress: '0xb', state: 'SETTLED', dueBack: '20000000', releasable: true })
    ]);

    const headlines = screen.getAllByText(/USDC (due back to you|returned to you)/i);
    expect(headlines[0]).toHaveTextContent(/due back to you/i);
  });

  it('admits it could not check, rather than showing an empty list', () => {
    showing([], { error: 'boom' });
    expect(screen.getByText(/couldn’t check|couldn't check/i)).toBeInTheDocument();
  });
});
