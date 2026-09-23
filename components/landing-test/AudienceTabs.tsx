import { useState } from 'react';
import Link from 'next/link';
import { AUDIENCES, AudienceKey, EVERYWHERE } from './content';
import { lt } from './theme';

interface Props {
  className?: string;
  /** How the use-case cards lay out; the page picks. */
  columns?: 2 | 4;
  /** Include Wise's "works everywhere" list under the cards. Default on. */
  showEverywhere?: boolean;
}

/**
 * Wise's Personal / Business / Platform switch: one row of tabs, then the industries and
 * use cases under whichever is selected, each with somewhere to go.
 */
export default function AudienceTabs({ className = '', columns = 2, showEverywhere = true }: Props) {
  const [active, setActive] = useState<AudienceKey>('business');
  const current = AUDIENCES.find((a) => a.key === active)!;

  return (
    <div className={className} data-testid="audience-tabs">
      <div role="tablist" aria-label="Who is this for" className={`inline-flex p-1 rounded-full border ${lt.border} ${lt.card}`}>
        {AUDIENCES.map((a) => {
          const selected = a.key === active;
          return (
            <button
              key={a.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(a.key)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                selected ? `${lt.accentBg} text-[color:var(--lt-accent-fg)]` : `${lt.muted} hover:text-[color:var(--lt-fg)]`
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <p className={`mt-6 text-lg sm:text-xl max-w-2xl ${lt.fg}`} style={{ fontFamily: 'var(--lt-font-display)' }}>
        {current.headline}
      </p>

      <div role="tabpanel" className={`mt-8 grid gap-4 sm:grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4' : ''}`}>
        {current.cases.map((c) => {
          const btn = `${lt.btnSecondary} ${lt.btnSm} mt-5`;
          return (
            <div key={c.title} className={`flex flex-col p-5 border ${lt.border} ${lt.card} ${lt.radius}`}>
              <h3 className={`text-base font-semibold ${lt.fg}`}>{c.title}</h3>
              <p className={`mt-2 text-sm leading-relaxed flex-1 ${lt.muted}`}>{c.text}</p>
              {c.href.startsWith('http') ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer" className={`${btn} self-start`}>
                  {c.cta}
                </a>
              ) : (
                <Link href={c.href} className={`${btn} self-start`}>
                  {c.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {showEverywhere && (
        <div className="mt-10">
          <p className={`text-xs uppercase tracking-wider mb-3 ${lt.muted}`}>Works everywhere there is an email address</p>
          <ul className="flex flex-wrap gap-2">
            {EVERYWHERE.map((e) => (
              <li key={e} className={`text-xs sm:text-sm px-3 py-1.5 rounded-full ${lt.accentSoft} ${lt.fg}`}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
