import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import SEO from "@/components/SEO";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700;800&display=swap');

.sd {
  --bg: #0b0c0b;
  --card: #151715;
  --card-2: #101210;
  --line: #262a26;
  --ink: #f2f4f2;
  --muted: #8b918b;
  --green: #4ade80;
  --green-dim: #86efac;
  --green-glow: rgba(74, 222, 128, 0.35);
  --green-tint: rgba(74, 222, 128, 0.07);
  --red: #f0625d;
  background: var(--bg);
  color: var(--ink);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  min-height: 100%;
  padding: 28px 18px 56px;
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums;
}
.sd-wrap { max-width: 960px; margin: 0 auto; }

.sd-h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(26px, 4.8vw, 40px); font-weight: 700; letter-spacing: -0.02em;
  margin: 0 0 8px;
}
.sd-h1 .x { color: var(--green); text-shadow: 0 0 24px var(--green-glow); }
.sd-sub { font-size: 13px; color: var(--muted); margin: 0 0 28px; line-height: 1.6; max-width: 62ch; }

.sd-top { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
@media (max-width: 760px) { .sd-top { grid-template-columns: 1fr; } }

.sd-card {
  background: var(--card); border: 1px solid var(--line); border-radius: 16px;
  padding: 24px; margin-bottom: 18px;
}
.sd-card.flat { margin-bottom: 0; }

.sd-hero {
  background: radial-gradient(120% 120% at 50% 0%, rgba(74,222,128,0.12), rgba(74,222,128,0.02) 60%), var(--card-2);
  border: 1.5px solid var(--green); border-radius: 16px; padding: 28px 24px;
  box-shadow: 0 0 40px rgba(74, 222, 128, 0.12), inset 0 0 60px rgba(74, 222, 128, 0.03);
  display: flex; flex-direction: column; justify-content: center; text-align: center;
}
.sd-hero-lab {
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--green); margin-bottom: 12px; font-weight: 500;
}
.sd-hero-val {
  font-size: clamp(38px, 6vw, 52px); font-weight: 800; color: var(--green);
  text-shadow: 0 0 28px var(--green-glow); letter-spacing: -0.02em; line-height: 1;
}
.sd-hero-sub { font-size: 12.5px; color: var(--muted); margin-top: 12px; }
.sd-hero-div { border-top: 1px solid rgba(74,222,128,0.2); margin: 20px 0 16px; }
.sd-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sd-hero-cell .l { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
.sd-hero-cell .v { font-size: 17px; font-weight: 700; color: var(--green); }
.sd-hero-cell .v.neg { color: var(--red); }

.sd-lab {
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted); font-weight: 500; margin-bottom: 10px;
}
.sd-ctl { margin-bottom: 22px; }
.sd-ctl:last-child { margin-bottom: 4px; }
.sd-box {
  background: var(--card-2); border: 1px solid var(--line); border-radius: 10px;
  color: var(--green); font-family: inherit; font-size: 19px; font-weight: 700;
  padding: 12px 16px; width: 172px; margin-bottom: 12px;
}
.sd-box:focus-visible { outline: 1.5px solid var(--green); border-color: var(--green); }
.sd-hint { font-size: 11px; color: var(--muted); margin-top: 9px; line-height: 1.5; }

input[type=range].sd-range {
  -webkit-appearance: none; appearance: none; width: 100%; height: 22px;
  background: transparent; cursor: pointer; display: block;
}
input[type=range].sd-range::-webkit-slider-runnable-track {
  height: 3px; background: #3a3f3a; border-radius: 999px;
}
input[type=range].sd-range::-moz-range-track { height: 3px; background: #3a3f3a; border-radius: 999px; }
input[type=range].sd-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
  background: var(--green); border-radius: 50%; margin-top: -8.5px;
  box-shadow: 0 0 14px var(--green-glow);
}
input[type=range].sd-range::-moz-range-thumb {
  width: 20px; height: 20px; background: var(--green); border: none; border-radius: 50%;
  box-shadow: 0 0 14px var(--green-glow);
}
input[type=range].sd-range:focus-visible { outline: 1.5px solid var(--green); outline-offset: 4px; border-radius: 999px; }

