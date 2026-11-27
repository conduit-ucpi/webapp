import Link from 'next/link';
import { PRICING_TABS, PricingKey } from './content';
import { lt } from './theme';
import { card } from './scrolly';

interface Props {
  active: PricingKey;
  onChange: (key: PricingKey) => void;
}

/**
 * The pricing comparison, switchable between what a card processor and a traditional escrow
 * service charge for each line, against ours. Same pill switch as AudienceTabs. The page owns
 * the selection so its heading can follow it.
 */
export default function PricingTabs({ active, onChange }: Props) {
  const current = PRICING_TABS.find((t) => t.key === active)!;

  return (
    <div data-testid="pricing-tabs">
      <div role="tablist" aria-label="Compare Stabledrop with" className={`inline-flex p-1 rounded-full border ${lt.border} ${lt.card}`}>
        {PRICING_TABS.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(t.key)}
              className={`px-4 sm:px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                selected ? `${lt.accentBg} text-[color:var(--lt-accent-fg)]` : `${lt.muted} hover:text-[color:var(--lt-fg)]`
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className={`mt-6 ${card} overflow-hidden`}>
        <div className={`grid grid-cols-[1.2fr_1fr_1fr] text-xs uppercase tracking-[0.18em] px-5 py-3 border-b ${lt.border} ${lt.muted}`}>
          <span>Line item</span>
          <span>{current.them}</span>
          <span className={lt.accentText}>Stabledrop</span>
        </div>
        {current.rows.map((r) => (
          <div key={r.item} className={`grid grid-cols-[1.2fr_1fr_1fr] gap-x-3 px-5 py-3.5 text-sm border-b last:border-b-0 ${lt.border} hover:bg-[color:var(--lt-accent-soft)] transition-colors`}>
            <span className={lt.muted}>{r.item}</span>
            <span className={lt.fg}>{r.traditional}</span>
            <span className={`font-semibold ${lt.accentText}`}>{r.us}</span>
          </div>
        ))}
        {/* The savings calculator compares against card processors only. */}
        {active === 'card' && (
          <div className={`p-5 border-t ${lt.border}`}>
            <Link href="/merchant-savings-calculator" className={`${lt.btnSecondary} w-full`}>See how much you&apos;d save vs. Stripe, Square or PayPal</Link>
          </div>
        )}
      </div>
    </div>
  );
}
