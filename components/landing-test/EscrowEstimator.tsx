import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FEE_FLOOR_BREAKEVEN, FEE_RATE, MIN_AMOUNT, MIN_FEE, feeFor, netFor } from '@/utils/escrowFees';
import { lt } from './theme';

/**
 * Card processing as the comparison: the headline rate most small merchants pay.
 * Round numbers on purpose — this is an estimator, and the savings calculator is where
 * the full breakdown lives.
 */
const CARD_RATE = 0.029;
const CARD_FIXED = 0.3;

/**
 * Indicative discount an LP might ask to buy a locked payment before its payout date:
 * the risk-free rate plus a spread, pro-rated by days locked. The marketplace prices
 * each offer individually; this is the order of magnitude, labelled as such.
 * RISK_FREE mirrors early-payment-offer.tsx (SOFR, 28 Jul 2026).
 */
const RISK_FREE = 3.65;
const LP_SPREAD = 4.0;

const TOKENS = ['USDC', 'USDT'] as const;
type Token = (typeof TOKENS)[number];

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  className?: string;
  /** The button under the numbers. */
  ctaLabel?: string;
  /** Show the early-sale (liquidity) estimate. Default on. */
  showLiquidity?: boolean;
}

/**
 * Wise's calculator, for escrow: what the buyer pays, what the seller receives, when,
 * and what it would fetch if sold early. Every figure updates as the inputs change.
 */
export default function EscrowEstimator({ className = '', ctaLabel = 'Request this payment', showLiquidity = true }: Props) {
  const [amountText, setAmountText] = useState('2,500');
  const [token, setToken] = useState<Token>('USDC');
  const [days, setDays] = useState(14);

  const amount = useMemo(() => {
    const n = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);

  const m = useMemo(() => {
    const fee = amount >= MIN_AMOUNT ? feeFor(amount) : 0;
    const net = amount >= MIN_AMOUNT ? netFor(amount) : 0;
    const card = amount > 0 ? amount * CARD_RATE + CARD_FIXED : 0;
    const saving = Math.max(0, card - fee);
    const lpRate = (RISK_FREE + LP_SPREAD) / 100;
    const discount = net * lpRate * (days / 365);
    const early = Math.max(0, net - discount);
    return { fee, net, card, saving, discount, early, lpApr: RISK_FREE + LP_SPREAD };
  }, [amount, days]);

  const feeIsFloor = amount >= MIN_AMOUNT && m.fee === MIN_FEE && amount * FEE_RATE < MIN_FEE;

  const field = `w-full bg-transparent outline-none text-right font-semibold tracking-tight ${lt.fg}`;
  const label = `text-xs ${lt.muted}`;
  const row = `flex items-center justify-between py-3 border-t ${lt.border}`;

  return (
    <div
      className={`${lt.card} ${lt.radius} border ${lt.border} shadow-lg p-5 sm:p-6 w-full ${className}`}
      aria-label="Escrow and liquidity estimator"
      data-testid="escrow-estimator"
    >
      <div className={`flex items-center justify-between mb-4`}>
        <span className={`text-xs font-medium uppercase tracking-wider ${lt.muted}`}>Estimate a payment</span>
        <span className={`text-xs px-2 py-1 rounded-full ${lt.accentSoft} ${lt.fg}`}>1 {token} = 1 USD</span>
      </div>

      <label className="block">
        <span className={label}>Buyer pays exactly</span>
        <div className="flex items-center gap-3 mt-1">
          <select
            aria-label="Token"
            value={token}
            onChange={(e) => setToken(e.target.value as Token)}
            className={`text-sm font-medium px-3 py-2 rounded-full border ${lt.border} ${lt.fg} bg-transparent`}
          >
            {TOKENS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            aria-label="Amount the buyer pays"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => setAmountText(amount ? amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')}
            className={`${field} text-3xl sm:text-4xl`}
          />
        </div>
      </label>

      <label className="block mt-4">
        <span className={label}>Seller receives</span>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-sm ${lt.muted}`}>on the payout date</span>
          <output className={`text-3xl sm:text-4xl font-semibold tracking-tight ${lt.accentText}`} data-testid="estimator-net">
            {money(m.net)}
          </output>
        </div>
      </label>

      <label className="block mt-5">
        <div className="flex items-center justify-between">
          <span className={label}>Payout date</span>
          <span className={`text-xs font-medium ${lt.fg}`}>{days} day{days === 1 ? '' : 's'} after funding</span>
        </div>
        <input
          aria-label="Days until payout"
          type="range"
          min={1}
          max={90}
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="w-full mt-2 accent-[var(--lt-accent)]"
        />
      </label>

      <div className="mt-4">
        <div className={row}>
          <span className={`text-sm ${lt.muted}`}>Our fee</span>
          <span className={`text-sm font-medium ${lt.fg}`}>
            {money(m.fee)} {token}
            <span className={`ml-2 text-xs ${lt.muted}`}>{feeIsFloor ? `${money(MIN_FEE)} minimum` : '1%'}</span>
          </span>
        </div>
        <div className={row}>
          <span className={`text-sm ${lt.muted}`}>Card processor would take</span>
          <span className={`text-sm font-medium ${lt.fg}`}>
            {money(m.card)}
            <span className={`ml-2 text-xs ${lt.muted}`}>2.9% + $0.30</span>
          </span>
        </div>
        <div className={row}>
          <span className={`text-sm ${lt.muted}`}>You keep</span>
          <span className={`text-sm font-semibold ${lt.accentText}`} data-testid="estimator-saving">
            +{money(m.saving)} more
          </span>
        </div>
        {showLiquidity && (
          <div className={row}>
            <div>
              <span className={`block text-sm ${lt.muted}`}>Need it today? Sell the payment early</span>
              <span className={`block text-xs ${lt.muted}`}>indicative, at ~{m.lpApr.toFixed(2)}% a year for {days} days</span>
            </div>
            <span className={`text-sm font-medium ${lt.fg}`} data-testid="estimator-early">
              ≈ {money(m.early)}
            </span>
          </div>
        )}
        <div className={row}>
          <span className={`text-sm ${lt.muted}`}>Arrives</span>
          <span className={`text-sm font-medium ${lt.fg}`}>In seconds, on the payout date</span>
        </div>
      </div>

      <Link href="/create" className={`${lt.btnPrimary} w-full mt-5`}>
        {ctaLabel}
      </Link>
      <p className={`mt-3 text-[11px] leading-relaxed ${lt.muted}`}>
        Fee comes out of the amount funded; the buyer pays exactly what you ask. Below ${FEE_FLOOR_BREAKEVEN} the ${MIN_FEE.toFixed(2)} floor applies. Early-sale figure is an estimate; the liquidity marketplace prices each offer.
      </p>
    </div>
  );
}
