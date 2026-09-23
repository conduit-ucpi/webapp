import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { lt } from './theme';

const display = { fontFamily: 'var(--lt-font-display)' } as const;

const STAGES = [
  { key: 'create', label: 'Create', who: 'Seller', line: 'Sets $1,200 and a payout date 14 days out.' },
  { key: 'fund', label: 'Fund', who: 'Buyer', line: 'Pays into the contract. Neither side can touch it.' },
  { key: 'release', label: 'Release', who: 'Contract', line: 'Payout date arrives. $1,188 lands with the seller.' },
] as const;

/**
 * The product, animated: the three states an escrow passes through, on a loop until the
 * visitor hovers or picks a stage. Stripe's "interactive product UI" for something that
 * has no screen of its own.
 */
export default function EscrowTimeline({ stage: controlled }: { stage?: number } = {}) {
  const [own, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  // A page can drive the stage from its own scroll position; then the loop stays off.
  const stage = controlled ?? own;

  useEffect(() => {
    if (paused || controlled !== undefined) return;
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 2600);
    return () => clearInterval(t);
  }, [paused, controlled]);

  const current = STAGES[stage];
  const locked = stage >= 1;
  const released = stage === 2;

  return (
    <div
      className={`${lt.card} border ${lt.border} ${lt.radius} p-6 shadow-xl`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="escrow-timeline"
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-[0.2em] ${lt.muted}`}>An escrow, live</span>
        <span className={`text-xs ${lt.muted}`}>{paused ? 'paused' : 'playing'}</span>
      </div>

      <div className="mt-5 flex items-center gap-2" role="tablist" aria-label="Escrow stages">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            type="button"
            aria-selected={i === stage}
            onClick={() => { setStage(i); setPaused(true); }}
            className={`flex-1 h-1.5 rounded-full overflow-hidden ${lt.accentSoft}`}
          >
            <motion.span
              className={`block h-full ${lt.accentBg}`}
              initial={false}
              animate={{ width: i < stage ? '100%' : i === stage ? '100%' : '0%' }}
              transition={{ duration: i === stage ? 2.4 : 0.2, ease: 'linear' }}
            />
            <span className="sr-only">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {STAGES.map((s, i) => (
          <div key={s.key} className={`text-sm ${i === stage ? lt.fg : lt.muted}`}>
            <span className={`block text-2xl font-light ${i === stage ? lt.accentText : ''}`} style={display}>0{i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      <div className={`mt-6 p-4 ${lt.bg} ${lt.radius} min-h-[120px]`}>
        <AnimatePresence mode="wait">
          <motion.div key={current.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <p className={`text-xs uppercase tracking-[0.2em] ${lt.muted}`}>{current.who}</p>
            <p className={`mt-2 text-lg ${lt.fg}`} style={display}>{current.line}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={`mt-4 flex items-center justify-between text-sm border-t pt-4 ${lt.border}`}>
        <span className={lt.muted}>Contract balance</span>
        <span className={`font-medium ${lt.fg}`}>{released ? '$0.00' : locked ? '$1,200.00 locked' : '$0.00'}</span>
      </div>
      <div className={`flex items-center justify-between text-sm pt-2`}>
        <span className={lt.muted}>Seller wallet</span>
        <span className={`font-medium ${released ? lt.accentText : lt.fg}`}>{released ? '+$1,188.00' : '—'}</span>
      </div>
      <p className={`mt-4 text-[11px] ${lt.muted}`}>The buyer can dispute before day 14 and freeze the funds. After that, nothing can.</p>
    </div>
  );
}

