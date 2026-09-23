import { acceptableOffers, annualisedYield, escrowTitle, looksWithdrawable, needsOpening, offerStatusLabel, priceOffer } from '@/utils/marketplace';
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

  it('titles a contract from any shape that carries a description', () => {
    // The same position appears as a SellableEscrow in the explorer and as a
    // UnifiedContract on /offers, where description is optional rather than nullable. One
    // rule has to cover both or the two screens title the same thing differently — which is
    // exactly what happened: /liquidity was fixed and /offers was not.
    expect(escrowTitle({ description: 'Oak dining table' })).toBe('Oak dining table');
    expect(escrowTitle({ description: undefined })).toBe('Escrow payment');
    expect(escrowTitle({})).toBe('Escrow payment');
    // useCombinedContracts maps a missing description to '' rather than leaving it unset.
    expect(escrowTitle({ description: '' })).toBe('Escrow payment');
  });

  it('takes a fallback that reads naturally in a sentence', () => {
    // The modal says "Offer on ...", where "Offer on Escrow payment" is wrong.
    expect(escrowTitle(escrow(null), 'this payment')).toBe('this payment');
  });
});


/**
 * Pricing an offer from the two rates.
 *
 * Both rates are shares of the CASHFLOW and they do different jobs: the discount is the LP's
 * return, the residual is a slice of the deposit that reaches the supplier at maturity rather
 * than at acceptance. The screen originally took the residual as a share of the OFFER, which
 * made the two percentages look like they acted on the same base. They do not.
 *
 * This maps one-to-one onto the deployed contracts — offer is `offerAmount`, residual is
 * `holdback`, supplierNow is `netAmount` before the venue fee — so every number here is money
 * that moves, and they are pinned exactly.
 *
 * Amounts are microUSDC: 100_000_000 is $100.
 */
describe('priceOffer', () => {
  const HUNDRED = BigInt(100_000_000);

  it('deposits the cashflow less the discount', () => {
    // The worked example: $100 cashflow, 10% discount, 10% residual.
    // Deposit $90; $10 of it is the residual; the supplier sees $80 now.
    const { offer, residual, supplierNow } = priceOffer(HUNDRED, 10, 10);

    expect(offer).toBe(BigInt(90_000_000));
    expect(residual).toBe(BigInt(10_000_000));
    expect(supplierNow).toBe(BigInt(80_000_000));
  });

  it('takes the residual off the cashflow, not off the offer', () => {
    // The regression: 10% of the OFFER is $9, not $10. A percentage point of difference
    // between the two bases, on every offer that carries a residual.
    const { residual } = priceOffer(HUNDRED, 10, 10);

    expect(residual).toBe(BigInt(10_000_000));
    expect(residual).not.toBe(BigInt(9_000_000));
  });

  it('leaves the deposit untouched by the residual', () => {
    // The residual is withheld from the SUPPLIER, not from the LP: it moves money between
    // acceptance and maturity without changing what the LP puts in.
    const none = priceOffer(HUNDRED, 10, 0);
    const heavy = priceOffer(HUNDRED, 10, 40);

    expect(none.offer).toBe(heavy.offer);
    expect(none.supplierNow).toBe(BigInt(90_000_000));
    expect(heavy.supplierNow).toBe(BigInt(50_000_000));
  });

  it('pays the supplier the whole deposit when there is no residual', () => {
    const { offer, residual, supplierNow } = priceOffer(HUNDRED, 1.5, 0);

    expect(offer).toBe(BigInt(98_500_000));
    expect(residual).toBe(BigInt(0));
    expect(supplierNow).toBe(offer);
  });

  it('handles fractional rates without drifting', () => {
    const { offer, residual } = priceOffer(HUNDRED, 2.5, 7.5);

    expect(offer).toBe(BigInt(97_500_000));
    expect(residual).toBe(BigInt(7_500_000));
  });

  it('prices nothing from nothing', () => {
    const { offer, residual, supplierNow } = priceOffer(BigInt(0), 10, 10);

    expect(offer).toBe(BigInt(0));
    expect(residual).toBe(BigInt(0));
    expect(supplierNow).toBe(BigInt(0));
  });

  it('reports a negative supplier payment rather than clamping it', () => {
    // A 60% residual against a 50% discount leaves the supplier owed less than nothing.
    // OfferVaultFactory._quote reverts on `fee + holdback > offerAmount`, so the caller has
    // to refuse this — clamping to zero here would hide it from the guard.
    const { offer, residual, supplierNow } = priceOffer(HUNDRED, 50, 60);

    expect(offer).toBe(BigInt(50_000_000));
    expect(residual).toBe(BigInt(60_000_000));
    expect(supplierNow).toBe(BigInt(-10_000_000));
  });
});

/**
 * Annualised yield.
 *
 * Simple rather than compounded, because compounding assumes the LP can roll into another
 * position at the same rate and this venue often has nothing to roll into. The number an LP
 * compares against other venues, so a wrong one here misprices their whole book.
 */
