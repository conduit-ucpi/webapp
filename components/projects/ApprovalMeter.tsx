/**
 * Verifier sign-off progress across a chain of contracts — a project and every
 * subcontract below it. The data's job is one ratio against a limit, so the
 * form is a meter: a single-hue fill on a lighter step of the same ramp, never
 * a two-slice pie or a bar chart. The counts are always spelled out beside it,
 * so state never depends on colour alone.
 */
export default function ApprovalMeter({
  total,
  approved,
  deployed = 0,
  awaitingYou = 0,
  className = '',
}: {
  total?: number;
  approved?: number;
  deployed?: number;
  /** Contracts waiting on the viewer specifically; omitted where unknown. */
  awaitingYou?: number;
  className?: string;
}) {
  // Missing counts mean the service predates this rollup — show nothing rather
  // than reporting "0 approved", which would be a lie about the data.
  if (total === undefined || approved === undefined || total === 0) return null;
  // Once everything is on-chain there is nothing left to approve.
  if (deployed >= total) return null;

  const complete = approved >= total;
  const pct = Math.round((approved / total) * 100);
  const noun = total === 1 ? 'contract' : 'contracts';

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <div
        className="h-1.5 w-32 rounded-full bg-green-100 dark:bg-green-950 overflow-hidden"
        role="img"
        aria-label={`${approved} of ${total} ${noun} verified`}
      >
        <div
          className="h-full rounded-full bg-green-600 dark:bg-green-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Text tokens, not the meter's colour — identity comes from the mark. */}
      <span className="text-xs text-secondary-600 dark:text-secondary-400">
        {complete ? (
          <>
            All {total} {noun} verified — ready to deploy
          </>
        ) : (
          <>
            {approved} of {total} {noun} verified
          </>
        )}
      </span>

      {/* Status carries an icon and a label, never colour on its own. */}
      {awaitingYou > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
          <span aria-hidden="true">●</span>
          {awaitingYou} need{awaitingYou === 1 ? 's' : ''} your approval
        </span>
      )}
    </div>
  );
}
