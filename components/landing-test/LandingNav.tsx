import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NAV_GROUPS, NAV_PRICING, NavLink } from './content';
import { lt } from './theme';

interface Props {
  /** The wordmark. */
  brand: string;
  /** Extra classes on the bar (sticky, translucent, dark…) — the page's call. */
  className?: string;
  /** Text of the primary button. */
  ctaLabel?: string;
  /** Text of the /dashboard link; "My dashboard" reads better once someone has an account. */
  signInLabel?: string;
}

function ItemLink({ item, onClick, className }: { item: NavLink; onClick?: () => void; className: string }) {
  const inner = (
    <>
      <span className="block font-medium">{item.label}</span>
      {item.description && <span className={`block text-xs mt-0.5 ${lt.muted}`}>{item.description}</span>}
    </>
  );
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <Link href={item.href} className={className} onClick={onClick}>
      {inner}
    </Link>
  );
}

/**
 * The Stripe / Mercury top bar: Products, Solutions, Developers, Resources as dropdowns,
 * Pricing as a plain link, sign-in on the right and one primary button. Below `md` it
 * collapses to a menu button and a full list — the dropdown pattern is a desktop one.
 */
export default function LandingNav({ brand, className = '', ctaLabel = 'Request payment', signInLabel = 'Sign in' }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const itemClass = `block px-3 py-2 rounded-lg text-sm ${lt.fg} hover:bg-[color:var(--lt-accent-soft)] transition-colors`;

  return (
    <nav className={`w-full ${className}`} aria-label="Primary" ref={barRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className={`text-lg font-semibold tracking-tight ${lt.fg}`} style={{ fontFamily: 'var(--lt-font-display)' }}>
              {brand}
            </Link>

            <ul className="hidden md:flex items-center gap-1">
              {NAV_GROUPS.map((group) => {
                const isOpen = open === group.label;
                return (
                  <li key={group.label} className="relative">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      onClick={() => setOpen(isOpen ? null : group.label)}
                      className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg ${lt.fg} hover:bg-[color:var(--lt-accent-soft)] transition-colors`}
                    >
                      {group.label}
                      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div
                        role="menu"
                        className={`absolute left-0 top-full mt-2 w-80 p-2 shadow-xl border ${lt.border} ${lt.card} ${lt.radius} z-50`}
                      >
                        {group.items.map((item) => (
                          <ItemLink key={item.href + item.label} item={item} className={itemClass} onClick={() => setOpen(null)} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
              <li>
                <a href={NAV_PRICING.href} className={`px-3 py-2 text-sm rounded-lg ${lt.fg} hover:bg-[color:var(--lt-accent-soft)] transition-colors`}>
                  {NAV_PRICING.label}
                </a>
              </li>
            </ul>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/dashboard" className={`px-3 py-2 text-sm ${lt.fg} hover:opacity-80`}>
              {signInLabel}
            </Link>
            <Link href="/create" className={`${lt.btnPrimary} ${lt.btnSm}`}>
              {ctaLabel}
            </Link>
          </div>

          <button
            type="button"
            className={`md:hidden p-2 ${lt.fg}`}
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            aria-expanded={mobile}
            onClick={() => setMobile((m) => !m)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              {mobile ? (
                <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobile && (
        <div className={`md:hidden border-t ${lt.border} ${lt.card}`}>
          <div className="px-4 py-4 space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className={`text-xs uppercase tracking-wider mb-2 ${lt.muted}`}>{group.label}</p>
                {group.items.map((item) => (
                  <ItemLink key={item.href + item.label} item={item} className={itemClass} onClick={() => setMobile(false)} />
                ))}
              </div>
            ))}
            <a href={NAV_PRICING.href} className={itemClass} onClick={() => setMobile(false)}>
              {NAV_PRICING.label}
            </a>
            <div className="flex gap-3 pt-2">
              <Link href="/dashboard" className={`${lt.btnSecondary} flex-1`}>
                {signInLabel}
              </Link>
              <Link href="/create" className={`${lt.btnPrimary} flex-1`}>
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
