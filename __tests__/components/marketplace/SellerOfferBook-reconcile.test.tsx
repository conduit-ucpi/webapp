/**
 * How the offer book stops offering an offer the seller has just ended — by accepting it or
 * by declining it.
 *
 * ⚠️ THE BOOK IS CONTRACTSERVICE'S INDEX, NOT THE CHAIN. `OfferAccepted` has to travel
 *    chain → chainservice → contractservice before that index stops reporting the offer as
 *    OPEN, and a refetch fired straight after the swap usually beats it there. So the offer
 *    comes back acceptable, the seller presses it again, and the second swap reverts — the
 *    escrow has already changed hands — after two more signatures.
 *
 *    Both go from the seller's OWN wallet, because the contracts require it, so chainservice
 *    cannot observe either one. The fix is to make the event REACH contractservice first: `refresh` has it read the
 *    chain for this seller's escrows and ingest what it finds, and only returns once that is
 *    done. The UI hides nothing of its own; the offer disappears because the index says
 *    ACCEPTED.
 *
 * The losing offers close in the same pass, and not via their own status: no event names a
 * losing vault, so the index reports the sale on the ESCROW (`escrowSold`) instead.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const offerBook = jest.fn();
const refetch = jest.fn();
const refresh = jest.fn();
const approveRecipientTransfer = jest.fn();
const acceptOffer = jest.fn();
const rejectOffer = jest.fn();

jest.mock('@/hooks/useMarketplaceData', () => ({
  useOfferBook: () => offerBook(),
  useRefreshFromChain: () => ({ refresh, refreshing: false }),
}));
jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({ approveRecipientTransfer, acceptOffer, rejectOffer }),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: { tokenSymbol: 'USDC', explorerBaseUrl: 'https://basescan.org' },
    isLoading: false,
  }),
}));

import SellerOfferBook from '@/components/marketplace/SellerOfferBook';

const anOffer = (overrides = {}) => ({
  vaultAddress: '0xvault1',
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

const book = (list: unknown[]) =>
  offerBook.mockReturnValue({
    data: { offers: list, lastReconciledAt: Math.floor(Date.now() / 1000) },
    loading: false,
    error: null,
    refetch,
  });

const renderBook = () =>
  render(<SellerOfferBook escrowContract="0xescrow" maturityAmount={99_000_000} />);

/** The first match: with two offers on the book there are two Accept buttons. */
const press = async (label: RegExp) => {
  await userEvent.click(screen.getAllByRole('button', { name: label })[0]);
};

const acceptFirstOffer = async () => {
  await press(/^accept$/i);
  await press(/confirm — get paid now/i);
};

describe('SellerOfferBook — accepting an offer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    approveRecipientTransfer.mockResolvedValue('0xapprove');
    acceptOffer.mockResolvedValue('0xaccept');
    rejectOffer.mockResolvedValue('0xreject');
    refresh.mockResolvedValue({ success: true, escrowsReconciled: 1, eventsFound: 1 });
  });

  it('has contractservice reconcile the acceptance rather than re-reading the stale index', async () => {
    book([anOffer()]);
    renderBook();

    await acceptFirstOffer();

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('reconciles only after the swap, never before it', async () => {
    // Reconciling first would index the state the acceptance is about to replace, and the
    // book would close on an event that had not happened.
    const order: string[] = [];
    acceptOffer.mockImplementation(async () => {
      order.push('accept');
      return '0xaccept';
    });
    refresh.mockImplementation(async () => {
      order.push('refresh');
      return { success: true };
    });
    book([anOffer()]);
    renderBook();

    await acceptFirstOffer();

    await waitFor(() => expect(order).toEqual(['accept', 'refresh']));
  });

  it('stops offering the offer once the index reports it ACCEPTED', async () => {
    book([anOffer()]);
    renderBook();

    // What the reconcile puts in the index: the same offer, no longer open.
    refresh.mockImplementation(async () => {
      book([anOffer({ status: 'ACCEPTED' })]);
      return { success: true };
    });

    await acceptFirstOffer();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
    );
  });

  it('stops offering the OTHER offers too, since the cashflow is gone', async () => {
    /*
     * Accepting one offer sells the cashflow, so every other offer on it is dead — their
     * vaults revert `OfferStale` once the sale has moved the recipient.
     *
     * ⚠️ THE LOSER'S OWN STATUS NEVER LEARNS THIS. The chain emits no event naming it, so it
     *    folds to OPEN for ever. The index says so on the ESCROW instead (`escrowSold`), which
     *    is what `acceptableOffers` reads — so the row closes on the sale, not on a status the
     *    loser will never have.
     */
    book([anOffer(), anOffer({ vaultAddress: '0xvault2' })]);
    renderBook();

    // What the reconcile produces: the winner's own event, and the escrow marked sold across
    // the whole book. The loser is still OPEN, and still unexpired.
    refresh.mockImplementation(async () => {
      book([
        anOffer({ status: 'ACCEPTED', escrowSold: true }),
        anOffer({ vaultAddress: '0xvault2', escrowSold: true }),
      ]);
      return { success: true };
    });

    await acceptFirstOffer();

    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /^accept$/i })).toHaveLength(0)
    );
  });

  describe('when the reconcile does not land', () => {
    it('still re-reads the book, rather than leaving the screen as it was', async () => {
      // useRefreshFromChain calls no refetch of its own on failure, so without this the book
      // sits un-re-read on exactly the path where it is most stale.
      refresh.mockResolvedValue(null);
      book([anOffer()]);
      renderBook();

      await acceptFirstOffer();

      await waitFor(() => expect(refetch).toHaveBeenCalled());
    });
  });

  describe('when the swap fails', () => {
    it('reconciles nothing, because nothing was sold', async () => {
      // The five-minute authorisation lapsing is an ordinary outcome: the offer is still
      // live, still acceptable, and the seller simply starts again.
      acceptOffer.mockRejectedValue(new Error('authorisation lapsed'));
      book([anOffer()]);
      renderBook();

      await acceptFirstOffer();

      expect(await screen.findByText(/authorisation lapsed/i)).toBeInTheDocument();
      expect(refresh).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    });
  });
});

/**
 * Declining has the same staleness, for the same reason: `reject()` goes from the seller's own
 * wallet, so chainservice never sees it and `OfferRejected` reaches the index only when someone
 * reconciles. A bare refetch brings the offer back OPEN and the seller is looking at a bid they
 * have already killed.
 */
describe('SellerOfferBook — declining an offer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rejectOffer.mockResolvedValue('0xreject');
    refresh.mockResolvedValue({ success: true, escrowsReconciled: 1, eventsFound: 1 });
  });

  it('has contractservice reconcile the rejection rather than re-reading the stale index', async () => {
    book([anOffer()]);
    renderBook();

    await press(/^decline$/i);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('stops offering the offer once the index reports it REJECTED', async () => {
    book([anOffer()]);
    renderBook();

    refresh.mockImplementation(async () => {
      book([anOffer({ status: 'REJECTED' })]);
      return { success: true };
    });

    await press(/^decline$/i);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument()
    );
  });

  it('still re-reads the book when the reconcile does not land', async () => {
    refresh.mockResolvedValue(null);
    book([anOffer()]);
    renderBook();

    await press(/^decline$/i);

    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('reconciles nothing when the rejection itself failed', async () => {
    // The offer is untouched on-chain, so there is nothing new to index and the offer must
    // stay acceptable.
    rejectOffer.mockRejectedValue(new Error('wallet said no'));
    book([anOffer()]);
    renderBook();

    await press(/^decline$/i);

    expect(await screen.findByText(/wallet said no/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
  });
});