.sd-step-t {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 19px; font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 10px; color: var(--ink);
}
.sd-p { font-size: 13px; line-height: 1.7; color: var(--muted); margin: 0 0 6px; max-width: 68ch; }
.sd-p b { color: var(--ink); font-weight: 700; }
.sd-p .g { color: var(--green); font-weight: 700; }

.sd-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-top: 18px; }
@media (max-width: 640px) { .sd-grid2 { grid-template-columns: 1fr; } }

.sd-rows { margin-top: 16px; border-top: 1px solid var(--line); }
.sd-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 14px;
  font-size: 13px; padding: 10px 0; border-bottom: 1px solid var(--line);
}
.sd-row .k { color: var(--muted); }
.sd-row .k small { display: block; font-size: 10.5px; opacity: 0.8; margin-top: 2px; }
.sd-row .v { font-weight: 700; white-space: nowrap; color: var(--ink); }
.sd-row .v.neg { color: var(--red); }
.sd-row .v.pos { color: var(--green); }
.sd-row .v small { font-size: 10.5px; color: var(--muted); font-weight: 400; margin-left: 7px; }
.sd-row.tot .k { color: var(--ink); font-weight: 700; }
.sd-row.tot .v { color: var(--green); font-size: 15px; }

.sd-pill {
  margin-top: 16px; padding: 13px 16px; border-radius: 12px; font-size: 12.5px;
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  border: 1px solid;
}
.sd-pill.good { background: var(--green-tint); border-color: rgba(74,222,128,0.35); color: var(--green); }
.sd-pill.warn { background: rgba(240,98,93,0.06); border-color: rgba(240,98,93,0.35); color: var(--red); }
.sd-pill .amt { font-size: 17px; font-weight: 800; white-space: nowrap; }

.sd-turn-r {
  display: grid; grid-template-columns: 1fr auto auto; gap: 8px 18px;
  padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 13px; align-items: baseline;
}
.sd-turn-r .lab { color: var(--ink); }
.sd-turn-r .lab span { display: block; font-size: 10.5px; color: var(--muted); margin-top: 2px; }
.sd-turn-r .num { color: var(--muted); text-align: right; min-width: 88px; font-size: 12px; }
.sd-turn-r .rev { font-weight: 700; text-align: right; min-width: 100px; }
.sd-turn-r.gain { border-bottom: none; }
.sd-turn-r.gain .lab, .sd-turn-r.gain .num { color: var(--green); }
.sd-turn-r.gain .rev {
  color: var(--green); font-size: 22px; font-weight: 800;
  text-shadow: 0 0 18px var(--green-glow);
}

