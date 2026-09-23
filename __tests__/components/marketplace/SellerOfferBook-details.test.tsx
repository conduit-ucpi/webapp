/**
 * The "View details" entry point on the seller's offer book.
 *
 * It lives on the OFFER row, not the payment row, so it only exists once an LP has actually
 * bid. That is the right place for it — there is no offer to detail otherwise — but it means
 * "I can't see it" has two very different causes, and this pins which one is which.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const offers = jest.fn();
jest.mock('@/hooks/useMarketplaceData', () => ({
  useOfferBook: () => offers(),
  useRefreshFromChain: () => ({ refresh: jest.fn(), refreshing: false }),
}));
jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    approveRecipientTransfer: jest.fn(),
    acceptOffer: jest.fn(),
    rejectOffer: jest.fn(),
  }),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { tokenSymbol: 'USDC', explorerBaseUrl: 'https://basescan.org' }, isLoading: false }),
}));

import SellerOfferBook from '@/components/marketplace/SellerOfferBook';

const anOffer = (overrides = {}) => ({
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
});

const withOffers = (list: unknown[]) =>
  offers.mockReturnValue({
    data: { offers: list, lastReconciledAt: Math.floor(Date.now() / 1000) },
    loading: false,
    error: null,
    refetch: jest.fn(),
  });

const renderBook = () =>
  render(
    <SellerOfferBook
      escrowContract="0xescrow"
      maturityAmount={99_000_000}
      nominalAmount={100_000_000}
      maturity={Math.floor(Date.now() / 1000) + 86_400 * 30}
    />
  );

describe('SellerOfferBook — View details', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers it on each standing offer', () => {
    withOffers([anOffer()]);
    renderBook();

    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('opens the detail view with this offer\'s figures', async () => {
    withOffers([anOffer()]);
    renderBook();

    await userEvent.click(screen.getByRole('button', { name: /view details/i }));

    await waitFor(() => expect(screen.getByText('Offer details')).toBeInTheDocument());
    // The comparison only appears when the payment's own figures reached the modal, so this
    // also pins that nominalAmount and payoutAmount are actually threaded through.
    expect(screen.getByText('What this costs you')).toBeInTheDocument();
    expect(screen.getByText('You receive at maturity')).toBeInTheDocument();
  });

  describe('when there is nothing to detail', () => {
    // The case behind "I can't see the button": no LP has bid, so there is no offer row and
    // therefore no entry point. Distinct from the button being missing.
    it('shows no offers and no buttons at all', () => {
      withOffers([]);
      renderBook();

      expect(screen.getByText(/no offers on this payment yet/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    });

    it('ignores an unfunded vault, which is not an offer', () => {
      // PENDING means the vault exists but the LP never funded it (§5.0). Showing it would
      // advertise an offer nobody has committed to.
      withOffers([anOffer({ status: 'PENDING' })]);
      renderBook();

      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    });

    it('ignores a lapsed offer', () => {
      withOffers([anOffer({ expired: true })]);
      renderBook();

      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    });
  });
});
