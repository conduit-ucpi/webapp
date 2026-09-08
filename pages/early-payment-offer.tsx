import { useState, useMemo, useRef, type ReactNode } from "react";
import * as XLSX from "xlsx";
import SEO from "@/components/SEO";

/* ==================================================================
   Stabledrop — /early-payment-offer

   The funder buys a senior claim capped below the escrow, so the
   seller keeps a residual and takes the first loss on a dispute.

   1. Step 2 has TWO funder parameters (senior cap, discount rate)
      rather than one factoring rate. The residual falls out.
   2. Sliders with a real market range show it as a marked band.
   3. Factoring floor is the risk-free rate — nothing prices below it.
   4. "Cash today" is the advance only. The residual is a second,
      later line. Capital recycling still uses total proceeds because
      in steady state you collect one residual per job.
   ================================================================== */

const C = {
  bg: "#000000",
  panel: "#0a0c0a",
  panel2: "#0e120e",
  line: "#1b211b",
  lineB: "#2c352c",
  text: "#e6efe6",
  dim: "#75836f",
  dimmer: "#4a544a",
  green: "#00ff88",
  greenInk: "#08301e",
  red: "#ff4d4d",
  redInk: "#330e0e",
  amber: "#ffc043",
  amberInk: "#332608",
};

const RISK_FREE = 3.65; // SOFR, 28 Jul 2026. Use SONIA for sterling.
const FEE_RATE = 1.0; // Stabledrop, flat, taken at funding

/* ---- funder regimes ---- */
const REGIMES = {
  none: {
    label: "No track record",
    cap: 86,
    rate: 22,
    blurb:
      "Day one. The funder is pricing dispute risk it can't measure, on a contract with no production history. Wide on both parameters.",
  },
  junior: {
    label: "You take first loss",
    cap: 90,
    rate: 15,
    blurb:
      "You hold a junior strip beneath the funder. Costs you the tail, buys a much tighter senior rate. This is how the first deal gets done.",
  },
  season: {
    label: "Seasoned book",
    cap: 93,
    rate: 7,
    blurb:
      "Two to three years of dispute data, approved arbitrators only, audited contract. Prices like forfaiting paper — risk-free plus 250–500bp.",
  },
} as const;

type RegimeKey = keyof typeof REGIMES;

interface Band {
  label: string;
  from: number;
  to: number;
  colour: string;
}

const CAP_BANDS: Band[] = [
  { label: "no history", from: 85, to: 87, colour: C.red },
  { label: "first loss", from: 89, to: 91, colour: C.amber },
  { label: "seasoned", from: 92, to: 94, colour: C.green },
];
const RATE_BANDS: Band[] = [
  { label: "seasoned", from: 6, to: 9, colour: C.green },
  { label: "first loss", from: 12, to: 18, colour: C.amber },
  { label: "no history", from: 18, to: 30, colour: C.red },
];
const BORROW_BANDS: Band[] = [
  { label: "iwoca floor", from: 18, to: 22, colour: C.amber },
  { label: "representative", from: 36, to: 44, colour: C.red },
];
const YIELD_BANDS: Band[] = [
  { label: "risk-free", from: 3.4, to: 4.0, colour: C.green },
  { label: "deposit acct", from: 1.5, to: 3.0, colour: C.amber },
];
const BAD_DEBT_BANDS: Band[] = [
  { label: "typical SME", from: 0.8, to: 2.5, colour: C.amber },
];
const SHARE_BANDS: Band[] = [
  { label: "usual ask", from: 20, to: 50, colour: C.amber },
];

/* ---- helpers ---- */
const money = (n: number) => Math.round(n).toLocaleString("en-GB");
const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const addDays = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/* ---- slider with optional marked bands ---- */
interface SliderProps {
  label: string;
  help?: ReactNode;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  bands?: Band[];
  big?: boolean;
  allowType?: boolean;
}