.sd-msg-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 28px; margin: 14px 0 4px; }
@media (max-width: 640px) { .sd-msg-fields { grid-template-columns: 1fr; } }
.sd-msg-box {
  background: var(--card-2); border: 1px solid var(--line); border-radius: 10px;
  color: var(--ink); font-family: inherit; font-size: 13px; font-weight: 500;
  padding: 11px 14px; width: 100%; box-sizing: border-box;
}
.sd-msg-box:focus-visible { outline: 1.5px solid var(--green); border-color: var(--green); }
.sd-msg-box.nudge { border-color: var(--red); outline: 1.5px solid var(--red); }
.sd-nudge-txt { font-size: 11px; color: var(--red); margin-top: 7px; }
.sd-msg-pre {
  background: var(--card-2); border: 1px solid var(--line); border-radius: 12px;
  padding: 18px 20px; margin-top: 16px; font-size: 12.5px; line-height: 1.75;
  color: var(--ink); white-space: pre-wrap; font-family: inherit;
}
.sd-msg-actions { display: flex; gap: 10px; margin-top: 14px; }
.sd-copy {
  background: linear-gradient(180deg, var(--green-dim), var(--green));
  color: #06130a; border: none; border-radius: 10px; padding: 11px 22px;
  font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer; font-family: inherit;
}
.sd-copy.done { background: var(--card); color: var(--green); border: 1px solid var(--green); }
.sd-cta { display: flex; gap: 12px; margin: 26px 0 10px; }
.sd-btn {
  flex: 1; text-align: center;
  background: linear-gradient(180deg, var(--green-dim), var(--green));
  color: #06130a; border: none; border-radius: 14px;
  padding: 17px 26px; font-size: 14px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; cursor: pointer; font-family: inherit; text-decoration: none;
  box-shadow: 0 0 30px rgba(74, 222, 128, 0.25);
}
.sd-btn:hover { filter: brightness(1.06); }
.sd-btn.ghost {
  flex: 0 0 auto; background: var(--card); color: var(--ink);
  border: 1px solid var(--line); box-shadow: none;
}
.sd-btn.ghost:hover { border-color: var(--green); color: var(--green); filter: none; }

.sd-foot {
  margin-top: 30px; padding-top: 18px; border-top: 1px solid var(--line);
  font-size: 10.5px; color: var(--muted); line-height: 1.75;
}
`;

const n0 = (x: number) => Math.round(x).toLocaleString("en-GB");
const dayShort = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const FEE_PCT = 1.0; // Stabledrop's flat fee, % of escrowed amount

interface CtlProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
}

function Ctl({ label, hint, value, onChange, min, max, step }: CtlProps) {
  const [txt, setTxt] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setTxt(String(value));
  }, [value, editing]);

  const commit = (t: string) => {
    setTxt(t);
    if (t === "" || t === "-" || t === ".") return;
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  };

  return (
    <div className="sd-ctl">
      <div className="sd-lab">{label}</div>
      <input
        className="sd-box"
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={txt}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          setTxt(String(value));
        }}
        onChange={(e) => commit(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <input
        className="sd-range"
        type="range"
        aria-label={label + " slider"}
        value={Math.min(Math.max(value, min), max)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="sd-hint">{hint}</div>}
    </div>
  );
}

export default function EarlyPaymentOffer() {
  const [face, setFace] = useState(100000);
  const [days, setDays] = useState(60);
  const [deliver, setDeliver] = useState(30);
  const [yield_, setYield] = useState(5.0);
  const [rOffer, setROffer] = useState(6.0);
  const [rEscrowFactor, setREscrowFactor] = useState(2.0);
  const [rBorrow, setRBorrow] = useState(30.0);
  const [badDebt, setBadDebt] = useState(2.0);

  const m = useMemo(() => {
    const yf = days / 365;
    const escrow = face / (1 + (rOffer / 100) * yf);
    const discount = face - escrow;
    const neutral = face / (1 + (yield_ / 100) * yf);
    const feeAmt = escrow * (FEE_PCT / 100);
    const netClaim = escrow - feeAmt;
    const cashNow = netClaim / (1 + (rEscrowFactor / 100) * yf);
    const borrowNow = face / (1 + (rBorrow / 100) * yf);
    const cycleNow = deliver + days;
    const due = new Date(Date.now() + days * 86400000);
    return {
      escrow, discount, feeAmt, netClaim, cashNow, borrowNow, due, cycleNow,
      buyerEarns: face - neutral,
      buyerGain: neutral - escrow,
      factorCut: netClaim - cashNow,
      gain: cashNow - borrowNow,
      badDebtCost: face * (badDebt / 100),
      pct: face > 0 ? (discount / face) * 100 : 0,
      turnsNow: 365 / cycleNow,
      turnsNew: 365 / deliver,
      multiple: cycleNow / deliver,
      revNow: (365 / cycleNow) * face,
      revNew: (365 / deliver) * face,
      revGain: (365 / deliver) * face - (365 / cycleNow) * face,
    };
  }, [face, days, deliver, yield_, rOffer, rEscrowFactor, rBorrow, badDebt]);

  const [buyerName, setBuyerName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [copied, setCopied] = useState(false);
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const message = useMemo(() => {
    const hi = `Hi ${buyerName.trim() || "[customer name]"},`;
    const sign = sellerName.trim() ? `\n${sellerName.trim()}` : "";
    return `${hi}

