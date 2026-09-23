import { useState } from 'react';
import Link from 'next/link';
import { EMBED_EXAMPLES, EmbedKey } from './content';
import { lt } from './theme';

interface Props {
  className?: string;
  /** Tabs above the code (default) or down the side. */
  layout?: 'tabs' | 'side';
}

/**
 * Stripe's "how to embed it in your platform" section: one code block per surface, the
 * real snippets from /plugins, and a link to the full guide for each.
 */
export default function EmbedExamples({ className = '', layout = 'tabs' }: Props) {
  const [active, setActive] = useState<EmbedKey>('javascript');
  const ex = EMBED_EXAMPLES.find((e) => e.key === active)!;

  const tab = (key: EmbedKey, label: string) => {
    const selected = key === active;
    return (
      <button
        key={key}
        role="tab"
        type="button"
        aria-selected={selected}
        onClick={() => setActive(key)}
        className={`text-left px-4 py-2 text-sm font-medium transition-colors ${lt.btnRadius} ${
          selected ? `${lt.accentBg} text-[color:var(--lt-accent-fg)]` : `${lt.muted} hover:text-[color:var(--lt-fg)]`
        }`}
      >
        {label}
      </button>
    );
  };

  const code = (
    <div className={`border ${lt.border} ${lt.radius} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2 border-b ${lt.border} ${lt.accentSoft}`}>
        <span className={`text-xs ${lt.muted}`}>{ex.language}</span>
        <span className={`text-xs ${lt.muted}`}>copy &amp; paste</span>
      </div>
      <pre
        className={`p-5 text-xs sm:text-[13px] leading-relaxed overflow-x-auto ${lt.card} ${lt.fg}`}
        style={{ fontFamily: 'var(--lt-font-mono)' }}
      >
        <code>{ex.code}</code>
      </pre>
    </div>
  );

  const link = ex.link.external ? (
    <a href={ex.link.href} target="_blank" rel="noopener noreferrer" className={`${lt.btnSecondary} ${lt.btnSm}`}>
      {ex.link.label} ↗
    </a>
  ) : (
    <Link href={ex.link.href} className={`${lt.btnSecondary} ${lt.btnSm}`}>
      {ex.link.label}
    </Link>
  );

  if (layout === 'side') {
    return (
      <div className={`grid lg:grid-cols-[220px_1fr] gap-6 ${className}`} data-testid="embed-examples">
        <div role="tablist" aria-label="Where to embed" className="flex lg:flex-col gap-1 flex-wrap">
          {EMBED_EXAMPLES.map((e) => tab(e.key, e.label))}
        </div>
        <div role="tabpanel">
          <p className={`text-sm mb-4 ${lt.muted}`}>{ex.intro}</p>
          {code}
          <div className="mt-4">{link}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="embed-examples">
      <div role="tablist" aria-label="Where to embed" className={`inline-flex flex-wrap gap-1 p-1 border ${lt.border} ${lt.card} ${lt.btnRadius}`}>
        {EMBED_EXAMPLES.map((e) => tab(e.key, e.label))}
      </div>
      <div role="tabpanel" className="mt-5">
        <p className={`text-sm mb-4 max-w-xl ${lt.muted}`}>{ex.intro}</p>
        {code}
        <div className="mt-4">{link}</div>
      </div>
    </div>
  );
}