function Slider({
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
  format,
  bands,
  big,
  allowType,
}: SliderProps) {
  const [typing, setTyping] = useState<string | null>(null);
  const posOf = (v: number) =>
    ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: bands ? 30 : 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.dim,
          }}
        >
          {label}
        </span>
        {allowType ? (
          <input
            value={typing === null ? format(value) : typing}
            onChange={(e) => setTyping(e.target.value)}
            onBlur={() => {
              const n = parseFloat(String(typing).replace(/[^0-9.]/g, ""));
              if (!isNaN(n)) onChange(n);
              setTyping(null);
            }}
            style={{
              background: "transparent",
              border: `1px solid ${C.line}`,
              borderRadius: 3,
              color: C.green,
              fontFamily: "inherit",
              fontSize: big ? 20 : 15,
              fontWeight: 700,
              textAlign: "right",
              width: 130,
              padding: "3px 7px",
            }}
            aria-label={`${label} value`}
          />
        ) : (
          <span
            style={{
              fontSize: big ? 20 : 15,
              fontWeight: big ? 700 : 500,
              color: big ? C.green : C.text,
            }}
          >
            {format(value)}
          </span>
        )}
      </div>

      <div style={{ position: "relative", height: 24 }}>
        {bands ? (
          <div
            style={{
              position: "absolute",
              top: 9,
              left: 0,
              right: 0,
              height: 6,
              background: C.panel2,
              border: `1px solid ${C.line}`,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            {bands.map((b) => {
              const on = value >= b.from && value <= b.to;
              return (
                <div
                  key={b.label}
                  style={{
                    position: "absolute",
                    left: `${posOf(b.from)}%`,
                    width: `${posOf(b.to) - posOf(b.from)}%`,
                    top: 0,
                    bottom: 0,
                    background: b.colour,
                    opacity: on ? 0.6 : 0.15,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 9,
              left: 0,
              right: 0,
              height: 6,
              background: C.panel2,
              border: `1px solid ${C.line}`,
              borderRadius: 3,
            }}
          />
        )}
        <input
          className="sd-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
      </div>

      {bands ? (
        <div style={{ position: "relative", height: 26, marginTop: 1 }}>
          {bands.map((b) => {
            const on = value >= b.from && value <= b.to;
            const mid = (posOf(b.from) + posOf(b.to)) / 2;
            return (
              <div
                key={b.label}
                style={{
                  position: "absolute",
                  left: `${mid}%`,
                  transform: "translateX(-50%)",
                  width: 86,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    height: 4,
                    width: 1,
                    background: b.colour,
                    opacity: on ? 0.9 : 0.4,
                    margin: "0 auto 3px",
                  }}
                />
                <div
                  style={{
                    fontSize: 9,
                    lineHeight: 1.3,
                    letterSpacing: "0.03em",
                    color: on ? b.colour : C.dimmer,
                  }}
                >
                  {b.label}
                  <br />
                  <span style={{ opacity: 0.7 }}>
                    {b.from}–{b.to}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {help ? (
        <div style={{ fontSize: 11, color: C.dimmer, marginTop: 6, lineHeight: 1.5 }}>
          {help}
        </div>
      ) : null}
    </div>
  );
}

interface RowProps {
  label: string;
  sub?: string;
  value: string;
  tone?: "cost" | "good";
  strong?: boolean;
}

function Row({ label, sub, value, tone, strong }: RowProps) {
  const colour = tone === "cost" ? C.red : tone === "good" ? C.green : C.text;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "9px 0",
        borderBottom: `1px solid ${C.line}`,
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, color: strong ? C.text : C.dim }}>{label}</div>
        {sub ? (
          <div style={{ fontSize: 10, color: C.dimmer, marginTop: 2 }}>{sub}</div>
        ) : null}
      </div>
      <div
        style={{
          fontSize: strong ? 18 : 13.5,
          fontWeight: strong ? 700 : 500,
          color: colour,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 46 }}>
      {eyebrow ? (
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.dim,
            marginBottom: 9,
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      {title ? (
        <h2
          style={{
            fontSize: 20,
            lineHeight: 1.35,
            fontWeight: 700,
            margin: "0 0 12px",
          }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function Panel({ children, glow }: { children: ReactNode; glow?: boolean }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${glow ? C.lineB : C.line}`,
        borderRadius: 4,
        padding: "18px 18px 6px",
        boxShadow: glow ? `0 0 40px ${C.green}12` : "none",
      }}
    >
      {children}
    </div>
  );
}

/* ================= main ================= */

export default function EarlyPaymentOffer() {
  const [invoice, setInvoice] = useState(100000);
  const [terms, setTerms] = useState(60);
  const [badDebt, setBadDebt] = useState(2.0);
  const [regime, setRegime] = useState<RegimeKey>("junior");
  const [cap, setCap] = useState<number>(REGIMES.junior.cap);
  const [discRate, setDiscRate] = useState<number>(REGIMES.junior.rate);
  const [borrowRate, setBorrowRate] = useState(30);
  const [buyerYield, setBuyerYield] = useState(3.65);
  const [buyerShare, setBuyerShare] = useState(25);
  const [jobDays, setJobDays] = useState(30);

  const [custName, setCustName] = useState("");
  const [signOff, setSignOff] = useState("");
  const [nudge, setNudge] = useState(false);
  const [copied, setCopied] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const applyRegime = (k: RegimeKey) => {
    setRegime(k);
    setCap(REGIMES[k].cap);
    setDiscRate(REGIMES[k].rate);
  };

  const m = useMemo(() => {
    const t = terms / 365;
    const carry = (discRate / 100) * t;

    // Buyer's opportunity cost of paying now
    const buyerEarn = invoice * (buyerYield / 100) * t;

    // Value the escrow creates, measured on the invoice, before it's shared.
    // Borrowing avoided + bad debt avoided, less the two costs of doing it.
    const borrowCost = invoice * (borrowRate / 100) * t;
    const badDebtAvoided = invoice * (badDebt / 100);
    const fee0 = invoice * (FEE_RATE / 100);
    const senior0 = (invoice - fee0) * (cap / 100);
    const funderCut0 = senior0 * carry;
    const grossSpread = Math.max(
      0,
      borrowCost + badDebtAvoided - fee0 - funderCut0
    );

    // Split it. Buyer needs at least their forgone yield to say yes.
    const buyerCut = grossSpread * (buyerShare / 100);
    const discount = buyerEarn + buyerCut;

    const face = invoice - discount; // locked into escrow
    const fee = face * (FEE_RATE / 100);
    const escrow = face - fee; // yours to sell
    const senior = escrow * (cap / 100); // funder repaid first, up to here
    const advance = senior * (1 - carry); // cash today
    const funderCut = senior - advance;
    const residual = escrow - senior; // yours, paid last
    const total = advance + residual;

    const breakeven = 1 - advance / escrow; // refund % the funder survives
    const borrowAlt = invoice - borrowCost; // the old way

    // capital recycling
    const cycleNow = jobDays + terms;
    const jobsNow = 365 / cycleNow;
    const revNow = jobsNow * invoice * (1 - badDebt / 100);
    const jobsNew = 365 / jobDays;
    const revNew = jobsNew * total;
    const multiple = revNow > 0 ? revNew / revNow : 0;

    const waterfall = [0, 5, 10, 15, 20, 30, 50, 100].map((d) => {
      const left = escrow * (1 - d / 100);
      const funderGets = Math.min(senior, left);
      const sellerLate = Math.max(0, left - senior);
      return {
        d,
        funderPnL: funderGets - advance,
        sellerLate,
        sellerTotal: advance + sellerLate,
      };
    });

    return {
      buyerEarn, borrowCost, badDebtAvoided, grossSpread, buyerCut, discount,
      face, fee, escrow, senior, advance, funderCut, residual, total,
      breakeven, borrowAlt, cycleNow, jobsNow, revNow, jobsNew, revNew,
      multiple, waterfall,
    };
  }, [invoice, terms, badDebt, cap, discRate, borrowRate, buyerYield, buyerShare, jobDays]);

  const due = addDays(terms);
  const noSub = cap >= 99;
  const buyerBetter = m.discount - m.buyerEarn;
  const aheadOfBorrowing = m.total - m.borrowAlt;
  const buyerApr = m.discount > 0 && terms > 0
    ? (m.discount / m.face) * (365 / terms) * 100
    : 0;

  const message = `Hi ${custName || "[customer name]"},

A proposal on our ${money(invoice)} invoice, due ${due}.

Paying at the end of the terms makes sense for you today: holding the cash for ${terms} days earns you roughly ${money(m.buyerEarn)} at ${pct(buyerYield, 2)}.

We'd like to beat that. Fund the invoice into escrow today and we'll take ${money(m.discount)} off — you pay ${money(m.face)} instead of ${money(invoice)}. That's equivalent to earning ${pct(buyerApr, 2)} APR on the cash over the same period, better than holding it.

The money doesn't come to us. It sits locked in a Stabledrop escrow until ${due} — the day you'd have paid anyway — and is released to us then only if we've delivered. If we haven't, you get it back. Buyer protection and dispute management are built in.

Paying this way genuinely helps us: it guarantees payment on time, and lets us sell the escrow to access the capital early and keep working on your next orders.

Happy to walk through the numbers.

${signOff || "[your name]"}`;

  const copy = () => {
    if (!custName.trim()) {
      setNudge(true);
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    setNudge(false);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      });
    }
  };

  const exportXlsx = () => {
    const rows: (string | number | { f: string })[][] = [
      ["Stabledrop — early payment offer", ""],
      ["", ""],
      ["INPUTS", ""],
      ["Invoice", invoice],
      ["Payment terms (days)", terms],
      ["Bad debt now (%)", badDebt],
      ["Senior cap (%)", cap],
      ["Discount rate (%/yr)", discRate],
      ["Borrowing cost (%/yr)", borrowRate],
      ["Buyer's yield (%/yr)", buyerYield],
      ["Buyer's share of spread (%)", buyerShare],
      ["Job length (days)", jobDays],
      ["Stabledrop fee (%)", FEE_RATE],
      ["", ""],
      ["THE DEAL", ""],
      ["Buyer's forgone yield", { f: "B4*B10/100*B5/365" }],
      ["Borrowing avoided", { f: "B4*B9/100*B5/365" }],
      ["Bad debt avoided", { f: "B4*B6/100" }],
      ["Discount off their bill", m.discount],
      ["Locked in escrow", { f: "B4-B19" }],
      ["Stabledrop fee", { f: "B20*B13/100" }],
      ["Escrow, yours to sell", { f: "B20-B21" }],
      ["Funder's senior claim", { f: "B22*B7/100" }],
      ["Funder's cut", { f: "B23*B8/100*B5/365" }],
      ["Cash today (advance)", { f: "B23-B24" }],
      ["Your residual on release", { f: "B22-B23" }],
      ["You end up with", { f: "B25+B26" }],
      ["Funder breakeven refund %", { f: "(1-B25/B22)*100" }],
      ["", ""],
      ["YOUR YEAR", ""],
      ["Cycle now (days)", { f: "B12+B5" }],
      ["Jobs/yr now", { f: "365/B31" }],
      ["Revenue now", { f: "B32*B4*(1-B6/100)" }],
      ["Cycle paid day one", { f: "B12" }],
      ["Jobs/yr paid day one", { f: "365/B34" }],
      ["Revenue paid day one", { f: "B35*B27" }],
      ["Multiple", { f: "B36/B33" }],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Early payment offer");
    XLSX.writeFile(wb, "stabledrop-early-payment-offer.xlsx");
  };

  const inputStyle = (bad: boolean) => ({
    background: C.panel2,
    border: `1px solid ${bad ? C.red : C.line}`,
    borderRadius: 3,
    color: C.text,
    fontFamily: "inherit",
    fontSize: 13,
    padding: "9px 11px",
    width: "100%",
  });

  return (
    <>
      <SEO
        title="Triple Your Revenue by Changing Payment Terms — Stabledrop"
        description="Get paid on day one instead of waiting 60 days, and the same working capital turns three times as often. Your customer pays into escrow up front, you sell a senior claim on it for cash today — no borrowing, no personal guarantee. Model the discount, the funder's cap and rate, and the revenue impact."
      />
      <div
        style={{
          background: C.bg,
          color: C.text,
          fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace",
          padding: "26px 16px 70px",
          minHeight: "100%",
        }}
      >
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        .sd-range{-webkit-appearance:none;appearance:none;width:100%;background:transparent;height:24px;margin:0;cursor:pointer;position:relative;z-index:2}
        .sd-range:focus{outline:none}
        .sd-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px ${C.greenInk},0 0 0 4px ${C.green}}
        .sd-range::-webkit-slider-runnable-track{height:6px;background:transparent}
        .sd-range::-webkit-slider-thumb{-webkit-appearance:none;height:17px;width:17px;border-radius:50%;background:${C.green};border:3px solid ${C.bg};margin-top:-6px;box-shadow:0 0 9px ${C.green}55}
        .sd-range::-moz-range-track{height:6px;background:transparent}
        .sd-range::-moz-range-thumb{height:13px;width:13px;border-radius:50%;background:${C.green};border:3px solid ${C.bg};box-shadow:0 0 9px ${C.green}55}
        .sd-wrap{max-width:780px;margin:0 auto}
        .sd-2{display:grid;gap:16px}
        @media(min-width:700px){.sd-2{grid-template-columns:1fr 1fr}}
        .sd-3{display:grid;gap:14px}
        @media(min-width:700px){.sd-3{grid-template-columns:repeat(3,1fr)}}
        @media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
        .sd-btn{font-family:inherit;cursor:pointer;border-radius:3px}
      `}</style>

        <div className="sd-wrap">
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.1em", marginBottom: 26 }}>
            Instant Escrow · Conduit UCPI
          </div>

          {/* hero */}
          <h1 style={{ fontSize: 30, lineHeight: 1.2, fontWeight: 700, margin: "0 0 14px" }}>
            {m.multiple.toFixed(1)}× your revenue
            <br />
            <span style={{ color: C.green }}>on the same money</span>
          </h1>
          <p style={{ color: C.dim, fontSize: 13.5, lineHeight: 1.7, maxWidth: 620, margin: 0 }}>
            Your customer pays into escrow on day one. You sell most of the escrow
            and get the cash the same day, keeping the tail. A small discount makes
            it worth their while. Nothing borrowed, no personal guarantee, nobody
            waiting.
          </p>

          <div style={{ marginTop: 26 }}>
            <Panel glow>
              <Slider
                label="Invoice amount"
                value={invoice}
                onChange={setInvoice}
                min={1000}
                max={500000}
                step={1000}
                format={money}
                big
                allowType
                help="Type for higher amounts. Below ~250k no manual funding desk will bid — the underwriting cost exceeds the spread, so this has to be programmatic."
              />
              <Slider
                label="Payment terms (days)"
                value={terms}
                onChange={setTerms}
                min={7}
                max={120}
                step={1}
                format={(v) => `${v} days`}
                help={`Due ${due} — how long your customer takes to pay`}
              />
              <div className="sd-3" style={{ padding: "12px 0 14px" }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.dim, textTransform: "uppercase" }}>
                    Cash today
                  </div>
                  <div style={{ fontSize: 27, fontWeight: 700, color: C.green }}>
                    {money(m.advance)}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.dimmer }}>
                    {pct((m.advance / invoice) * 100)} of face, day one
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.dim, textTransform: "uppercase" }}>
                    Residual on {due}
                  </div>
                  <div style={{ fontSize: 27, fontWeight: 700, color: C.text }}>
                    {money(m.residual)}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.dimmer }}>if undisputed</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.dim, textTransform: "uppercase" }}>
                    Extra revenue / yr
                  </div>
                  <div style={{ fontSize: 27, fontWeight: 700, color: C.green }}>
                    +{money(m.revNew - m.revNow)}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.dimmer }}>
                    vs borrowing at {pct(borrowRate)}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* STEP 1 */}
          <Section
            eyebrow="Step 1 — the guarantee"
            title={`Your customer locks ${money(m.face)} into escrow before you start`}
          >
            <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>
              It's out of their account and locked. On <strong style={{ color: C.text }}>{due}</strong> it's
              released to you — automatically, no chasing. If you don't deliver,
              they get it back. Stabledrop's fee is a flat {pct(FEE_RATE, 0)} of the
              escrow, taken when it's funded. That's the whole cost, whatever you do
              next.
            </p>
            <Panel>
              <Slider
                label="What bad payers cost you now (%)"
                value={badDebt}
                onChange={setBadDebt}
                min={0}
                max={8}
                step={0.1}
                format={(v) => pct(v, 1)}
                bands={BAD_DEBT_BANDS}
                help="What you write off or chase, out of everything you invoice"
              />
              <Row label="Locked in escrow today" value={money(m.face)} />
              <Row label={`Stabledrop's fee — flat ${pct(FEE_RATE, 0)}`} value={`− ${money(m.fee)}`} tone="cost" />
              <Row label={`Yours on ${due} — guaranteed`} value={money(m.escrow)} strong />
              <Row label="Bad debt you stop carrying" value={`≈ ${money(m.badDebtAvoided)}/invoice`} tone="good" />
            </Panel>
          </Section>

          {/* STEP 2 */}
          <Section
            eyebrow="Step 2 — cash on day one"
            title={`Don't wait ${terms} days — sell the escrow for ${money(m.advance)} today`}
          >
            <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>
              A funder buys a senior claim on your escrow — repaid first, up to a
              cap. What's left is your <strong style={{ color: C.text }}>residual</strong>, paid
              when the escrow releases. The money's already locked in, so they take
              no risk on your customer, and charge like it:{" "}
              <strong style={{ color: C.green }}>{pct(discRate, 2)}</strong> against
              the <strong style={{ color: C.red }}>{pct(borrowRate, 1)}</strong> you'd
              pay to borrow. <strong style={{ color: C.text }}>No personal guarantee</strong> —
              there's no loan, so there's nothing to secure against your house.
            </p>

            {/* regime presets */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {(Object.keys(REGIMES) as RegimeKey[]).map((k) => {
                const r = REGIMES[k];
                const on = cap === r.cap && discRate === r.rate;
                return (
                  <button
                    key={k}
                    className="sd-btn"
                    onClick={() => applyRegime(k)}
                    style={{
                      flex: "1 1 170px",
                      padding: "10px 11px",
                      textAlign: "left",
                      background: on ? C.greenInk : C.panel,
                      border: `1px solid ${on ? C.green : C.line}`,
                      color: on ? C.green : C.dim,
                      fontSize: 11.5,
                    }}
                  >
                    {r.label}
                    <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 3 }}>
                      cap {r.cap} · {r.rate}%/yr
                    </div>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                padding: "10px 12px",
                background: C.panel2,
                borderLeft: `2px solid ${C.dimmer}`,
                fontSize: 11.5,
                lineHeight: 1.6,
                color: C.dim,
                marginBottom: 16,
              }}
            >
              {REGIMES[regime].blurb}
            </div>

            <Panel>
              <Slider
                label="Senior cap (% of escrow)"
                value={cap}
                onChange={setCap}
                min={80}
                max={100}
                step={0.5}
                format={(v) => pct(v, 1)}
                bands={CAP_BANDS}
                help="How much the funder is repaid before you see anything. The rest is your residual — and your first loss on a dispute."
              />
              <Slider
                label="Discount rate (% / yr)"
                value={discRate}
                onChange={setDiscRate}
                min={RISK_FREE}
                max={40}
                step={0.25}
                format={(v) => pct(v, 2)}
                bands={RATE_BANDS}
                help={`The funder's charge for paying you today. Floor is the risk-free rate, ${RISK_FREE}% (SOFR, 28 Jul 2026) — nothing prices below it.`}
              />
              <Slider
                label="What borrowing costs you now (%)"
                value={borrowRate}
                onChange={setBorrowRate}
                min={6}
                max={50}
                step={0.5}
                format={(v) => pct(v, 1)}
                bands={BORROW_BANDS}
                help="Source: iwoca — unsecured loans from 1.5%/month (~18%/yr), representative 40% APR"
              />

              {noSub ? (
                <div
                  style={{
                    margin: "2px 0 16px",
                    padding: "10px 12px",
                    background: C.redInk,
                    border: `1px solid ${C.red}`,
                    borderRadius: 3,
                    fontSize: 11.5,
                    lineHeight: 1.6,
                    color: C.red,
                  }}
                >
                  No subordination left. With nothing of yours underneath, a funder
                  is exposed to a full refund and can't price it. Expect no bids at
                  any rate.
                </div>
              ) : null}

              <Row label="Your escrow, after the fee" value={money(m.escrow)} />
              <Row label={`Funder's senior claim — cap ${pct(cap, 1)}`} value={money(m.senior)} />
              <Row label={`Funder's cut — ${pct(discRate, 2)}/yr over ${terms}d`} value={`− ${money(m.funderCut)}`} tone="cost" />
              <Row label="In your account today" value={money(m.advance)} tone="good" strong />
              <Row label={`Your residual on ${due}`} value={money(m.residual)} sub="paid after the funder, if undisputed" />
              <Row label={`Borrowing it instead at ${pct(borrowRate, 1)}`} value={money(m.borrowAlt)} sub="+ personal guarantee" />
              <Row
                label="You're ahead by"
                value={`${aheadOfBorrowing >= 0 ? "+" : "−"}${money(Math.abs(aheadOfBorrowing))}`}
                tone={aheadOfBorrowing >= 0 ? "good" : "cost"}
                strong
              />
            </Panel>

            {/* dispute absorption */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.dim, marginBottom: 10 }}>
                Who absorbs a dispute
              </div>
              <div style={{ display: "flex", height: 40, borderRadius: 3, overflow: "hidden", border: `1px solid ${C.line}` }}>
                <div style={{ width: `${100 - cap}%`, background: C.greenInk, borderRight: `1px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.green, minWidth: 0 }}>
                  your residual
                </div>
                <div style={{ width: `${Math.max(0, m.breakeven * 100 - (100 - cap))}%`, background: C.amberInk, borderRight: `1px solid ${C.amber}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.amber, minWidth: 0 }}>
                  carry
                </div>
                <div style={{ flex: 1, background: C.redInk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.red }}>
                  funder loses
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.dimmer, marginTop: 5 }}>
                <span>0% refund</span>
                <span style={{ color: C.amber }}>breakeven {pct(m.breakeven * 100, 1)}</span>
                <span>100%</span>
              </div>
              <p style={{ fontSize: 11.5, lineHeight: 1.65, color: C.dim, marginTop: 10 }}>
                Your residual takes the first {pct(100 - cap, 1)} of any refund, and
                the funder's discount buys another {pct(Math.max(0, m.breakeven * 100 - (100 - cap)), 1)} because
                it advanced less than its cap. Past {pct(m.breakeven * 100, 1)} the
                funder is out of pocket. A full refund costs it {money(m.advance)} —
                which no cap fixes, and is what an approved-arbitrator requirement
                is for.
              </p>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 430 }}>
                  <thead>
                    <tr>
                      {["Refund", "Funder P&L", "Your residual", "You keep"].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 9px", borderBottom: `1px solid ${C.lineB}`, color: C.dim, fontWeight: 500, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.waterfall.map((r) => (
                      <tr key={r.d}>
                        <td style={{ padding: "7px 9px", borderBottom: `1px solid ${C.line}` }}>{r.d}%</td>
                        <td style={{ padding: "7px 9px", textAlign: "right", borderBottom: `1px solid ${C.line}`, color: r.funderPnL >= 0 ? C.green : C.red }}>
                          {r.funderPnL >= 0 ? "+" : "−"}{money(Math.abs(r.funderPnL))}
                        </td>
                        <td style={{ padding: "7px 9px", textAlign: "right", borderBottom: `1px solid ${C.line}`, color: r.sellerLate > 0 ? C.text : C.dimmer }}>
                          {money(r.sellerLate)}
                        </td>
                        <td style={{ padding: "7px 9px", textAlign: "right", borderBottom: `1px solid ${C.line}` }}>
                          {money(r.sellerTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: C.dimmer, marginTop: 6 }}>
                No recourse — the advance already paid to you isn't clawed back.
              </div>
            </div>
          </Section>

          {/* STEP 3 */}
          <Section
            eyebrow="Step 3 — why your customer says yes"
            title={`Pay them ${money(m.discount)} to fund the escrow up front`}
          >
            <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>
              Holding {money(invoice)} for {terms} days earns them{" "}
              <strong style={{ color: C.text }}>{money(m.buyerEarn)}</strong>. That's
              why they pay late. Offer a discount worth more and paying today becomes
              the better deal — plus, if you don't deliver, they get their money
              back. That protection is free.
            </p>
            <Panel>
              <Slider
                label="What their cash earns them (%)"
                value={buyerYield}
                onChange={setBuyerYield}
                min={0}
                max={10}
                step={0.05}
                format={(v) => pct(v, 2)}
                bands={YIELD_BANDS}
                help={`Interest they make holding your money. Risk-free is ${RISK_FREE}% (SOFR, 28 Jul 2026).`}
              />
              <Slider
                label="Buyer's share of the spread (%)"
                value={buyerShare}
                onChange={setBuyerShare}
                min={0}
                max={100}
                step={1}
                format={(v) => pct(v, 0)}
                bands={SHARE_BANDS}
                help={`${money(m.grossSpread)} on the table. At ${pct(buyerShare, 0)} they keep ${money(m.buyerCut)}, you keep ${money(m.grossSpread - m.buyerCut)}.`}
              />
              <Row label="Discount off their bill" value={`− ${money(m.discount)}`} tone="cost" />
              <Row label="They'd earn by waiting" value={money(m.buyerEarn)} />
              <Row
                label="They're better off by"
                value={`+${money(buyerBetter)}`}
                tone="good"
                strong
                sub={`equivalent to ${pct(buyerApr, 2)} APR on the cash`}
              />
            </Panel>
          </Section>

          {/* MESSAGE */}
          <Section eyebrow="Send it to them" title="The message that makes the ask">
            <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.7, marginTop: 0 }}>
              Built from your numbers above — it updates as you move the sliders.
              Copy it into an email or WhatsApp and edit as you like.
            </p>
            <div className="sd-2" style={{ marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>
                  Your customer's name
                </div>
                <input
                  ref={nameRef}
                  value={custName}
                  onChange={(e) => { setCustName(e.target.value); if (e.target.value.trim()) setNudge(false); }}
                  style={inputStyle(nudge)}
                  placeholder="Jane"
                  aria-label="Your customer's name"
                />
                {nudge ? (
                  <div style={{ fontSize: 10.5, color: C.red, marginTop: 5 }}>
                    Add their name first.
                  </div>
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>
                  Sign off as
                </div>
                <input
                  value={signOff}
                  onChange={(e) => setSignOff(e.target.value)}
                  style={inputStyle(false)}
                  placeholder="Charlie"
                  aria-label="Sign off as"
                />
              </div>
            </div>
            <pre
              style={{
                background: C.panel2,
                border: `1px solid ${C.line}`,
                borderRadius: 4,
                padding: 16,
                fontSize: 12,
                lineHeight: 1.7,
                color: C.text,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: 0,
              }}
            >
              {message}
            </pre>
            <button
              className="sd-btn"
              onClick={copy}
              style={{
                marginTop: 12,
                padding: "11px 20px",
                background: copied ? C.greenInk : C.green,
                border: `1px solid ${C.green}`,
                color: copied ? C.green : C.bg,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              {copied ? "Copied" : "Copy message"}
            </button>
          </Section>

          {/* ALL TOGETHER */}
          <Section eyebrow="All of it together">
            <Panel>
              <Row label="Your invoice" value={money(invoice)} />
              <Row label="Customer's discount" value={`− ${money(m.discount)}`} tone="cost" />
              <Row label={`Stabledrop's fee (${pct(FEE_RATE, 0)})`} value={`− ${money(m.fee)}`} tone="cost" />
              <Row label="Funder's cut" value={`− ${money(m.funderCut)}`} tone="cost" />
              <Row label="In your account today" value={money(m.advance)} tone="good" strong />
              <Row label={`Your residual on ${due}`} value={`+ ${money(m.residual)}`} />
              <Row label="You end up with" value={money(m.total)} strong />
              <Row label={`The old way: borrow at ${pct(borrowRate, 1)}`} value={money(m.borrowAlt)} />
              <Row
                label="You keep"
                value={`${aheadOfBorrowing >= 0 ? "+" : "−"}${money(Math.abs(aheadOfBorrowing))}`}
                tone={aheadOfBorrowing >= 0 ? "good" : "cost"}
                strong
              />
            </Panel>
            <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.7 }}>
              You're up, your customer's up, and the bad debt is gone. Nobody paid
              for that — it's what taking the credit risk{" "}
              <strong style={{ color: C.text }}>out</strong> of the deal is worth.
            </p>
          </Section>

          {/* THE YEAR */}
          <Section eyebrow="The real prize — your year">
            <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>
              Each job ties up your money for {m.cycleNow} days — {jobDays} working,{" "}
              {terms} waiting to be paid. Get paid on day one and the waiting
              disappears: the same money starts the next job straight away.
            </p>
            <Panel>
              <Slider
                label="How long a job takes (days)"
                value={jobDays}
                onChange={setJobDays}
                min={3}
                max={120}
                step={1}
                format={(v) => `${v} days`}
                help="Order to delivery. The rest of the cycle is just waiting."
              />
              <div className="sd-2" style={{ padding: "8px 0 16px" }}>
                <div style={{ padding: 14, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 3 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim }}>
                    As you are now
                  </div>
                  <div style={{ fontSize: 11.5, color: C.dimmer, margin: "3px 0 8px" }}>
                    {m.cycleNow}-day cycle
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
                    {m.jobsNow.toFixed(1)} jobs/yr
                  </div>
                  <div style={{ fontSize: 15, color: C.dim, marginTop: 4 }}>
                    {money(m.revNow)}
                  </div>
                </div>
                <div style={{ padding: 14, background: C.greenInk, border: `1px solid ${C.green}`, borderRadius: 3 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.green }}>
                    Paid on day one
                  </div>
                  <div style={{ fontSize: 11.5, color: C.green, opacity: 0.7, margin: "3px 0 8px" }}>
                    {jobDays}-day cycle
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>
                    {m.jobsNew.toFixed(1)} jobs/yr
                  </div>
                  <div style={{ fontSize: 15, color: C.green, marginTop: 4 }}>
                    {money(m.revNew)}
                  </div>
                </div>
              </div>
              <Row
                label="Extra revenue capacity"
                sub="Same money. Nothing borrowed."
                value={`+${money(m.revNew - m.revNow)}`}
                tone="good"
                strong
              />
              <Row label="Extra jobs / yr" value={`+${(m.jobsNew - m.jobsNow).toFixed(1)}`} />
            </Panel>
            <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7 }}>
              <strong style={{ color: C.green }}>{m.multiple.toFixed(1)}× the revenue off the same pot.</strong>{" "}
              You still have to win the work — but the money is no longer what's
              stopping you.
            </p>
          </Section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 30 }}>
            <a
              href="https://stabledrop.me/merchant"
              className="sd-btn"
              style={{
                padding: "11px 20px",
                background: C.green,
                border: `1px solid ${C.green}`,
                color: C.bg,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textDecoration: "none",
              }}
            >
              Find out more
            </a>
            <button
              className="sd-btn"
              onClick={exportXlsx}
              style={{
                padding: "11px 20px",
                background: "transparent",
                border: `1px solid ${C.lineB}`,
                color: C.text,
                fontSize: 12.5,
                letterSpacing: "0.06em",
              }}
            >
              Export to Excel
            </button>
          </div>

          <p style={{ fontSize: 10, lineHeight: 1.8, color: C.dimmer, marginTop: 28 }}>
            The discount is {pct((m.discount / invoice) * 100, 2)} of your invoice — a
            trade discount, not interest. Nothing is invested; the escrow can always
            pay out in full. Stabledrop's fee is a flat {pct(FEE_RATE, 0)} of the
            escrowed amount. The funder sets the senior cap and the discount rate,
            not Stabledrop; the residual is whatever the cap leaves and is paid after
            the funder. Slider bands are indicative of comparable short-dated
            collateralised trade paper, not quotes. Risk-free floor {RISK_FREE}%
            (SOFR, 28 Jul 2026; use SONIA for sterling). Borrowing comparison based
            on iwoca published rates (from 1.5%/month; representative 40% APR).
            Simple interest, actual/365. Estimates, not financial advice.
            <br />
            <br />© 2026 Conduit UCPI. Secure escrow contracts on blockchain. Company
            No. 880319.
          </p>
        </div>
      </div>
    </>
  );
}
