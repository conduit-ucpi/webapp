import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { withNodes } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';
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
  const t = usePageT();
  const held = reserve.holdback;
  const due = reserve.dueBack;
  const pct = reserve.resolvedBuyerPercentage;
  // Trimmed rather than passed through escrowTitle: the fallback here is a different heading,
  // not a placeholder name, so this needs to know whether there IS one.
  const title = reserve.description?.trim();

  // Only where the contract has actually decided it. Deriving it while LIVE would state an award
  // that has not happened, and while DISPUTED one that is still being voted on.
  const award =
    reserve.state === 'RESOLVED' && due != null
      ? (BigInt(held) - BigInt(due)).toString()
      : null;

  const headline =
    reserve.state === 'RELEASED'
      ? { figure: due ?? held, caption: t('reserves.details.caption.returned') }
      : due != null
        ? { figure: due, caption: t('reserves.details.caption.dueBack') }
        : { figure: held, caption: t('reserves.details.caption.held') };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('reserves.details.title')}
      size="large"
      children={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-secondary-200 gap-3">
            <div>
              {/*
                ⚠️ THE DESCRIPTION IS THE HEADING WHEN THERE IS ONE. "Reserve on a payment you
                   sold" describes every row in the list identically, so a supplier who opened
                   this to find out WHICH payment learns nothing from it — and selling dropped
                   the escrow out of their contract list, so there is nowhere else to go and
                   look. Demoted to a caption above the name rather than deleted: it is still
                   what the screen is, just not which one.

                   Falls back to the generic heading when contractservice has no record for the
                   escrow, instead of captioning a placeholder with its own synonym.
              */}
              {title ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-secondary-500">
                    {t('reserves.details.heading')}
                  </p>
                  <h3 className="text-xl font-semibold text-secondary-900 mt-0.5">{title}</h3>
                </>
              ) : (
                <h3 className="text-xl font-semibold text-secondary-900">
                  {t('reserves.details.heading')}
                </h3>
              )}
              <div className="text-sm text-secondary-600 mt-1">
                {withNodes(t('reserves.details.contract'), {
                  hash: <ExpandableHash hash={reserve.escrowContract || ''} />
                })}
              </div>
              {reserve.lp && (
                <div className="text-sm text-secondary-600 mt-1">
                  {withNodes(t('reserves.details.nowHeldBy'), {
                    hash: <ExpandableHash hash={reserve.lp} />
                  })}
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
              <h4 className="font-semibold text-secondary-900 text-lg">{t('reserves.details.theReserve')}</h4>
              <div className="rounded-lg bg-secondary-50 p-3 text-sm space-y-1">
                <Row
                  label={t('reserves.details.heldWhenSold')}
                  value={held}
                  tokenSymbol={tokenSymbol}
                  note={t('reserves.details.heldWhenSoldNote')}
                />
                {award !== null && (
                  <Row
                    label={
                      pct != null
                        ? t('reserves.details.customerAwardWithPct', { pct })
                        : t('reserves.details.customerAward')
                    }
                    value={award}
                    tokenSymbol={tokenSymbol}
                    negative
                    note={t('reserves.details.customerAwardNote')}
                  />
                )}
                {due != null ? (
                  <Row
                    label={
                      reserve.state === 'RELEASED'
                        ? t('reserves.details.returnedToYou')
                        : t('reserves.details.comesBackToYou')
                    }
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
                      ? t('reserves.details.noFigureDisputed')
                      : t('reserves.details.noFigureUnknown')}
                  </p>
                )}
              </div>
            </div>

            {/* ── What has to happen ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-secondary-900 text-lg">{t('reserves.details.theContract')}</h4>
              <div className="rounded-lg bg-secondary-50 p-3 text-sm space-y-2 text-secondary-700">
                <div className="flex justify-between">
                  <span>{t('reserves.details.completes')}</span>
                  <span className="text-secondary-900">
                    {reserve.maturity
                      ? formatDateTimeWithTZ(reserve.maturity)
                      : t('reserves.details.notKnown')}
                  </span>
                </div>
                <p className="border-t border-secondary-200 pt-2">
                  {reserve.state === 'LIVE' && t('reserves.details.state.live')}
                  {reserve.state === 'DISPUTED' && t('reserves.details.state.disputed')}
                  {reserve.state === 'SETTLED' && t('reserves.details.state.settled')}
                  {reserve.state === 'RESOLVED' && t('reserves.details.state.resolved')}
                  {reserve.state === 'RELEASED' && t('reserves.details.state.released')}
                  {reserve.state === 'UNKNOWN' && t('reserves.details.state.unknown')}
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
              <h4 className="font-semibold text-blue-900">{t('reserves.details.autoTitle')}</h4>
              <p className="text-blue-800 text-sm mt-1">{t('reserves.details.autoBody')}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end border-t border-secondary-200 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t('reserves.details.close')}
            </Button>
            {reserve.releasable && (
              <Button type="button" onClick={onRelease} disabled={busy}>
                {busy ? <LoadingSpinner className="w-4 h-4" /> : t('reserves.details.returnNow')}
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}
