import Link from 'next/link';
import { FOOTER_LINKS } from './content';
import { lt } from './theme';

interface Props {
  className?: string;
  brand: string;
}

/** The links landing7 keeps at the bottom, plus the legal pair the site footer carries. */
export default function LandingFooter({ className = '', brand }: Props) {
  return (
    <footer className={`border-t ${lt.border} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <p className={`text-xs ${lt.muted}`}>
          &copy; 2026 Conduit UCPI · {brand} · Secure escrow contracts on Base · Company No. 880319.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {FOOTER_LINKS.map((l) => (
            <li key={l.href}>
              {l.external || l.href.startsWith('mailto:') ? (
                <a
                  href={l.href}
                  {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`${lt.muted} hover:text-[color:var(--lt-fg)] transition-colors`}
                >
                  {l.label}
                </a>
              ) : (
                <Link href={l.href} className={`${lt.muted} hover:text-[color:var(--lt-fg)] transition-colors`}>
                  {l.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