A proposal on our ${n0(face)} invoice, due ${dayShort(m.due)}.

Paying at the end of the terms makes sense for you today: holding the cash for ${days} days earns you roughly ${n0(m.buyerEarns)} at ${yield_.toFixed(2)}%.

We'd like to beat that. Fund the invoice into escrow today and we'll take ${n0(m.discount)} off — you pay ${n0(m.escrow)} instead of ${n0(face)}. That's equivalent to earning ${rOffer.toFixed(2)}% APR on the cash over the same period, better than holding it.

The money doesn't come to us. It sits locked in a Stabledrop escrow and is only released when we've delivered — if we don't, you get it back. Buyer protection and dispute management are built in.

Paying this way genuinely helps us: it guarantees payment on time, and lets us factor the invoice to access the capital early and keep working on your next orders.

Happy to walk through the numbers.${sign}`;
  }, [buyerName, sellerName, face, days, yield_, rOffer, m]);

  const copyMsg = async () => {
    if (!buyerName.trim()) {
      setNeedName(true);
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    setNeedName(false);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const exportXlsx = () => {
    const cur = "#,##0";
    const pct = "0.00%";
    const rows = [
      ["Stabledrop — early payment model"],
      ["Change the yellow-noted inputs (rows 5–13) and everything recalculates. Amounts in USDC."],
      [],
      ["INPUTS", "", ""],
      ["Invoice amount", face, "Full amount you'd normally bill"],
      ["Payment terms (days)", days, "How long your customer takes to pay"],
      ["Job length (days)", deliver, "Order to delivery"],
      ["Customer's yield on cash", yield_ / 100, "What holding the money earns them, annualised"],
      ["Discount you offer (annualised)", rOffer / 100, "Set above their yield so they say yes"],
      ["Escrow factoring rate", rEscrowFactor / 100, "Funder's charge — no credit risk left to price"],
      ["Your borrowing cost today", rBorrow / 100, "Source: iwoca — from 1.5%/mo; representative 40% APR"],
      ["Stabledrop fee (flat, % of escrow)", FEE_PCT / 100, "Fixed. Taken once, when the escrow is funded"],
      ["Bad debt rate today", badDebt / 100, "What you write off or chase"],
      [],
      ["STEP 1 — THE GUARANTEE", "", ""],
      ["Year fraction (terms/365)", 0, "Simple interest, actual/365"],
      ["Escrowed by customer at day 0", 0, ""],
      ["Stabledrop's fee (taken at funding)", 0, ""],
      ["Released to you at maturity — guaranteed", 0, ""],
      ["Bad debt you stop carrying (memo)", 0, ""],
      [],
      ["STEP 2 — CASH ON DAY ONE", "", ""],
      ["Funder's cut", 0, "No personal guarantee — nothing to secure"],
      ["In your account on day one", 0, ""],
      ["Borrowing the same the old way", 0, "Plus a personal guarantee"],
      ["You're ahead by", 0, ""],
      [],
      ["STEP 3 — WHY YOUR CUSTOMER SAYS YES", "", ""],
      ["Discount off their bill", 0, ""],
      ["They'd earn by holding their cash", 0, ""],
      ["They're better off by", 0, "Positive = they say yes; protection is free"],
      [],
      ["THE REAL PRIZE — YOUR YEAR", "", ""],
      ["Cash cycle today (days)", 0, "Job + waiting"],
      ["Jobs per year today", 0, ""],
      ["Revenue capacity today", 0, ""],
      ["Jobs per year, paid on day one", 0, ""],
      ["Revenue capacity, paid on day one", 0, ""],
      ["Extra revenue capacity per year", 0, "Same money, nothing borrowed"],
      ["Revenue multiple", 0, ""],
      [],
      ["Estimates, not financial advice. © 2026 Conduit UCPI, Company No. SC880319."],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const F = (a: string, f: string, z: string) => { (ws as any)[a] = { t: "n", f, z }; };
    // inputs formats
    ["B5", "B6", "B7"].forEach((a) => ((ws as any)[a].z = cur));
    ["B8", "B9", "B10", "B11", "B12", "B13"].forEach((a) => ((ws as any)[a].z = pct));
    // step 1
    F("B16", "B6/365", "0.0000");
    F("B17", "B5/(1+B9*B16)", cur);
    F("B18", "-B17*B12", cur);
    F("B19", "B17+B18", cur);
    F("B20", "B5*B13", cur);
    // step 2
    F("B23", "-(B19-B19/(1+B10*B16))", cur);
    F("B24", "B19+B23", cur);
    F("B25", "B5/(1+B11*B16)", cur);
    F("B26", "B24-B25", cur);
    // step 3
    F("B29", "B5-B17", cur);
    F("B30", "B5-B5/(1+B8*B16)", cur);
    F("B31", "B29-B30", cur);
    // year
    F("B34", "B7+B6", "0");
    F("B35", "365/B34", "0.0");
    F("B36", "B35*B5", cur);
    F("B37", "365/B7", "0.0");
    F("B38", "B37*B5", cur);
    F("B39", "B38-B36", cur);
    F("B40", "B34/B7", '0.0"×"');
    ws["!cols"] = [{ wch: 42 }, { wch: 15 }, { wch: 52 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Model");
    XLSX.writeFile(wb, "stabledrop-model.xlsx");
  };

  const buyerYes = m.buyerGain > 0;
  const sellerAhead = m.gain > 0;

  return (
    <>
      <SEO
        title="Triple Your Revenue by Changing Payment Terms — Stabledrop"
        description="Get paid on day one instead of waiting 60 days, and the same working capital turns three times as often. Your customer pays into escrow up front, you sell the escrow for cash today — no borrowing, no personal guarantee. Model the discount, factoring, and revenue impact."
      />
      <div className="sd">
        <style>{CSS}</style>
        <div className="sd-wrap">
          <h1 className="sd-h1">
            <span className="x">{m.multiple.toFixed(1)}×</span> your revenue on the same
            money
          </h1>
          <p className="sd-sub">
            Your customer pays into escrow on day one. You sell the escrow and get the cash
            the same day. A small discount makes it worth their while. Nothing borrowed, no
            personal guarantee, nobody waiting.
          </p>

          <div className="sd-top">
            <div className="sd-card flat">
              <Ctl
                label="Invoice amount"
                hint="Slider: 1k – 500k (type for higher amounts)"
                value={face}
                onChange={setFace}
                min={1000}
                max={500000}
                step={1000}
              />
              <Ctl
                label="Payment terms (days)"
                hint={`Due ${dayShort(m.due)} — how long your customer takes to pay`}
                value={days}
                onChange={setDays}
                min={7}
                max={180}
                step={1}
              />
            </div>

            <div className="sd-hero">
              <div className="sd-hero-lab">Cash in your account today</div>
              <div className="sd-hero-val">{n0(m.cashNow)}</div>
              <div className="sd-hero-sub">
                on a {n0(face)} invoice at {days} days
              </div>
              <div className="sd-hero-div" />
              <div className="sd-hero-grid">
                <div className="sd-hero-cell">
                  <div className="l">Extra revenue / yr</div>
                  <div className="v">+{n0(m.revGain)}</div>
                </div>
                <div className="sd-hero-cell">
                  <div className="l">vs borrowing at {rBorrow.toFixed(0)}%</div>
                  <div className={`v${sellerAhead ? "" : " neg"}`}>
                    {sellerAhead ? "+" : "−"}{n0(Math.abs(m.gain))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1 */}
          <div className="sd-card">
            <div className="sd-lab">Step 1 — the guarantee</div>
            <p className="sd-step-t">
              Your customer locks {n0(m.escrow)} into escrow before you start
            </p>
            <p className="sd-p">
              It's out of their account and locked. On <b>{dayShort(m.due)}</b> it's
              released to you — automatically, no chasing. If you don't deliver, they get
              it back. Stabledrop's fee is a flat <span className="g">{FEE_PCT.toFixed(0)}%</span>{" "}
              of the escrow, taken when it's funded. That's the whole cost, whatever you do
              next.
            </p>
            <div className="sd-grid2">
              <Ctl
                label="What bad payers cost you now (%)"
                hint="What you write off or chase, out of everything you invoice"
                value={badDebt}
                onChange={setBadDebt}
                min={0}
                max={10}
                step={0.5}
              />
            </div>
            <div className="sd-rows">
              <div className="sd-row">
                <span className="k">Locked in escrow today</span>
                <span className="v">{n0(m.escrow)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Stabledrop's fee — flat {FEE_PCT.toFixed(0)}%</span>
                <span className="v neg">− {n0(m.feeAmt)}</span>
              </div>
              <div className="sd-row tot">
                <span className="k">Yours on {dayShort(m.due)} — guaranteed</span>
                <span className="v">{n0(m.netClaim)}</span>
              </div>
            </div>
            <div className="sd-pill good">
              <span>Bad debt you stop carrying</span>
              <span className="amt">≈ {n0(m.badDebtCost)}/invoice</span>
            </div>
          </div>

          {/* 2 */}
          <div className="sd-card">
            <div className="sd-lab">Step 2 — cash on day one</div>
            <p className="sd-step-t">
              Don't wait {days} days — sell the escrow for {n0(m.cashNow)} today
            </p>
            <p className="sd-p">
              A funder buys your place in the escrow and pays you now. The money's already
              locked in, so they take no risk on your customer — and charge like it:{" "}
              <span className="g">{rEscrowFactor.toFixed(1)}%</span> against the{" "}
              <b>{rBorrow.toFixed(1)}%</b> you'd pay to borrow. <b>No personal
              guarantee</b> — there's no loan, so there's nothing to secure against your
              house.
            </p>
            <div className="sd-grid2">
              <Ctl
                label="Factoring the escrow (%)"
                hint="The funder's charge for paying you today. Low — no credit risk left to price"
                value={rEscrowFactor}
                onChange={setREscrowFactor}
                min={0}
                max={20}
                step={0.5}
              />
              <Ctl
                label="What borrowing costs you now (%)"
                hint="Source: iwoca — unsecured loans from 1.5%/month (~18%/yr), representative 40% APR"
                value={rBorrow}
                onChange={setRBorrow}
                min={0}
                max={40}
                step={0.5}
              />
            </div>
            <div className="sd-rows">
              <div className="sd-row">
                <span className="k">Your escrow, after the fee</span>
                <span className="v">{n0(m.netClaim)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Funder's cut</span>
                <span className="v neg">− {n0(m.factorCut)}</span>
              </div>
              <div className="sd-row tot">
                <span className="k">In your account today</span>
                <span className="v">{n0(m.cashNow)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Borrowing it instead</span>
                <span className="v">
                  {n0(m.borrowNow)}
                  <small>+ personal guarantee</small>
                </span>
              </div>
            </div>
            <div className={`sd-pill ${sellerAhead ? "good" : "warn"}`}>
              <span>{sellerAhead ? "You're ahead by" : "You're behind by"}</span>
              <span className="amt">
                {sellerAhead ? "+" : "−"}{n0(Math.abs(m.gain))}
              </span>
            </div>
          </div>

          {/* 3 */}
          <div className="sd-card">
            <div className="sd-lab">Step 3 — why your customer says yes</div>
            <p className="sd-step-t">
              Pay them {n0(m.discount)} to fund the escrow up front
            </p>
            <p className="sd-p">
              Holding {n0(face)} for {days} days earns them <b>{n0(m.buyerEarns)}</b>.
              That's why they pay late. Offer a discount worth slightly more and paying
              today becomes the better deal — plus, if you don't deliver, they get their
              money back. That protection is free.
            </p>
            <div className="sd-grid2">
              <Ctl
                label="What their cash earns them (%)"
                hint="Interest they make holding your money for the invoice period"
                value={yield_}
                onChange={setYield}
                min={0}
                max={15}
                step={0.25}
              />
              <Ctl
                label="The discount you offer (%)"
                hint={`Anything above ${yield_.toFixed(2)}% and they win by paying today`}
                value={rOffer}
                onChange={setROffer}
                min={0}
                max={20}
                step={0.25}
              />
            </div>
            <div className="sd-rows">
              <div className="sd-row">
                <span className="k">Discount off their bill</span>
                <span className="v neg">− {n0(m.discount)}</span>
              </div>
              <div className="sd-row">
                <span className="k">They'd earn by waiting</span>
                <span className="v">{n0(m.buyerEarns)}</span>
              </div>
            </div>
            <div className={`sd-pill ${buyerYes ? "good" : "warn"}`}>
              <span>
                {buyerYes ? "They're better off by" : "They're worse off — they'll say no"}
              </span>
              <span className="amt">
                {buyerYes ? "+" : "−"}{n0(Math.abs(m.buyerGain))}
              </span>
            </div>
          </div>

          {/* message */}
          <div className="sd-card">
            <div className="sd-lab">Send it to them</div>
            <p className="sd-step-t">The message that makes the ask</p>
            <p className="sd-p">
              Built from your numbers above — it updates as you move the sliders. Copy it
              into an email or WhatsApp and edit as you like.
            </p>
            <div className="sd-msg-fields">
              <div>
                <div className="sd-lab">Your customer's name</div>
                <input
                  ref={nameRef}
                  className={`sd-msg-box${needName ? " nudge" : ""}`}
                  type="text"
                  placeholder="e.g. Sarah"
                  value={buyerName}
                  onChange={(e) => {
                    setBuyerName(e.target.value);
                    if (e.target.value.trim()) setNeedName(false);
                  }}
                />
                {needName && (
                  <div className="sd-nudge-txt">
                    Add your customer's name before copying
                  </div>
                )}
              </div>
              <div>
                <div className="sd-lab">Sign off as</div>
                <input
                  className="sd-msg-box"
                  type="text"
                  placeholder="e.g. Charlie, Acme Ltd"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                />
              </div>
            </div>
            <div className="sd-msg-pre">{message}</div>
            <div className="sd-msg-actions">
              <button className={`sd-copy${copied ? " done" : ""}`} onClick={copyMsg}>
                {copied ? "Copied ✓" : "Copy message"}
              </button>
            </div>
          </div>

          {/* tally */}
          <div className="sd-card">
            <div className="sd-lab">All of it together</div>
            <div className="sd-rows" style={{ marginTop: 8 }}>
              <div className="sd-row">
                <span className="k">Your invoice</span>
                <span className="v">{n0(face)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Customer's discount</span>
                <span className="v neg">− {n0(m.discount)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Stabledrop's fee ({FEE_PCT.toFixed(0)}%)</span>
                <span className="v neg">− {n0(m.feeAmt)}</span>
              </div>
              <div className="sd-row">
                <span className="k">Funder's cut</span>
                <span className="v neg">− {n0(m.factorCut)}</span>
              </div>
              <div className="sd-row tot">
                <span className="k">In your account today</span>
                <span className="v">{n0(m.cashNow)}</span>
              </div>
              <div className="sd-row">
                <span className="k">The old way: borrow at {rBorrow.toFixed(1)}%</span>
                <span className="v">{n0(m.borrowNow)}</span>
              </div>
            </div>
            <div className={`sd-pill ${sellerAhead ? "good" : "warn"}`}>
              <span>You keep</span>
              <span className="amt">
                {sellerAhead ? "+" : "−"}{n0(Math.abs(m.gain))}
              </span>
            </div>
            <p className="sd-p" style={{ marginTop: 14 }}>
              {sellerAhead ? (
                <>
                  You're up, your customer's up, and the bad debt is gone. Nobody paid for
                  that — it's what taking the credit risk <b>out</b> of the deal is worth.
                </>
              ) : (
                <>
                  On these numbers the costs outweigh the borrowing you'd replace. The gap
                  between {rEscrowFactor.toFixed(1)}% and {rBorrow.toFixed(1)}% has to
                  cover the discount and both fees.
                </>
              )}
            </p>
          </div>

          {/* recycle */}
          <div className="sd-card">
            <div className="sd-lab">The real prize — your year</div>
            <p className="sd-p">
              Each job ties up your money for {m.cycleNow} days — {deliver} working,{" "}
              {days} waiting to be paid. Get paid on day one and the waiting disappears:
              the same money starts the next job straight away.
            </p>
            <div className="sd-grid2">
              <Ctl
                label="How long a job takes (days)"
                hint="Order to delivery. The rest of the cycle is just waiting"
                value={deliver}
                onChange={setDeliver}
                min={1}
                max={120}
                step={1}
              />
            </div>
            <div className="sd-rows">
              <div className="sd-turn-r">
                <div className="lab">
                  As you are now
                  <span>{m.cycleNow}-day cycle</span>
                </div>
                <div className="num">{m.turnsNow.toFixed(1)} jobs/yr</div>
                <div className="rev">{n0(m.revNow)}</div>
              </div>
              <div className="sd-turn-r">
                <div className="lab">
                  Paid on day one
                  <span>{deliver}-day cycle</span>
                </div>
                <div className="num">{m.turnsNew.toFixed(1)} jobs/yr</div>
                <div className="rev">{n0(m.revNew)}</div>
              </div>
              <div className="sd-turn-r gain">
                <div className="lab">
                  Extra revenue capacity
                  <span>Same money. Nothing borrowed.</span>
                </div>
                <div className="num">+{(m.turnsNew - m.turnsNow).toFixed(1)}</div>
                <div className="rev">+{n0(m.revGain)}</div>
              </div>
            </div>
            <p className="sd-p" style={{ marginTop: 12 }}>
              <b>{m.multiple.toFixed(1)}× the revenue off the same pot.</b> You still have
              to win the work — but the money is no longer what's stopping you.
            </p>
          </div>

          <div className="sd-cta">
            <a className="sd-btn" href="https://stabledrop.me/merchant">
              Find out more
            </a>
            <button className="sd-btn ghost" onClick={exportXlsx}>
              Export to Excel
            </button>
          </div>

          <div className="sd-foot">
            The discount is {m.pct.toFixed(2)}% of your invoice — a trade discount, not
            interest. Nothing is invested; the escrow can always pay out in full.
            Stabledrop's fee is a flat {FEE_PCT.toFixed(0)}% of the escrowed amount.
            Borrowing comparison based on iwoca published rates (from 1.5%/month;
            representative 40% APR). Simple interest, actual/365. Estimates, not financial
            advice.
            <br />© 2026 Conduit UCPI. Secure escrow contracts on blockchain. Company No.
            880319.
          </div>
        </div>
      </div>
    </>
  );
}
