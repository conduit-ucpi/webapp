/**
 * The offer detail view, from the seller's side.
 *
 * A seller here is comparing two futures, and the whole risk is that the screen states them on
 * different bases. Waiting pays the escrow's payout — nominal LESS the platform fee — while the
 * offer pays `netAmount` now and the residual at maturity. Show a gross on one side and a net
 * on the other and one option is flattered, with nothing on screen to say which.
 *
 * The other trap is the residual. It is the seller's own money held back, not a charge, so it
 * appears as a deduction from today's figure AND as an addition to the total. A screen showing
 * only the first reads as a fee.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { explorerBaseUrl: 'https://basescan.org' }, isLoading: false }),
}));

import OfferDetailsModal from '@/components/marketplace/OfferDetailsModal';
import type { OfferView } from '@/types/marketplace';

// $100 nominal, $1 platform fee, so waiting pays $99.
const NOMINAL = 100_000_000;
const PAYOUT = 99_000_000;

// An offer of $90: $0.90 venue fee, $10 residual, so $79.10 lands today.
const offer = (overrides: Partial<OfferView> = {}): OfferView =>
  ({
    vaultAddress: '0xvault',
    escrowContract: '0xescrow',
    lp: '0x1111111111111111111111111111111111111111',
    seller: '0xseller',
    token: '0xtoken',
    offerAmount: '90000000',
    netAmount: '79100000',
    fee: '900000',
    holdback: '10000000',
    status: 'OPEN',
    expired: false,
    offerExpiry: Math.floor(Date.now() / 1000) + 7200,
    ...overrides,
  }) as OfferView;

const renderModal = (props: Partial<React.ComponentProps<typeof OfferDetailsModal>> = {}) =>
  render(
    <OfferDetailsModal
      isOpen
      onClose={jest.fn()}
      offer={offer()}
      nominalAmount={NOMINAL}
      payoutAmount={PAYOUT}
      tokenSymbol="USDC"
      busy={false}
      stage={null}
      onAccept={jest.fn()}
      onDecline={jest.fn()}
      {...props}
    />
  );

describe('OfferDetailsModal', () => {
  describe('what waiting is worth', () => {
    it('names the escrow fee and the marketplace fee separately', () => {
      // Both appear in this modal and they are different charges. One label for both would
      // read as being charged twice for the same thing.
      renderModal();

      expect(screen.getByText('Platform fee')).toBeInTheDocument();
      expect(screen.getByText('Marketplace fee')).toBeInTheDocument();
    });

    it('shows the nominal, the platform fee, and what actually arrives', () => {
      renderModal();

      expect(screen.getByText('Payment amount')).toBeInTheDocument();
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
      expect(screen.getByText('Platform fee')).toBeInTheDocument();
      expect(screen.getByText('You receive at maturity')).toBeInTheDocument();
      expect(screen.getByText(/\$99\.00/)).toBeInTheDocument();
    });

    it('derives the platform fee from the figures rather than a fee rate', () => {
      // CREATOR_FEE is fixed on each escrow at creation, so a rate applied here would
      // disagree with escrows made under a different schedule. $100 − $99 = $1.
      renderModal();

      const fee = screen.getByText('Platform fee').parentElement;
      expect(fee).toHaveTextContent('1.00');
    });

    it('says so plainly when the payment figures could not be read', () => {
      renderModal({ nominalAmount: undefined, payoutAmount: undefined });

      expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    });
  });

  describe('what the offer is worth', () => {
    it('breaks the offer down to what lands today', () => {
      renderModal();

      expect(screen.getByText('Offer')).toBeInTheDocument();
      expect(screen.getByText('Marketplace fee')).toBeInTheDocument();
      // Scoped to the row: the same figure is also the headline, deliberately — the big
      // number is the answer and the breakdown is the working.
      expect(screen.getByText('You receive today').parentElement).toHaveTextContent('79.10');
    });

    it('leads with what lands today as the headline figure', () => {
      // Same idiom as the dashboard's contract detail modal: the decision figure large at the
      // top, the arithmetic underneath.
      renderModal();

      expect(screen.getByText('paid to you today')).toBeInTheDocument();
      expect(screen.getAllByText(/\$79\.10/).length).toBeGreaterThan(1);
    });

    it('shows the residual coming back, not just being withheld', () => {
      // Deducted from today's figure and added into the total. A screen showing only the
      // deduction reads as a fee on money the seller in fact keeps.
      renderModal();

      expect(screen.getByText('Residual, held back')).toBeInTheDocument();
      expect(screen.getByText('Residual, at maturity')).toBeInTheDocument();
      expect(screen.getByText('Total, if undisputed')).toBeInTheDocument();
      expect(screen.getByText(/\$89\.10/)).toBeInTheDocument();
    });

    it('says the residual is the seller\'s own money', () => {
      renderModal();

      expect(screen.getByText(/your own money/i)).toBeInTheDocument();
    });

    it('omits the residual rows entirely when there is none', () => {
      renderModal({ offer: offer({ holdback: '0', netAmount: '89100000' }) });

      expect(screen.queryByText('Residual, held back')).not.toBeInTheDocument();
      expect(screen.queryByText('Total, if undisputed')).not.toBeInTheDocument();
    });
  });

  describe('the comparison', () => {
    it('compares net against net', () => {
      // $99 waiting vs $89.10 if undisputed = $9.90 given up. Comparing against the $100
      // nominal would say $10.90 and overstate the cost of selling.
      renderModal();

      expect(screen.getByText('What this costs you')).toBeInTheDocument();
      expect(screen.getByText(/\$9\.90/)).toBeInTheDocument();
    });

    it('states the no-dispute assumption', () => {
      renderModal();

      expect(screen.getByText(/assume no dispute is raised/i)).toBeInTheDocument();
    });

    it('hides the comparison when there is nothing to compare against', () => {
      renderModal({ payoutAmount: undefined, nominalAmount: undefined });

      expect(screen.queryByText('What this costs you')).not.toBeInTheDocument();
    });
  });

  describe('the decision', () => {
    it('offers accept and decline', async () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      renderModal({ onAccept, onDecline });

      await userEvent.click(screen.getByRole('button', { name: /accept/i }));
      expect(onAccept).toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /decline/i }));
      expect(onDecline).toHaveBeenCalled();
    });

    it('locks both while a swap is in flight', () => {
      // The accept flow is two transactions with a five-minute fuse; a second press midway
      // starts a competing authorisation.
      renderModal({ busy: true });

      expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled();
    });

    it('reports progress through the two-transaction flow', () => {
      renderModal({ busy: true, stage: 'Authorising the swap…' });

      expect(screen.getByText('Authorising the swap…')).toBeInTheDocument();
    });
  });
});
