import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { displayCurrency } from '@/utils/currency';
import { formatDateTimeWithTZ } from '@/utils/validation';
import type { ReserveView } from '@/types/marketplace';

interface ReserveDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserve: ReserveView;
  tokenSymbol: string;
  busy: boolean;
  onRelease: () => void;
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
  value: string | number;
  tokenSymbol: string;
  negative?: boolean;
  strong?: boolean;
  divider?: boolean;
  note?: string;
}) {
  return (
    <div className={divider ? 'border-t border-secondary-200 pt-2 mt-1' : ''}>
      <div
        className={`flex justify-between ${
          strong ? 'font-medium text-secondary-900' : 'text-secondary-700'
        }`}
      >
        <span>{label}</span>
        <span>
          {negative ? '− ' : ''}
          {displayCurrency(value, 'microUSDC')} {tokenSymbol}
        </span>
      </div>
      {note && <p className="text-xs text-secondary-500 mt-1">{note}</p>}
    </div>
  );
}

/**
 * One reserve, explained in full, with the collection at the bottom.
 *
 * ⚠️ NO `dark:` VARIANTS. The shared Modal paints bg-white and carries no dark surface of its
 *    own, so a dark: panel renders dark grey on a white sheet whenever the theme is dark. The
 *    dashboard's own detail modal, which this follows, uses none.
 *
 * ⚠️ TWO STATES CARRY NO FIGURE AND NONE MAY BE INVENTED — the same rule the row obeys, and the
 *    reason this screen exists in its own right rather than just repeating the row larger. While
 *    a dispute is open the split turns on votes that have not matched; when the escrow could not
 *    be read we know nothing. Either way the arithmetic below is withheld rather than guessed.
 *
 * ⚠️ AND `LIVE` IS PROVISIONAL. The customer can dispute right up to maturity and their award
 *    comes out of this reserve first, so the figure is what returns if nothing further happens.
 *    Stating that is most of this modal's job: the row has room for one sentence, this has room
 *    for the condition attached to the money.
 */
export default function ReserveDetailsModal({
  isOpen,
  onClose,
  reserve,
  tokenSymbol,
  busy,
  onRelease,
}: ReserveDetailsModalProps) {
  const held = reserve.holdback;
  const due = reserve.dueBack;
  const pct = reserve.resolvedBuyerPercentage;

  // Only where the contract has actually decided it. Deriving it while LIVE would state an award
  // that has not happened, and while DISPUTED one that is still being voted on.
  const award =
    reserve.state === 'RESOLVED' && due != null
      ? (BigInt(held) - BigInt(due)).toString()
      : null;

  const headline =
    reserve.state === 'RELEASED'
      ? { figure: due ?? held, caption: 'returned to you' }
      : due != null
        ? { figure: due, caption: 'due back to you' }
        : { figure: held, caption: 'held back — outcome not yet known' };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reserve details"
      size="large"
      children={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-secondary-200 gap-3">
            <div>
              <h3 className="text-xl font-semibold text-secondary-900">
                Reserve on a payment you sold
              </h3>
              <div className="text-sm text-secondary-600 mt-1">
                Contract <ExpandableHash hash={reserve.escrowContract || ''} />
              </div>
              {reserve.lp && (
                <div className="text-sm text-secondary-600 mt-1">
                  Now held by <ExpandableHash hash={reserve.lp} />
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-secondary-900">
                {displayCurrency(headline.figure, 'microUSDC')}
              </p>
              <p className="text-sm text-secondary-500 mt-1">{headline.caption}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ── Where the money stands ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-secondary-900 text-lg">The reserve</h4>
              <div className="rounded-lg bg-secondary-50 p-3 text-sm space-y-1">
                <Row
                  label="Held back when you sold"
                  value={held}
                  tokenSymbol={tokenSymbol}
                  note="Part of the price, kept until the customer's contract finished."
                />
                {award !== null && (
                  <Row
                    label={`Customer's award${pct != null ? ` (${pct}%)` : ''}`}
                    value={award}
                    tokenSymbol={tokenSymbol}
                    negative
                    note="A dispute went the customer's way. Their award comes out of this reserve before anything returns to you."
                  />
                )}
                {due != null ? (
                  <Row
                    label={reserve.state === 'RELEASED' ? 'Returned to you' : 'Comes back to you'}
                    value={due}
                    tokenSymbol={tokenSymbol}
                    strong
                    divider
                  />
                ) : (
                  /*
                   * No figure, and no placeholder either. A zero or a dash in the total's
                   * position reads as an answer; a sentence reads as the absence of one.
                   */
                  <p className="text-secondary-700 border-t border-secondary-200 pt-2 mt-1">
                    {reserve.state === 'DISPUTED'
                      ? 'How much comes back depends on how the dispute resolves, so there is no figure yet.'
                      : 'This contract could not be read just now, so what comes back is not known.'}
                  </p>
                )}
              </div>
            </div>

            {/* ── What has to happen ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-secondary-900 text-lg">The contract</h4>
              <div className="rounded-lg bg-secondary-50 p-3 text-sm space-y-2 text-secondary-700">
                <div className="flex justify-between">
                  <span>Completes</span>
                  <span className="text-secondary-900">
                    {reserve.maturity ? formatDateTimeWithTZ(reserve.maturity) : 'Not known'}
                  </span>
                </div>
                <p className="border-t border-secondary-200 pt-2">
                  {reserve.state === 'LIVE' && (
                    <>
                      Still running. You get the full amount back unless the customer disputes
                      before it completes — an award to them would come out of this reserve
                      first, so the figure beside it is what returns if nothing further happens.
                    </>
                  )}
                  {reserve.state === 'DISPUTED' && (
                    <>
                      Under dispute. Anything awarded to the customer comes out of this reserve
                      first, so how much returns to you is not settled until it resolves.
                    </>
                  )}
                  {reserve.state === 'SETTLED' && (
                    <>Completed with no dispute, so the whole reserve is yours to collect.</>
                  )}
                  {reserve.state === 'RESOLVED' && (
                    <>
                      Disputed and resolved. The award came out of the reserve first, and what
                      was left is yours to collect.
                    </>
                  )}
                  {reserve.state === 'RELEASED' && (
                    <>Settled and paid out. Nothing further to do.</>
                  )}
                  {reserve.state === 'UNKNOWN' && (
                    <>
                      The contract&apos;s state could not be read. That does not affect the money
                      — it only means this page cannot say where things stand right now.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/*
            Said on every state that is not already paid out, because it is the question a
            supplier actually has: selling took them out of the flow, and nothing about it
            suggests the money still finds its way back on its own.
          */}
          {reserve.state !== 'RELEASED' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900">You do not have to watch for this</h4>
              <p className="text-blue-800 text-sm mt-1">
                Once the contract completes, the reserve is returned to you automatically — within
                about half an hour. The button below only saves you that wait.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end border-t border-secondary-200 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {reserve.releasable && (
              <Button type="button" onClick={onRelease} disabled={busy}>
                {busy ? <LoadingSpinner className="w-4 h-4" /> : 'Return my reserve now'}
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}
