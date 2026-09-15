/**
 * The reserve detail view, from the supplier's side.
 *
 * The row has space for one sentence; this has space for the condition attached to the money,
 * which is the part that matters. Two states carry NO figure and none may be invented — while a
 * dispute is open the split turns on votes that have not matched, and an unreadable escrow tells
 * us nothing at all. A confident total in either case is a promise the contract may refuse.
 *
 * Amounts are microUSDC: 10_000_000 is $10.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { explorerBaseUrl: 'https://basescan.org' }, isLoading: false }),
}));

import ReserveDetailsModal from '@/components/marketplace/ReserveDetailsModal';
import type { ReserveView } from '@/types/marketplace';

const reserve = (overrides: Partial<ReserveView> = {}): ReserveView =>
  ({
    vaultAddress: '0xvault',
    escrowContract: '0xescrow1111111111111111111111111111111111',
    lp: '0x2222222222222222222222222222222222222222',
    token: '0xtoken',
    holdback: '10000000',
    state: 'LIVE',
    dueBack: '10000000',
    releasable: false,
    maturity: Math.floor(Date.UTC(2026, 11, 25, 9, 30) / 1000),
    resolvedBuyerPercentage: null,
    lastEventAt: Math.floor(Date.now() / 1000),
    ...overrides,
  }) as ReserveView;

const renderModal = (r: Partial<ReserveView> = {}, props: Record<string, unknown> = {}) =>
  render(
    <ReserveDetailsModal
      isOpen
      onClose={jest.fn()}
      reserve={reserve(r)}
      tokenSymbol="USDC"
      busy={false}
      onRelease={jest.fn()}
      {...props}
    />
  );

describe('ReserveDetailsModal', () => {
  it('shows what was held back and when the contract completes', () => {
    renderModal();

    expect(screen.getByText('Held back when you sold')).toBeInTheDocument();
    expect(screen.getByText('Completes')).toBeInTheDocument();
    // Date AND time: a contract completing that morning matters to someone deciding to wait.
    expect(screen.getByText(/25\/12\/2026|2026/)).toBeInTheDocument();
  });

  describe('while the contract is still running', () => {
    it('says the full amount is conditional, not owed', () => {
      renderModal({ state: 'LIVE' });

      expect(screen.getByText(/unless the customer disputes/i)).toBeInTheDocument();
      expect(screen.getByText(/if nothing further happens/i)).toBeInTheDocument();
    });
  });

  describe('while a dispute is open', () => {
    it('gives no figure at all, and says why', () => {
      // The trap: showing the full reserve here is a promise the contract may refuse.
      renderModal({ state: 'DISPUTED', dueBack: null });

      expect(screen.getByText(/no figure yet/i)).toBeInTheDocument();
      expect(screen.queryByText('Comes back to you')).not.toBeInTheDocument();
    });
  });

  describe('after a resolved dispute', () => {
    it('shows the award coming out of the reserve first', () => {
      // $10 held, 40% to the customer, $6 back. The subtraction is the explanation.
      renderModal({
        state: 'RESOLVED',
        dueBack: '6000000',
        resolvedBuyerPercentage: 40,
        releasable: true,
      });

      expect(screen.getByText("Customer's award (40%)")).toBeInTheDocument();
      expect(screen.getByText(/− \$4\.0000 USDC/)).toBeInTheDocument();
      expect(screen.getByText('Comes back to you')).toBeInTheDocument();
    });

    it('does not invent an award on a contract that was never disputed', () => {
      renderModal({ state: 'SETTLED', dueBack: '10000000', releasable: true });

      expect(screen.queryByText(/Customer's award/)).not.toBeInTheDocument();
    });
  });

  describe('when the contract could not be read', () => {
    it('says so rather than claiming nothing is owed', () => {
      renderModal({ state: 'UNKNOWN', dueBack: null });

      // Said in both panels, and they are not the same statement: one withholds the figure,
      // the other reassures that the money is unaffected by our inability to read it.
      expect(screen.getByText(/what comes back is not known/i)).toBeInTheDocument();
      expect(screen.getByText(/does not affect the money/i)).toBeInTheDocument();
      expect(screen.queryByText('Comes back to you')).not.toBeInTheDocument();
    });
  });

  describe('collecting', () => {
    it('offers the release only when the vault would accept it', () => {
      renderModal({ state: 'SETTLED', releasable: true });

      expect(screen.getByRole('button', { name: /return my reserve/i })).toBeInTheDocument();
    });

    it('offers nothing to press while the contract is still running', () => {
      renderModal({ state: 'LIVE', releasable: false });

      expect(screen.queryByRole('button', { name: /return my reserve/i })).not.toBeInTheDocument();
    });

    it('releases when pressed', async () => {
      const onRelease = jest.fn();
      renderModal({ state: 'SETTLED', releasable: true }, { onRelease });

      await userEvent.click(screen.getByRole('button', { name: /return my reserve/i }));

      expect(onRelease).toHaveBeenCalled();
    });

    it('says the sweeper will do it anyway', () => {
      // The supplier's real question, since selling took them out of the flow entirely: do I
      // have to keep checking? They do not, and the button is only a shortcut.
      renderModal({ state: 'SETTLED', releasable: true });

      expect(screen.getByText(/You do not have to watch for this/i)).toBeInTheDocument();
      expect(screen.getByText(/returned to you automatically/i)).toBeInTheDocument();
    });

    it('drops that reassurance once the money is already paid', () => {
      renderModal({ state: 'RELEASED', dueBack: '10000000' });

      expect(screen.queryByText(/You do not have to watch for this/i)).not.toBeInTheDocument();
      expect(screen.getByText('returned to you')).toBeInTheDocument();
    });
  });

  it('uses no dark: variants, which the shared Modal cannot support', () => {
    // Modal paints bg-white with no dark surface, so a dark: panel renders dark grey on a white
    // sheet whenever the theme is dark.
    const { container } = renderModal();

    const withDark = Array.from(container.querySelectorAll('[class]')).filter((el) =>
      el.getAttribute('class')!.includes('dark:')
    );

    expect(withDark.map((el) => el.getAttribute('class'))).toEqual([]);
  });
});
