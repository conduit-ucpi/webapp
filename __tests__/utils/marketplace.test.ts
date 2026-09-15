import { acceptableOffers, escrowTitle, looksWithdrawable, needsOpening, offerStatusLabel, priceOffer } from '@/utils/marketplace';
import type { OfferView, SellableEscrow } from '@/types/marketplace';

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


/**
 * What a position is called in the book.
 *
 * `productName` is not a name for the thing being bought. ContractCreatePage
 * sets it to `Order #<id>` for plugin orders and leaves it unset otherwise, so
 * titling rows with it produced a book of order numbers — and, where it was
 * unset, rows that silently fell through to the description anyway. Two screens
 * show this title and they have to agree, which is why it is one function.
 */
describe('escrowTitle', () => {
  const escrow = (description: string | null) => ({ description }) as SellableEscrow;

  it('names the position from its description', () => {
    expect(escrowTitle(escrow('Oak dining table'))).toBe('Oak dining table');
  });

  it('ignores productName entirely', () => {
    // The regression: an order number is not a name for a thing. Passing one
    // alongside a description must change nothing.
    const withOrderNumber = {
      description: 'Oak dining table',
      productName: 'Order #4471',
    } as SellableEscrow;

    expect(escrowTitle(withOrderNumber)).toBe('Oak dining table');
  });

  it('falls back when there is no description, rather than to productName', () => {
    const noDescription = { description: null, productName: 'Order #4471' } as SellableEscrow;

    expect(escrowTitle(noDescription)).toBe('Escrow payment');
  });

  it('treats whitespace as no description', () => {
    expect(escrowTitle(escrow('   '))).toBe('Escrow payment');
  });

  it('takes a fallback that reads naturally in a sentence', () => {
    // The modal says "Offer on ...", where "Offer on Escrow payment" is wrong.
    expect(escrowTitle(escrow(null), 'this payment')).toBe('this payment');
  });
});


/**
 * Pricing an offer from the two rates.
 *
 * The rates act on DIFFERENT numbers and compound in one specific order — residual off the
 * cashflow, discount off what is left (§5.3). The screen previously applied the discount to the
 * gross and then took the residual out of the resulting offer, which charged the LP for cashflow
 * they were not advancing against and made the two percentages look like they acted on the same
 * base. Every number below is money, so they are pinned exactly.
 *
 * Amounts are microUSDC: 100_000_000 is $100.
 */
describe('priceOffer', () => {
  const HUNDRED = BigInt(100_000_000);

  it('funds the cashflow less the residual, then discounts what is left', () => {
    // The worked example: $100 cashflow, 10% residual, 10% discount.
    // Funding $90 of it, paying 90% of that = $81.
    const { funded, residual, offer } = priceOffer(HUNDRED, 10, 10);

    expect(funded).toBe(BigInt(90_000_000));
    expect(residual).toBe(BigInt(10_000_000));
    expect(offer).toBe(BigInt(81_000_000));
  });

  it('does not charge the LP for the residual', () => {
    // The regression: discounting the gross gave $90 for a position only $90 of which is
    // being advanced against. The difference is exactly the discount on the residual.
    const { offer } = priceOffer(HUNDRED, 10, 10);

    expect(offer).not.toBe(BigInt(90_000_000));
    expect(HUNDRED - offer).toBe(BigInt(19_000_000));
  });

  it('is just the discount when there is no residual', () => {
    // The default path, and the one that must not have moved.
    const { funded, residual, offer } = priceOffer(HUNDRED, 1.5, 0);

    expect(funded).toBe(HUNDRED);
    expect(residual).toBe(BigInt(0));
    expect(offer).toBe(BigInt(98_500_000));
  });

  it('is just the residual when the discount is zero', () => {
    const { funded, offer } = priceOffer(HUNDRED, 0, 10);

    expect(funded).toBe(BigInt(90_000_000));
    expect(offer).toBe(BigInt(90_000_000));
  });

  it('splits the cashflow exactly, whatever the rounding did', () => {
    // funded + residual must reconstruct the cashflow to the base unit. An amount and a rate
    // chosen to not divide cleanly.
    const odd = BigInt(33_333_333);
    const { funded, residual } = priceOffer(odd, 7.5, 12.5);

    expect(funded + residual).toBe(odd);
  });

  it('handles fractional rates without drifting', () => {
    const { offer } = priceOffer(HUNDRED, 2.5, 7.5);

    // 100 × 0.925 = 92.5 funded; × 0.975 = 90.1875
    expect(offer).toBe(BigInt(90_187_500));
  });

  it('prices nothing from nothing', () => {
    const { funded, residual, offer } = priceOffer(BigInt(0), 10, 10);

    expect(funded).toBe(BigInt(0));
    expect(residual).toBe(BigInt(0));
    expect(offer).toBe(BigInt(0));
  });

  it('can produce a residual larger than the deposit, which the caller must catch', () => {
    // Now that the residual is a share of the CASHFLOW rather than of the offer, it can exceed
    // the deposit it is retained from — which a share of the offer never could.
    //
    // OfferVaultFactory._quote reverts on `fee + holdback > offerAmount`
    // (HoldbackExceedsOffer), so the UI must refuse it rather than submit a doomed
    // transaction. This pins that the arithmetic really does reach that state, so the guard
    // in MakeOfferModal is not dead code.
    const { residual, offer } = priceOffer(HUNDRED, 50, 50);

    expect(offer).toBe(BigInt(25_000_000));
    expect(residual).toBe(BigInt(50_000_000));
    expect(residual > offer).toBe(true);
  });

  it('reaches the band where only the fee decides, which is why the guard is conservative', () => {
    // 45% residual at a 10% discount: residual 45, deposit 49.5. Under the offerAmount limit,
    // so the naive check passes — but a venue fee above 4.5/49.5 ≈ 9.09% would revert. The
    // client is not told feeRateBps, so the modal checks against MAX_FEE_BPS (10%) and
    // refuses this. Pinned because it is the case that makes the conservative bound visible.
    const { residual, offer } = priceOffer(HUNDRED, 10, 45);

    expect(offer).toBe(BigInt(49_500_000));
    expect(residual).toBe(BigInt(45_000_000));
    expect(residual < offer).toBe(true);

    const worstCaseFee = (offer * BigInt(1_000)) / BigInt(10_000);
    expect(worstCaseFee + residual > offer).toBe(true);
  });
});
