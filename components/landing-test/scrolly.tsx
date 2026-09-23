import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Fade from '@/components/ui/Fade';
import { GLOSSARY, MAKE_PAYMENT_HREF, PROOF_POINTS, SOURCE_URL } from './content';
import { lt } from './theme';

/*
 * The pieces the scrollytelling landings (09's pattern, pages 11–15) are built from.
 * Left column sticks, right column scrolls, and the two talk to each other: hovering a
 * card on the right changes a line on the left; scrolling a card into view changes the
 * left panel's headline. Every block keeps its full text in the DOM — collapsed, not
 * removed — so the shared functionality test sees the same inventory on every page.
 */

export const section = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
export const eyebrow = `text-xs font-medium uppercase tracking-[0.18em] ${lt.accentText}`;
export const h2 = `mt-3 text-3xl sm:text-[2.6rem] font-medium tracking-tight leading-[1.08] ${lt.fg}`;
export const card = `${lt.card} border ${lt.border} ${lt.radius}`;

/** 07's banner: the one thing we are shouting about this month. */
export function Announcement() {
  return (
    <div className={`${lt.accentBg} text-[#131313] text-center text-sm font-medium py-2.5 px-4`}>
      <Link href="/plugins#mcp" className="hover:underline">
        New: let Claude or ChatGPT pay for you, with a human veto <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/** The strip of facts under every hero. */
export function ProofPoints({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-6 gap-y-2 text-xs ${lt.muted} ${className}`}>
      {PROOF_POINTS.map((p) => (
        <span key={p}>{p}</span>
      ))}
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
        Open source
      </a>
    </div>
  );
}

interface HeroProps {
  eyebrowText: string;
  headline: ReactNode;
  sub: ReactNode;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  brand: string;
  right: ReactNode;
  /** The "already using?" line under the buttons. Off when the nav already says "My dashboard". */
  showDashboard?: boolean;
}

/** 09's hero: copy and the two buttons on the left, the product on the right. */
export function ScrollyHero({ eyebrowText, headline, sub, primary, secondary, brand, right, showDashboard = true }: HeroProps) {
  return (
    <section className={`${section} pt-16 pb-16 lg:pt-24`} aria-label="Hero">
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className={eyebrow}>{eyebrowText}</p>
          <h1 className={`mt-5 text-4xl sm:text-5xl lg:text-[3.9rem] font-medium tracking-tight leading-[1.02] ${lt.fg}`}>{headline}</h1>
          <p className={`mt-6 text-lg leading-relaxed max-w-xl ${lt.muted}`}>{sub}</p>
          {/* Two ways in, equal weight: ask to be paid, or pay someone. */}
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={primary.href} className={lt.btnPrimary}>{primary.label}</Link>
            <Link href={MAKE_PAYMENT_HREF} className={lt.btnPrimary}>Make payment</Link>
            <Link href={secondary.href} className={lt.btnSecondary}>{secondary.label}</Link>
          </div>
          {showDashboard && (
            <div className="mt-4">
              <Link href="/dashboard" className={`${lt.btnSecondary} ${lt.btnSm}`}>Already using {brand}? Go to your dashboard</Link>
            </div>
          )}
          <ProofPoints className="mt-10" />
        </motion.div>
        <motion.div className="lg:col-span-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
          {right}
        </motion.div>
      </div>
    </section>
  );
}

interface ChapterProps {
  id?: string;
  label: string;
  title: ReactNode;
  ariaLabel: string;
  /** Sticky left column content under the title. */
  children?: ReactNode;
  /** Right column content. */
  aside: ReactNode;
  /** Left column width in twelfths. */
  split?: 4 | 5 | 6;
}

/** A chapter: sticky copy on the left, whatever the chapter shows on the right. */
export function Chapter({ id, label, title, ariaLabel, children, aside, split = 5 }: ChapterProps) {
  const left = { 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6' }[split];
  const rightCol = { 4: 'lg:col-span-8', 5: 'lg:col-span-7', 6: 'lg:col-span-6' }[split];
  return (
    <section id={id} className={`border-t ${lt.border}`} aria-label={ariaLabel}>
      <div className={`${section} py-20 grid lg:grid-cols-12 gap-10`}>
        <div className={left}>
          <div className="lg:sticky lg:top-28">
            <Fade>
              <p className={eyebrow}>{label}</p>
              <h2 className={h2}>{title}</h2>
              {children && <div className="mt-5">{children}</div>}
            </Fade>
          </div>
        </div>
        <div className={`${rightCol} space-y-4`}>{aside}</div>
      </div>
    </section>
  );
}

export interface Block {
  label: string;
  text: string;
}

interface HoverCardProps extends Block {
  index?: number;
  onHover?: (b: Block | null) => void;
  /** Show the text always (default) or only on hover/focus/tap. */
  reveal?: boolean;
  compact?: boolean;
  /** Never expand: the card is a title, the text lives in the left panel. */
  titlesOnly?: boolean;
  /** The card whose text the left panel is showing. */
  active?: boolean;
}

/**
 * One short block. With `reveal`, the sentence stays folded until the pointer is over it,
 * it has focus, or it was tapped — a mouseover on a mouse, a tap on a phone. The text is
 * in the DOM either way.
 */
export function HoverCard({ label, text, index, onHover, reveal = false, compact = false, titlesOnly = false, active = false }: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const shown = titlesOnly ? false : !reveal || open;
  const expandable = reveal && !titlesOnly;
  return (
    <div
      tabIndex={0}
      role={expandable ? 'button' : undefined}
      aria-expanded={expandable ? open : undefined}
      aria-current={titlesOnly && active ? 'true' : undefined}
      onMouseEnter={() => { setOpen(true); onHover?.({ label, text }); }}
      onMouseLeave={() => { setOpen(false); onHover?.(null); }}
      onFocus={() => { setOpen(true); onHover?.({ label, text }); }}
      onBlur={() => { setOpen(false); onHover?.(null); }}
      onClick={() => setOpen((o) => !o)}
      className={`group ${card} ${compact ? 'p-4' : 'p-5'} transition-colors hover:border-[color:var(--lt-accent)] focus:border-[color:var(--lt-accent)] focus:outline-none cursor-default ${active ? 'border-[color:var(--lt-accent)]' : ''}`}
    >
      <div className="flex items-start gap-3">
        {index !== undefined && (
          <span className={`text-xs mt-1 ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <div className="flex-1">
          <h3 className={`font-semibold ${lt.fg}`}>{label}</h3>
          <p
            className={`text-sm leading-relaxed ${lt.muted} transition-all duration-300 ${
              shown ? 'mt-1.5 max-h-40 opacity-100' : 'mt-0 max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            {text}
          </p>
        </div>
        {expandable && (
          <span aria-hidden="true" className={`text-xs ${lt.muted} group-hover:text-[color:var(--lt-accent)] transition-colors`}>
            {open ? '−' : '+'}
          </span>
        )}
        {titlesOnly && (
          <span aria-hidden="true" className={`text-sm transition-colors ${active ? lt.accentText : lt.muted}`}>→</span>
        )}
      </div>
    </div>
  );
}

interface HoverGridProps {
  items: ReadonlyArray<Block>;
  onHover?: (b: Block | null) => void;
  columns?: 1 | 2 | 3;
  reveal?: boolean;
  numbered?: boolean;
  compact?: boolean;
  titlesOnly?: boolean;
  activeLabel?: string | null;
}

export function HoverGrid({ items, onHover, columns = 2, reveal, numbered, compact, titlesOnly, activeLabel }: HoverGridProps) {
  const cols = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns];
  return (
    <div className={`grid gap-4 ${cols}`}>
      {items.map((b, i) => (
        <HoverCard key={b.label} {...b} index={numbered ? i : undefined} onHover={onHover} reveal={reveal} compact={compact} titlesOnly={titlesOnly} active={titlesOnly && activeLabel === b.label} />
      ))}
    </div>
  );
}

/**
 * The line on the left that answers the card under the pointer on the right. Falls back
 * to the chapter's own sentence when nothing is hovered.
 */
export function HoverHint({ hint, fallback }: { hint: Block | null; fallback: string }) {
  return (
    <div className={`${card} p-5 min-h-[7.5rem]`} aria-live="polite">
      {hint ? (
        <>
          <p className={`text-xs uppercase tracking-[0.18em] ${lt.accentText}`}>{hint.label}</p>
          <p className={`mt-2 text-base ${lt.fg}`}>{hint.text}</p>
        </>
      ) : (
        <p className={`text-base ${lt.muted}`}>{fallback}</p>
      )}
    </div>
  );
}

/** Which of the observed elements is closest to the middle of the viewport. jsdom has no observer; then it is always the first. */
export function useActiveIndex(count: number) {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best = 0;
        let bestRatio = -1;
        refs.current.forEach((el, i) => {
          const r = el ? ratios.get(el) ?? 0 : 0;
          if (r > bestRatio) { bestRatio = r; best = i; }
        });
        setActive(best);
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);
  const setRef = (i: number) => (el: HTMLElement | null) => { refs.current[i] = el; };
  return { active, setRef };
}

interface ScrollLinkedProps {
  items: ReadonlyArray<Block>;
  /** What the left panel shows for the active item; default is the label, large. */
  renderActive?: (b: Block, i: number) => ReactNode;
  label: string;
  title: ReactNode;
  ariaLabel: string;
  id?: string;
  /** Extra sticky content under the active panel (buttons, mostly). */
  children?: ReactNode;
}

/**
 * The right column is a tall list; whichever item is in the middle of the screen is
 * echoed, large, on the left. Scroll the right and the left keeps pace.
 */
export function ScrollLinked({ items, renderActive, label, title, ariaLabel, id, children }: ScrollLinkedProps) {
  const { active, setRef } = useActiveIndex(items.length);
  const current = items[active];
  return (
    <Chapter
      id={id}
      label={label}
      title={title}
      ariaLabel={ariaLabel}
      aside={items.map((b, i) => (
        <div
          key={b.label}
          ref={setRef(i)}
          className={`${card} p-6 min-h-[9rem] flex flex-col justify-center transition-all duration-300 ${
            i === active ? 'border-[color:var(--lt-accent)] opacity-100' : 'opacity-60'
          }`}
        >
          <div className="flex items-start gap-4">
            <span className={`text-xs mt-1 ${lt.accentText}`} style={{ fontFamily: 'var(--lt-font-mono)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className={`text-lg font-semibold ${lt.fg}`}>{b.label}</h3>
              <p className={`mt-1.5 text-sm leading-relaxed ${lt.muted}`}>{b.text}</p>
            </div>
          </div>
        </div>
      ))}
    >
      <div className={`${card} p-6 min-h-[10rem]`} aria-live="polite">
        {renderActive ? (
          renderActive(current, active)
        ) : (
          <>
            <p className={`text-xs uppercase tracking-[0.18em] ${lt.accentText}`}>
              {String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
            </p>
            <p className={`mt-3 text-2xl sm:text-3xl font-medium tracking-tight leading-tight ${lt.fg}`}>{current.label}</p>
          </>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </Chapter>
  );
}

/** A word with a definition on hover or focus. Keyboard and touch get it on focus/tap. */
export function Term({ word, children }: { word: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const id = useId();
  const def = GLOSSARY[word] ?? '';
  return (
    <span className="relative inline-block group">
      <span
        tabIndex={0}
        aria-describedby={id}
        className={`underline decoration-dotted decoration-[color:var(--lt-accent)] underline-offset-4 cursor-help focus:outline-none`}
      >
        {children ?? word}
      </span>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute left-0 top-full mt-2 z-30 w-72 p-3 text-sm font-normal normal-case tracking-normal ${lt.card} ${lt.fg} border ${lt.border} rounded-xl shadow-xl opacity-0 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0`}
      >
        {def}
      </span>
    </span>
  );
}

/** The checkout, as the buyer sees it. Decorative: DemoButtons opens the real one. */
export function CheckoutMock() {
  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${lt.fg}`}>Basic Product — One-time Payment</span>
        <span className={`text-xs px-2 py-1 rounded-full ${lt.accentSoft} ${lt.accentText}`}>USDC</span>
      </div>
      <p className={`mt-6 text-4xl font-medium tracking-tight ${lt.fg}`}>$0.001</p>
      <p className={`mt-1 text-xs ${lt.muted}`}>Held in escrow until the payout date. Dispute before then to freeze it.</p>
      <div className={`${lt.btnPrimary} w-full mt-6 pointer-events-none`} aria-hidden="true">Pay</div>
      <p className={`mt-3 text-[11px] text-center ${lt.muted}`}>Sign in with Google or email · gas covered</p>
    </div>
  );
}

interface HoverChapterProps {
  id?: string;
  label: string;
  title: ReactNode;
  ariaLabel: string;
  /** The left panel's line when nothing is hovered. */
  fallback: string;
  items: ReadonlyArray<Block>;
  columns?: 1 | 2 | 3;
  reveal?: boolean;
  compact?: boolean;
  /** Buttons under the hint on the left. */
  actions?: ReactNode;
  /** Anything to show above the grid on the right. */
  lead?: ReactNode;
  split?: 4 | 5 | 6;
  /**
   * Titles on the right, text on the left, nothing expands. The left starts on the first
   * block and stays on the last one pointed at, so it is never empty.
   */
  titlesOnly?: boolean;
}

/** A chapter whose left panel echoes whichever block the pointer is over on the right. */
export function HoverChapter({ id, label, title, ariaLabel, fallback, items, columns = 2, reveal = false, compact = false, actions, lead, split, titlesOnly = false }: HoverChapterProps) {
  const [hint, setHint] = useState<Block | null>(titlesOnly ? items[0] : null);
  const onHover = (b: Block | null) => { if (b || !titlesOnly) setHint(b); };
  return (
    <Chapter
      id={id}
      label={label}
      title={title}
      ariaLabel={ariaLabel}
      split={split}
      aside={
        <>
          {lead}
          <HoverGrid items={items} onHover={onHover} columns={columns} reveal={reveal} numbered compact={compact} titlesOnly={titlesOnly} activeLabel={hint?.label ?? null} />
        </>
      }
    >
      <HoverHint hint={hint} fallback={fallback} />
      {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
    </Chapter>
  );
}
