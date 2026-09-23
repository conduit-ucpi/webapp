import { render, screen, fireEvent } from '@testing-library/react';
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
  useSellerReserves: jest.fn()
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
  const result = render(<ReservesOwedList sellerAddress={SELLER} />);

  /*
   * The section is collapsed by default, so every test about a ROW has to open it first —
   * otherwise it is asserting against hidden content and a role query finds nothing. The
   * collapse itself is covered separately below.
   */
  const toggle = screen.queryByRole('button', { name: /reserves on payments you sold/i });
  if (toggle) fireEvent.click(toggle);

  return result;
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

/**
 * The section collapses.
 *
 * It sits above the contract list on the dashboard and, for most suppliers most of the time, it
 * is a record rather than a task — the sweeper returns the money within half an hour of the
 * contract completing. Open by default it would push the contracts down the page to report
 * something nobody has to act on.
 *
 * Which makes the heading load-bearing: collapsed must not mean hidden, so it still has to say
 * how many there are and whether any can be taken now.
 */
describe('the collapse', () => {
  const settled = () => reserve({ state: 'SETTLED', dueBack: '100000000', releasable: true });

  function render_(reserves: ReserveView[]) {
    mockUseSellerReserves.mockReturnValue({
      data: reserves,
      loading: false,
      error: null,
      refetch: jest.fn()
    });
    return render(<ReservesOwedList sellerAddress={SELLER} />);
  }

  it('starts closed', () => {
    render_([settled()]);

    expect(screen.getByRole('button', { name: /reserves on payments you sold/i }))
      .toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /return my reserve/i })).not.toBeInTheDocument();
  });

  it('opens and closes on the heading', () => {
    render_([settled()]);
    const toggle = screen.getByRole('button', { name: /reserves on payments you sold/i });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /return my reserve/i })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('says how many there are while closed', () => {
    render_([settled(), reserve({ vaultAddress: '0xv2', state: 'LIVE', dueBack: '100000000' })]);

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('says when something can be collected, so closed is not the same as hidden', () => {
    // The one fact worth acting on has to survive the collapse.
    render_([settled()]);

    expect(screen.getByText(/1 reserve is ready to collect/i)).toBeInTheDocument();
  });

  it('says nothing about collecting when nothing can be', () => {
    render_([reserve({ state: 'LIVE', dueBack: '100000000' })]);

    expect(screen.queryByText(/ready to collect/i)).not.toBeInTheDocument();
    expect(screen.getByText(/part of the price was held back/i)).toBeInTheDocument();
  });
});

/**
 * Which payment a reserve came from.
 *
 * ⚠️ NOTHING ELSE ON THE ROW IDENTIFIES IT. Selling hands the recipient role to the LP, so the
 *    escrow drops out of the supplier's own contract list — this row is the last trace of it.
 *    Owed two reserves, they otherwise have a vault address and an amount, and the amounts can
 *    easily be identical.
 */
describe('telling one reserve from another', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConfig.mockReturnValue({ config: { tokenSymbol: 'USDC' } } as any);
  });

  it('shows what the payment was for', () => {
    showing([reserve({ description: 'Oak dining table' })]);

    expect(screen.getByText('Oak dining table')).toBeInTheDocument();
  });

  it('distinguishes two reserves of the identical amount', () => {
    // The case the address alone fails: same figure, same state, two different jobs.
    showing([
      reserve({ vaultAddress: '0xv1', description: 'Oak dining table' }),
      reserve({ vaultAddress: '0xv2', description: 'Walnut sideboard' })
    ]);

    expect(screen.getByText('Oak dining table')).toBeInTheDocument();
    expect(screen.getByText('Walnut sideboard')).toBeInTheDocument();
  });

  it('falls back rather than rendering an empty line when no record matches', () => {
    // description is null when contractservice holds no local record for the escrow.
    showing([reserve({ description: null })]);

    expect(screen.getByText('Payment you sold')).toBeInTheDocument();
  });

  it('falls back on a description that is only whitespace', () => {
    showing([reserve({ description: '   ' })]);

    expect(screen.getByText('Payment you sold')).toBeInTheDocument();
  });

  it('still shows the escrow address, which is what links the row to the chain', () => {
    showing([reserve({ description: 'Oak dining table' })]);

    expect(screen.getByText(/contract 0xescrow/)).toBeInTheDocument();
  });
});
