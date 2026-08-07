import { displayCurrency } from '@/utils/currency';

/**
 * The safety-critical disclosures (MARKETPLACE_OPENSPEC §15.1).
 *
 * ⚠️ THESE ARE NOT POLISH. Each one replaces a protection that was considered and deliberately
 *    left out of the contract, so omitting one removes the protection entirely rather than
 *    degrading it. They live here as components so a new screen inherits them rather than
 *    reinventing a weaker version.
 */

interface NetProceedsProps {
  offerAmount: string | null;
  fee: string | null;
  holdback: string | null;
  netAmount: string | null;
  tokenSymbol: string;
}

/**
 * What the seller actually receives (§8.5a, §13.10, §5.3).
 *
 * ⚠️ THE HEADLINE FIGURE MUST BE THE NET, NOT THE OFFER. A seller shown "10,000" who receives
 *    8,900 reads it as theft. Fee and holdback are separate fields on `OfferCreated` precisely so
 *    offers can be compared on both — a smaller offer with no holdback can beat a larger one.
 */
export function NetProceedsBreakdown({ offerAmount, fee, holdback, netAmount, tokenSymbol }: NetProceedsProps) {
  const hasHoldback = !!holdback && holdback !== '0';

  return (
    <div className="rounded-md bg-gray-50 dark:bg-secondary-900/60 p-3 text-sm space-y-1">
      <div className="flex justify-between text-gray-600 dark:text-secondary-300">
        <span>Offer</span>
        <span>{displayCurrency(offerAmount ?? 0, 'microUSDC')} {tokenSymbol}</span>
      </div>
      <div className="flex justify-between text-gray-600 dark:text-secondary-300">
        <span>Platform fee</span>
        <span>− {displayCurrency(fee ?? 0, 'microUSDC')} {tokenSymbol}</span>
      </div>
      {hasHoldback && (
        <div className="flex justify-between text-gray-600 dark:text-secondary-300">
          <span>Held back until settlement</span>
          <span>− {displayCurrency(holdback!, 'microUSDC')} {tokenSymbol}</span>
        </div>
      )}
      <div className="flex justify-between font-medium text-gray-900 dark:text-white border-t border-gray-200 dark:border-secondary-700 pt-2 mt-1">
        <span>You receive now</span>
        <span>{displayCurrency(netAmount ?? 0, 'microUSDC')} {tokenSymbol}</span>
      </div>
      {hasHoldback && (
        <p className="text-xs text-gray-500 dark:text-secondary-400 pt-1">
          The held-back {displayCurrency(holdback!, 'microUSDC')} {tokenSymbol} comes back to you
          when the escrow settles in full. It is a reserve against the payment being disputed, not
          a charge.
        </p>
      )}
    </div>
  );
}

/**
 * What an LP is taking on (§11, §8.1a).
 *
 * ⚠️ THE ASYMMETRY IS THE POINT: an LP inherits a dispute they cannot evidence. They were not
 *    party to the work, hold none of the correspondence, and cannot testify to what was
 *    delivered. Their only levers are care in agreeing an arbiter, the holdback they set, and
 *    buying short-dated — which is why time to maturity leads rather than the discount.
 */
export function EvidenceAsymmetryNotice({ daysToMaturity }: { daysToMaturity: number }) {
  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
      <div className="font-medium">
        {daysToMaturity} {daysToMaturity === 1 ? 'day' : 'days'} to maturity — and that is your
        risk window
      </div>
      <p className="mt-1">
        Until then the buyer can dispute this payment, and if they do you inherit a dispute you
        cannot evidence: you were not party to the work and hold none of the correspondence. Your
        levers are the reserve you hold back, care in agreeing an arbiter, and buying short-dated.
      </p>
      <p className="mt-2 text-xs">
        A deeper discount mechanically reduces what an attacker could take from you.
      </p>
    </div>
  );
}

/**
 * A reserve already standing against this escrow (§5.3, §15.1).
 *
 * ⚠️ THE RESERVE TRAVELS WITH THE POSITION. Buy this cashflow and you become the beneficiary of
 *    a holdback someone else funded — money that comes to you at settlement and is not part of
 *    what you are paying for. An LP who is not shown it is pricing the wrong position.
 */
export function ExistingHoldbackNotice({
  holdback,
  funder,
  tokenSymbol
}: {
  holdback: string;
  funder: string | null;
  tokenSymbol: string;
}) {
  return (
    <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
      <div className="font-medium">
        This escrow carries an existing reserve of {displayCurrency(holdback, 'microUSDC')} {tokenSymbol}
      </div>
      <p className="mt-1">
        It was funded by {funder ? <span className="font-mono text-xs">{funder}</span> : 'a previous buyer'} and
        travels with the position — if you buy this cashflow, you become its beneficiary and it
        comes to you when the escrow settles in full.
      </p>
    </div>
  );
}

/**
 * The five-minute fuse on the accept flow (§3.2, §15.2).
 *
 * Expiry is a retry, never an error state: an expired approval is inert, moves nothing and blocks
 * nothing. Presenting it as a failure invites support tickets over a re-prompt.
 */
export function AcceptFlowNotice() {
  return (
    <p className="text-xs text-gray-500 dark:text-secondary-400">
      Accepting takes two signatures: one authorising this offer&apos;s vault to take over the
      payment, then the swap itself. The authorisation lasts five minutes — if it lapses,
      nothing is at risk and you simply start again.
    </p>
  );
}