describe('annualisedYield', () => {
  const HUNDRED = BigInt(100_000_000);

  it('annualises the period return', () => {
    // Deposit 90, collect 100 in 30 days: 11.11% over the period, ~135% annualised.
    const y = annualisedYield(BigInt(90_000_000), HUNDRED, 30);

    expect(y).toBeCloseTo((10 / 90) * (365 / 30) * 100, 6);
    expect(y).toBeCloseTo(135.19, 1);
  });

  it('ignores the residual entirely', () => {
    // The residual never touches the LP's side: same deposit, same collection, same yield.
    const { offer } = priceOffer(HUNDRED, 10, 40);

    expect(annualisedYield(offer, HUNDRED, 30)).toBeCloseTo(
      annualisedYield(priceOffer(HUNDRED, 10, 0).offer, HUNDRED, 30)!,
      6
    );
  });

  it('falls as the discount narrows', () => {
    const thin = annualisedYield(priceOffer(HUNDRED, 1, 0).offer, HUNDRED, 30)!;
    const fat = annualisedYield(priceOffer(HUNDRED, 10, 0).offer, HUNDRED, 30)!;

    expect(thin).toBeLessThan(fat);
  });

  it('is longer-dated means lower annualised, for the same discount', () => {
    const short = annualisedYield(BigInt(90_000_000), HUNDRED, 30)!;
    const long = annualisedYield(BigInt(90_000_000), HUNDRED, 180)!;

    expect(long).toBeLessThan(short);
  });

  describe('when it cannot be stated', () => {
    // Null rather than 0 or Infinity: a yield of zero is a claim, and an absent one is not.
    it('has no value at or past maturity', () => {
      expect(annualisedYield(BigInt(90_000_000), HUNDRED, 0)).toBeNull();
      expect(annualisedYield(BigInt(90_000_000), HUNDRED, -3)).toBeNull();
    });

    it('has no value with nothing deposited', () => {
      expect(annualisedYield(BigInt(0), HUNDRED, 30)).toBeNull();
    });

    it('has no value when the offer does not discount', () => {
      expect(annualisedYield(HUNDRED, HUNDRED, 30)).toBeNull();
      expect(annualisedYield(BigInt(110_000_000), HUNDRED, 30)).toBeNull();
    });
  });
});

/**
 * A sold escrow is not for sale.
 *
 * ⚠️ THE ONE CASE `status` CANNOT EXPRESS. Accepting one offer moves the escrow's recipient, and
 *    `accept()` checks `recipientNonce()` against the one it recorded — so every OTHER vault on
 *    that escrow now reverts `OfferStale`. Nothing on-chain names the loser, so its own event
 *    stream folds it to OPEN for ever and it reads as perfectly live. The escrow has to say so.
 */
describe('When the escrow has already been sold', () => {
  it('offers the seller nothing on it, whatever the losing offer says about itself', () => {
    // The loser is OPEN, unexpired, fully funded — and completely unacceptable.
    expect(acceptableOffers([offer({ escrowSold: true })])).toHaveLength(0);
  });

  it('closes the whole book, not just the offer that was taken', () => {
    const book = [
      offer({ vaultAddress: '0xwinner', status: 'ACCEPTED', escrowSold: true }),
      offer({ vaultAddress: '0xloser', escrowSold: true })
    ];

    expect(acceptableOffers(book)).toHaveLength(0);
  });

  it('lets the losing LP withdraw now rather than at expiry', () => {
    // The vault's own isWithdrawable() already says yes, via the moved recipient nonce. Waiting
    // out offerExpiry strands capital the vault would return today on an offer that can never
    // be accepted again.
    expect(looksWithdrawable(offer({ escrowSold: true }))).toBe(true);
  });

  it('does not invent withdrawability for an unfunded vault', () => {
    // ⚠️ The vault's PENDING branch is `expired && balance > 0` and does not consult the sale at
    //    all. Prompting here sends the LP into a NothingToWithdraw revert they pay for.
    const unfunded = offer({ status: 'PENDING', depositedAmount: '1000000', escrowSold: true });

    expect(looksWithdrawable(unfunded)).toBe(false);
  });

  it('tells the LP their offer lost, rather than that it is standing', () => {
    // "Standing" beside a withdraw button reads as a bug in the page, and it is the one status
    // the offer's own record will never correct.
    expect(offerStatusLabel(offer({ escrowSold: true }))).toBe('Not taken — withdraw');
  });

  it('leaves an already-settled offer alone', () => {
    // The winner is on a sold escrow by definition. Its capital is spent, not recoverable.
    expect(looksWithdrawable(offer({ status: 'ACCEPTED', escrowSold: true }))).toBe(false);
  });
});

/**
 * An index that has not been redeployed omits the field entirely, and `undefined` must read as
 * "not sold" — otherwise the first deploy of this UI against an older service closes every
 * offer book in the marketplace.
 */
describe('When the index does not report a sale either way', () => {
  it('treats a missing answer as not sold', () => {
    expect(acceptableOffers([offer({ escrowSold: undefined })])).toHaveLength(1);
  });

  it('does not prompt a withdrawal on a missing answer', () => {
    expect(looksWithdrawable(offer({ escrowSold: undefined }))).toBe(false);
  });
});
