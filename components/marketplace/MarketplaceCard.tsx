import type { ReactNode } from 'react';

/**
 * The card every marketplace row is drawn on.
 *
 * Extracted rather than copied: an LP's offers and a supplier's reserves are two views of the
 * same sale, and a user who has both sees them on the same screens. Two hand-maintained copies
 * of this markup drift — one gains a dark-mode fix, the other keeps the old border — and the
 * drift reads as two unrelated features rather than two sides of one deal.
 *
 * Deliberately presentational and slot-shaped. It owns the frame and the layout; every caller
 * owns its own vocabulary, because the two lists describe genuinely different things and
 * flattening that into shared props would put an offer's words in a reserve's mouth.
 */
export default function MarketplaceCard({
  headline,
  identifier,
  status,
  footnote,
  actions,
  children
}: {
  /** The figure and what happened to it — the line the eye lands on. */
  headline: ReactNode;
  /** The address this row is about, in mono. Truncates rather than wrapping. */
  identifier?: ReactNode;
  /** Where it stands now, in the row's own vocabulary. */
  status?: ReactNode;
  /**
   * A second, separately-coloured state line — the underlying contract, typically.
   *
   * ⚠️ Kept distinct from `status` because the two can disagree in ways that matter: an offer
   *    reads "Withdrawn" while its escrow is still live, a reserve reads "due back" while the
   *    contract is disputed. Collapsing them into one line hides exactly that.
   */
  footnote?: ReactNode;
  /** Buttons, stacked at the right. */
  actions?: ReactNode;
  /** Explanatory paragraphs below the fold of the row. */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{headline}</div>
          {identifier && (
            <div className="text-xs font-mono text-gray-400 dark:text-secondary-500 mt-0.5 truncate">
              {identifier}
            </div>
          )}
          {status && (
            <div className="text-xs text-gray-500 dark:text-secondary-400 mt-1">{status}</div>
          )}
          {footnote}
        </div>
        {actions && <div className="flex flex-col items-end gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
