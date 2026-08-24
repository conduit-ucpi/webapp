import { acceptableOffers, looksWithdrawable, needsOpening, offerStatusLabel } from '@/utils/marketplace';
import type { OfferView } from '@/types/marketplace';

/**
 * MARKETPLACE_OPENSPEC §5.0, §6.4, §15.6d.
 *
 * Both rules below fail silently rather than loudly if they are wrong:
 *
 *   - Showing a PENDING vault advertises an offer nobody has funded. The seller sees capital
 *     that does not exist, and finds out only when acceptance reverts.
 *   - Missing a withdrawable offer strands an LP's capital indefinitely. Nothing on-chain
 *     announces expiry — it emits no event at all — so if this UI does not notice, nobody does.
 */

function offer(overrides: Partial<OfferView> = {}): OfferView {
  return {
    vaultAddress: '0xvault',
    escrowContract: '0xescrow',
    lp: '0xlp',
    seller: '0xseller',
    token: '0xtoken',
    offerAmount: '9000000',
    netAmount: '8900000',
    fee: '100000',
    holdback: '0',
    offerExpiry: Math.floor(Date.now() / 1000) + 3600,
    status: 'OPEN',
    expired: false,
    lastEventAt: Math.floor(Date.now() / 1000),
    releasable: false,
    ...overrides
  };
}

describe('Which offers a seller may act on', () => {
  it('excludes a vault the LP has not funded', () => {
    // createOffer deploys an empty shell; only fund() puts capital in it. Listing it would
    // advertise an offer nobody has committed to.
    expect(acceptableOffers([offer({ status: 'PENDING' })])).toHaveLength(0);
  });

  it('excludes a lapsed offer', () => {
    // The contract refuses it, so presenting it as acceptable sets the seller up for a revert.
    expect(acceptableOffers([offer({ expired: true })])).toHaveLength(0);
  });

  it('includes a funded, live offer', () => {
    expect(acceptableOffers([offer()])).toHaveLength(1);
  });

  it('excludes offers that already reached a terminal state', () => {
    const terminal: OfferView[] = [
      offer({ status: 'ACCEPTED' }),
      offer({ status: 'REJECTED' }),
      offer({ status: 'WITHDRAWN' }),
      offer({ status: 'RELEASED' })
    ];
    expect(acceptableOffers(terminal)).toHaveLength(0);
  });
});

describe('When an LP can recover their capital', () => {
  it('flags a lapsed offer', () => {
    // Expiry emits no event. If this is not derived, the LP is never prompted and their capital
    // sits idle for good.
    expect(looksWithdrawable(offer({ expired: true }))).toBe(true);
  });

  it('flags a declined offer', () => {
    // Rejection does not return the money — the vault keeps it until the LP withdraws.
    expect(looksWithdrawable(offer({ status: 'REJECTED' }))).toBe(true);
  });

  it('does not flag a live offer', () => {
    expect(looksWithdrawable(offer())).toBe(false);
  });

  it('does not flag an offer that already paid out', () => {
    // Prompting a withdrawal on an accepted offer invites a signature that can only revert.
    expect(looksWithdrawable(offer({ status: 'ACCEPTED' }))).toBe(false);
  });

  it('does not flag capital already withdrawn', () => {
    expect(looksWithdrawable(offer({ status: 'WITHDRAWN' }))).toBe(false);
  });
});

describe('Offer status labels', () => {
  it('tells a lapsed offer apart from a standing one', () => {
    expect(offerStatusLabel(offer())).toBe('Standing');
    expect(offerStatusLabel(offer({ expired: true }))).toBe('Lapsed — withdraw');
  });

  it('says an unfunded vault is not funded rather than calling it an offer', () => {
    expect(offerStatusLabel(offer({ status: 'PENDING' }))).toBe('Not funded');
  });
});

/**
 * A PENDING vault can hold money now that funding is a direct transfer. These cover the two
 * states the UI must tell apart — nobody funded it, vs. a deposit landed and never opened —
 * because conflating them either hides an LP's capital or sends them to a reverting call.
 */
describe('PENDING vaults holding a direct-transfer deposit', () => {
  const pending = (over: Partial<OfferView> = {}): OfferView =>
    ({
      vaultAddress: '0xvault',
      escrowContract: '0xescrow',
      lp: '0xlp',
      seller: '0xseller',
      token: '0xtoken',
      offerAmount: '1000000',
      netAmount: '990000',
      fee: '10000',
      holdback: '0',
      offerExpiry: 0,
      status: 'PENDING',
      expired: false,
      lastEventAt: 0,
      ...over,
    }) as OfferView;

  it('offers the open when a deposit landed and the offer is still live', () => {
    const offer = pending({ depositedAmount: '1000000' });
    expect(needsOpening(offer)).toBe(true);
    expect(looksWithdrawable(offer)).toBe(false);
    expect(offerStatusLabel(offer)).toBe('Deposit received — open it');
  });

  it('offers the withdrawal once a vault holding a deposit has lapsed', () => {
    const offer = pending({ depositedAmount: '1000000', expired: true });
    expect(needsOpening(offer)).toBe(false);
    expect(looksWithdrawable(offer)).toBe(true);
    expect(offerStatusLabel(offer)).toBe('Deposit parked — withdraw');
  });

  it('recovers a PARTIAL deposit — fund() never succeeded, so the money is still stuck', () => {
    const offer = pending({ depositedAmount: '400000', expired: true });
    expect(looksWithdrawable(offer)).toBe(true);
  });

  it('stays silent on a vault nobody funded', () => {
    const offer = pending({ depositedAmount: '0', expired: true });
    expect(needsOpening(offer)).toBe(false);
    expect(looksWithdrawable(offer)).toBe(false);
    expect(offerStatusLabel(offer)).toBe('Not funded');
  });

  it('treats an unread balance as unknown, never as empty', () => {
    // The balance read can fail. Claiming "nothing to recover" on that basis would be a
    // guess about someone's money, so absence must suppress the prompts, not assert zero.
    const offer = pending({ depositedAmount: null, expired: true });
    expect(needsOpening(offer)).toBe(false);
    expect(looksWithdrawable(offer)).toBe(false);
  });
});
