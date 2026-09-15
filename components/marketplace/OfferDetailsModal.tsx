import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { displayCurrency } from '@/utils/currency';
import { hoursUntil } from '@/utils/marketplace';
import { AcceptFlowNotice } from '@/components/marketplace/OfferDisclosures';
import type { OfferView } from '@/types/marketplace';

interface OfferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: OfferView;
  /** The escrow's gross amount, before the platform fee the escrow itself charges. */
  nominalAmount?: number;
  /** What the escrow actually pays the recipient: nominal − platform fee. */
  payoutAmount?: number;
  maturity?: number;
  tokenSymbol: string;
  busy: boolean;
  /** Progress text during the two-transaction accept flow. */
  stage: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

/** One figure, with its explanation underneath where it needs one. */
function Row({
  label,
  value,
  tokenSymbol,
  negative,
  strong,
  divider,
  note,
}: {
  label: string;
  value: number | string;
  tokenSymbol: string;
  negative?: boolean;
  strong?: boolean;
  divider?: boolean;
  note?: string;
}) {
  return (
    <div className={divider ? 'border-t border-secondary-200 dark:border-secondary-700 pt-2 mt-1' : ''}>
      <div
        className={`flex justify-between ${
          strong
            ? 'font-medium text-secondary-900 dark:text-white'
            : 'text-secondary-600 dark:text-secondary-300'
        }`}
      >
        <span>{label}</span>
        <span>
          {negative ? '− ' : ''}
          {displayCurrency(value, 'microUSDC')} {tokenSymbol}
        </span>
      </div>
      {note && <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">{note}</p>}
    </div>
  );
}

/**
 * One offer, explained end to end, with the decision at the bottom.
 *
 * ⚠️ THE SELLER IS COMPARING TWO FUTURES AND THE SCREEN MUST SHOW BOTH NET (§8.5a, §13.10).
 *    Waiting pays the escrow's payout — nominal less the platform fee — not the nominal. The
 *    offer pays `netAmount` now and the residual at maturity. Comparing a net against a gross
 *    on either side flatters one of them, and the seller cannot tell which.
 *
 * ⚠️ THE RESIDUAL IS NOT A CHARGE. It is the seller's own money, withheld at acceptance and
 *    paid to them at settlement (OfferVault.releaseHoldback). Shown as a deduction from the
 *    immediate figure and then added back into the total, because both are true and a seller
 *    shown only the deduction reads it as a fee.
 *
 * The figures come from the offer as the contracts recorded it — `netAmount`, `fee` and
 * `holdback` are separate fields on OfferCreated precisely so an offer can be judged on all
 * three. A smaller offer with no residual can be the better one.
 */
export default function OfferDetailsModal({
  isOpen,
  onClose,
  offer,
  nominalAmount,
  payoutAmount,
  maturity,
  tokenSymbol,
  busy,
  stage,
  onAccept,
  onDecline,
}: OfferDetailsModalProps) {
  const num = (v: string | null | undefined) => Number(v ?? 0);

  const netNow = num(offer.netAmount);
  const residual = num(offer.holdback);
  const venueFee = num(offer.fee);
  const deposit = num(offer.offerAmount);

  // What the seller ends up with if nothing is disputed: the immediate payment plus the
  // residual coming back. Equals deposit − venue fee, which is the honest comparison figure.
  const totalIfClean = netNow + residual;

  // The platform fee the ESCROW charges, distinct from the venue fee on the offer. Derived by
  // subtraction rather than recomputed from the fee schedule, so it always reconciles with the
  // payout actually read from the chain.
  const platformFee =
    nominalAmount !== undefined && payoutAmount !== undefined ? nominalAmount - payoutAmount : null;

  const givenUp = payoutAmount !== undefined ? payoutAmount - totalIfClean : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Offer details"
      size="large"
      children={
        <div className="space-y-6">
          {/* Header — the headline is what lands in their wallet today. */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-secondary-200 dark:border-secondary-700 gap-3">
            <div>
              <h3 className="text-xl font-semibold text-secondary-900 dark:text-white">
                Offer to buy this payment
              </h3>
              <div className="text-sm text-secondary-600 dark:text-secondary-300 mt-1">
                From <ExpandableHash hash={offer.lp || ''} />
              </div>
              {offer.offerExpiry && (
                <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                  Lapses in {hoursUntil(offer.offerExpiry)}h
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-secondary-900 dark:text-white">
                {displayCurrency(netNow, 'microUSDC')}
              </p>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                paid to you today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ── What waiting is worth ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-secondary-900 dark:text-white text-lg">
                If you wait
              </h4>
              <div className="rounded-lg bg-secondary-50 dark:bg-secondary-900/60 p-3 text-sm space-y-1">
                {nominalAmount !== undefined ? (
                  <>
                    <Row label="Payment amount" value={nominalAmount} tokenSymbol={tokenSymbol} />
                    {platformFee !== null && platformFee > 0 && (
                      <Row
                        label="Platform fee"
                        value={platformFee}
                        tokenSymbol={tokenSymbol}
                        negative
                      />
                    )}
                    <Row
                      label="You receive at maturity"
                      value={payoutAmount ?? nominalAmount}
                      tokenSymbol={tokenSymbol}
                      strong
                      divider
                      note={
                        maturity
                          ? `On ${new Date(maturity * 1000).toLocaleDateString()}, once the dispute window closes.`
                          : 'Once the dispute window closes.'
                      }
                    />
                  </>
                ) : (
                  <p className="text-secondary-500 dark:text-secondary-400">
                    The payment's own figures could not be read just now.
                  </p>
                )}
              </div>
            </div>

            {/* ── What the offer is worth ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-secondary-900 dark:text-white text-lg">
                If you accept
              </h4>
              <div className="rounded-lg bg-secondary-50 dark:bg-secondary-900/60 p-3 text-sm space-y-1">
                <Row label="Offer" value={deposit} tokenSymbol={tokenSymbol} />
                <Row label="Marketplace fee" value={venueFee} tokenSymbol={tokenSymbol} negative />
                {residual > 0 && (
                  <Row label="Residual, held back" value={residual} tokenSymbol={tokenSymbol} negative />
                )}
                <Row
                  label="You receive today"
                  value={netNow}
                  tokenSymbol={tokenSymbol}
                  strong
                  divider
                />
                {residual > 0 && (
                  <Row
                    label="Residual, at maturity"
                    value={residual}
                    tokenSymbol={tokenSymbol}
                    note="Your own money, held back until the escrow settles. It comes to you in full if nobody disputes the payment."
                  />
                )}
                {residual > 0 && (
                  <Row
                    label="Total, if undisputed"
                    value={totalIfClean}
                    tokenSymbol={tokenSymbol}
                    strong
                    divider
                  />
                )}
              </div>
            </div>
          </div>

          {/* The comparison, stated once, with both sides net. */}
          {givenUp !== null && givenUp > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200">
                    What this costs you
                  </h4>
                  <p className="text-blue-800 dark:text-blue-300 text-sm mt-1">
                    Getting paid today instead of waiting
                    {maturity ? ` until ${new Date(maturity * 1000).toLocaleDateString()}` : ' until maturity'}.
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                    {displayCurrency(givenUp, 'microUSDC')}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">{tokenSymbol}</p>
                </div>
              </div>
            </div>
          )}

          {residual > 0 && (
            <p className="text-sm text-secondary-600 dark:text-secondary-300">
              If the payment is disputed and the buyer is refunded, the residual covers that loss
              first and you receive less than the{' '}
              {displayCurrency(residual, 'microUSDC')} {tokenSymbol} above — that is what it is
              for. The figures here assume no dispute is raised.
            </p>
          )}

          <AcceptFlowNotice />

          {stage && (
            <p className="text-sm text-secondary-600 dark:text-secondary-300">
              <LoadingSpinner className="w-4 h-4 mr-2 inline" />
              {stage}
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-end border-t border-secondary-200 dark:border-secondary-700 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={onDecline} disabled={busy}>
              Decline
            </Button>
            <Button type="button" onClick={onAccept} disabled={busy}>
              {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Accept — get paid today'}
            </Button>
          </div>
        </div>
      }
    />
  );
}
