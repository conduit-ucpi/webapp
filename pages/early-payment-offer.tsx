import { useState, useEffect, useMemo } from "react";
import SEO from "@/components/SEO";

/* ==================================================================
   Stabledrop — /early-payment-offer

   The customer funds an escrow up front. A funder buys the right to
   be repaid first out of that escrow, capped below its value, so the
   seller keeps a residual tail and absorbs the first loss on any
   dispute. That subordination is what buys the tighter senior rate.

   The spread is measured BEFORE the discount exists, then split with
   the customer — otherwise the discount pays for itself and the
   arithmetic goes circular.
   ================================================================== */

const FEE = 0.01; // Stabledrop, flat, taken once on the escrowed amount

interface Profile {
  cap: number;
  rate: number;
  label: string;
  note: string;
}

const PROFILES: Profile[] = [
  { cap: 86, rate: 22, label: "First deal", note: "repaid to 86% · 22%/yr" },
  { cap: 90, rate: 15, label: "You take first loss", note: "repaid to 90% · 15%/yr" },
  { cap: 93, rate: 7, label: "Proven book", note: "repaid to 93% · 7%/yr" },
];

const AMOUNT_CHIPS = [
  { amt: 50000, label: "50k" },
  { amt: 100000, label: "100k" },
  { amt: 250000, label: "250k" },
  { amt: 1000000, label: "1m" },
];

const DISPUTE_STEPS = [0, 5, 10, 15, 20, 30, 50, 100];

const money = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const pct = (n: number, d = 1) => n.toFixed(d) + "%";

interface Inputs {
  F: number;
  t: number;
  cap: number;
  r: number;
  bad: number;
  borrow: number;
  rf: number;
  share: number;
  job: number;
}

function model(v: Inputs) {
  const yf = v.t / 365;

  // Spread is measured before the discount exists, then split with the customer.
  const netFull = v.F * (1 - FEE);
  const seniorFull = v.cap * netFull;
  const keepFull = netFull - seniorFull * v.r * yf;
  const borrowAlt = v.F - v.F * v.borrow * yf;
  const spread = keepFull + v.bad * v.F - borrowAlt;

  const buyerEarns = v.F * v.rf * yf;
  const discount = Math.max(0, v.share * spread) + buyerEarns;

  const escrow = v.F - discount;
  const fee = escrow * FEE;
  const net = escrow - fee;
  const senior = v.cap * net;
  const cut = senior * v.r * yf;
  const cash = senior - cut;
  const res = net - senior;
  const total = cash + res;

  const cycleOld = v.job + v.t;
  const cycleNew = v.job;
  const jobsOld = 365 / cycleOld;
  const jobsNew = 365 / cycleNew;
  const revOld = jobsOld * v.F * (1 - v.bad);
  const revNew = jobsNew * total;

  return {
    v,
    spread,
    discount,
    escrow,
    fee,
    net,
    senior,
    cut,
    cash,
    res,
    total,
    borrowAlt,
    ahead: total - borrowAlt,
    buyerEarns,
    buyerGain: discount - buyerEarns,
    buyerApr: escrow > 0 ? (discount / escrow) * (365 / v.t) : 0,
    firstLoss: net > 0 ? res / net : 0,
    second: net > 0 ? cut / net : 0,
    cycleOld,
    cycleNew,
    jobsOld,
    jobsNew,
    revOld,
    revNew,
    extra: revNew - revOld,
    mult: revOld > 0 ? revNew / revOld : 0,
    workable: spread > 0,
  };
}

type Model = ReturnType<typeof model>;

/* One year of jobs. Each block is a cycle; the green part is the work,
   the hatched part is time spent waiting to be paid. */
function YearRow({ cycle, work }: { cycle: number; work: number }) {
  const n = Math.ceil(365 / cycle);
  const w = (cycle / 365) * 100;
  const wp = Math.min(1, work / cycle) * 100;
  return (
    <div className="year">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="blk" style={{ width: w + "%" }}>
          <i className="work" style={{ width: wp + "%" }} />
          <i className="wait" style={{ width: 100 - wp + "%" }} />
        </div>
      ))}
    </div>
  );
}

function buildMessage(m: Model, cust: string, sign: string, when: string) {
  const v = m.v;
  const who = cust.trim() || "[customer name]";
  const from = sign.trim() || "[your name]";
  return (
    `Hi ${who},\n\n` +
    `A proposal on our ${money(v.F)} invoice, due ${when}.\n\n` +
    `As things stand, paying at the end of the terms is the sensible move for you: holding the cash for ${v.t} days earns you roughly ${money(m.buyerEarns)}.\n\n` +
    `We'd like to beat that. Fund the invoice into escrow today and we'll take ${money(m.discount)} off — you pay ${money(m.escrow)} instead of ${money(v.F)}. Over the same period that's worth about ${pct(m.buyerApr * 100)} a year on the cash, so you're better off than holding it.\n\n` +
    `The money doesn't come to us. It sits locked in a Stabledrop escrow until ${when} — the day you'd have paid anyway — and only releases to us then if we've delivered. If we haven't, you get it back. Buyer protection and dispute handling are built in.\n\n` +
    `Paying this way genuinely helps us: it guarantees payment on time and lets us put the capital to work on your next order rather than waiting on this one.\n\n` +
    `Happy to walk through the numbers.\n\n${from}`
  );
}

export default function EarlyPaymentOffer() {
  const [amount, setAmount] = useState("100000");
  const [terms, setTerms] = useState(60);
  const [cap, setCap] = useState(90);
  const [rate, setRate] = useState(15);
  const [bad, setBad] = useState(2);
  const [borrow, setBorrow] = useState(30);
  const [rf, setRf] = useState(3.65);
  const [share, setShare] = useState(25);
  const [job, setJob] = useState(30);
  const [cust, setCust] = useState("");
  const [sign, setSign] = useState("");
  const [copied, setCopied] = useState<"idle" | "done" | "manual">("idle");

  /* Rendered on the client only. new Date() on the server and again in the
     browser can straddle a day boundary, and every date on the page would
     then be a hydration mismatch. The markup ships with the same em-dash
     placeholders the design already uses. */
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const v: Inputs = useMemo(
    () => ({
      F: Math.max(1000, Number(amount) || 0),
      t: terms,
      cap: cap / 100,
      r: rate / 100,
      bad: bad / 100,
      borrow: borrow / 100,
      rf: rf / 100,
      share: share / 100,
      job,
    }),
    [amount, terms, cap, rate, bad, borrow, rf, share, job]
  );

  const m = useMemo(() => model(v), [v]);

  const when = useMemo(() => {
    if (!today) return "—";
    const d = new Date(today);
    d.setDate(d.getDate() + terms);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }, [today, terms]);

  const message = useMemo(() => buildMessage(m, cust, sign, when), [m, cust, sign, when]);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("done");
      setTimeout(() => setCopied("idle"), 1800);
    } catch {
      setCopied("manual");
    }
  }

  function applyProfile(p: Profile) {
    setCap(p.cap);
    setRate(p.rate);
  }

  const disputeRows = DISPUTE_STEPS.map((step) => {
    const refund = m.net * (step / 100);
    const tail = Math.max(0, m.res - refund);
    const recovers = Math.max(0, m.senior - Math.max(0, refund - m.res));
    const funder = recovers - m.cash;
    return { step, funder, tail, keep: m.cash + tail };
  });

  return (
    <>
      <SEO
        title="Get paid on day one — Stabledrop"
        description="Your customer pays into escrow up front. You sell most of it for cash the same day and keep the tail. No borrowing, no personal guarantee. Model the numbers on your own invoice."
      />

      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap');

.epo{
  --bg:#000000; --card:#0A0A0A; --card2:#060606;
  --line:#1C1F1C; --line2:#2A2E2A;
  --ink:#FFFFFF; --soft:#9DA69F; --faint:#6E766F;
  --green:#4ADE80; --green-dim:#2E8F55; --green-bg:rgba(74,222,128,.09);
  --gold:#C9A227; --gold-bg:rgba(201,162,39,.12);
  --track:#232623; --r:12px; --pad:clamp(18px,4vw,32px);
  --mono:"Geist Mono","Roboto Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;

  background:var(--bg); color:var(--ink);
  font-family:var(--mono); font-size:16px; line-height:1.75; font-weight:400;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
.epo *{box-sizing:border-box}
.epo .wrap{max-width:900px;margin:0 auto;padding:0 clamp(16px,5vw,32px) 90px}
.epo h1,.epo h2,.epo h3{font-family:var(--mono);font-weight:700;letter-spacing:-.01em;line-height:1.2;margin:0}
.epo h1{font-size:clamp(30px,6.2vw,46px);line-height:1.22}
.epo h1 .alt{color:var(--green);display:block}
.epo h2{font-size:clamp(21px,3.6vw,29px);line-height:1.35}
.epo h3{font-size:17px}
.epo p{margin:.85em 0;color:var(--soft)}
.epo p b,.epo li b{color:var(--ink);font-weight:700}
.epo a{color:var(--green);text-decoration:none;border-bottom:1px solid rgba(74,222,128,.35)}
.epo a:hover{border-bottom-color:var(--green)}
.epo .num{font-variant-numeric:tabular-nums}

.epo header.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:26px 0 46px;flex-wrap:wrap}
.epo .brand{font-size:14px;letter-spacing:.06em;color:var(--soft);border:0}
.epo .brand span{color:var(--faint)}
.epo .brand:hover{color:var(--green)}
.epo .eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}

.epo .hero{padding-bottom:36px}
.epo .hero h1{max-width:18ch}
.epo .hero .lede{font-size:clamp(15px,2.1vw,17px);color:var(--soft);max-width:66ch;margin-top:24px;line-height:1.8}
.epo .hero .lede b{color:var(--ink);font-weight:400}

.epo .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:var(--pad)}
.epo section{margin-top:52px}
.epo .stepno{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:14px}
.epo section > .stepno{padding-left:2px}

.epo .controls{display:grid;gap:34px}
.epo .field label,.epo .legend{display:block;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);font-weight:400}
.epo .rangehead{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px}
.epo .rangeval{font-size:19px;font-weight:700;color:var(--ink);white-space:nowrap}
.epo .hint{font-size:13.5px;color:var(--faint);margin:12px 0 0;line-height:1.65}
.epo .hint b{color:var(--soft);font-weight:400}

.epo .amountrow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.epo .amountbox{display:flex;align-items:center;gap:4px;border:1px solid var(--line2);border-radius:6px;padding:8px 16px;background:var(--card2)}
.epo .amountbox span{color:var(--green-dim);font-size:20px}
.epo .amountbox:focus-within{border-color:var(--green)}
.epo input[type=number]{
  font-family:var(--mono);font-size:24px;font-weight:700;letter-spacing:-.01em;text-align:right;
  border:0;outline:0;width:8ch;padding:0;background:transparent;color:var(--green);
  font-variant-numeric:tabular-nums;-moz-appearance:textfield;
}
.epo input[type=number]::-webkit-outer-spin-button,.epo input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.epo .chips{display:flex;gap:8px;flex-wrap:wrap}
.epo .chip{font-family:var(--mono);font-size:12px;letter-spacing:.08em;cursor:pointer;background:transparent;border:1px solid var(--line2);border-radius:99px;padding:5px 13px;color:var(--faint)}
.epo .chip:hover{border-color:var(--green);color:var(--green)}

.epo input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;background:transparent;cursor:pointer;margin:0}
.epo input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--track);border-radius:2px}
.epo input[type=range]::-moz-range-track{height:2px;background:var(--track);border-radius:2px}
.epo input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:var(--green);margin-top:-6.5px;border:0;box-shadow:0 0 12px rgba(74,222,128,.55)}
.epo input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:var(--green);border:0;box-shadow:0 0 12px rgba(74,222,128,.55)}

.epo .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.epo .seg button{font-family:var(--mono);text-align:left;cursor:pointer;background:var(--card2);color:var(--soft);border:1px solid var(--line2);border-radius:8px;padding:14px;line-height:1.4}
.epo .seg button strong{display:block;font-size:13.5px;font-weight:700;color:var(--ink)}
.epo .seg button em{display:block;font-style:normal;font-size:11.5px;color:var(--faint);margin-top:5px;letter-spacing:.04em}
.epo .seg button:hover{border-color:var(--green-dim)}
.epo .seg button[aria-pressed=true]{border-color:var(--green);background:var(--green-bg)}
.epo .seg button[aria-pressed=true] strong{color:var(--green)}
.epo .seg button[aria-pressed=true] em{color:var(--soft)}

.epo .answers{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:38px;padding-top:32px;border-top:1px solid var(--line)}
.epo .answers .k{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);display:block}
.epo .answers .k b{color:var(--faint);font-weight:400}
.epo .answers .v{font-weight:700;font-size:clamp(25px,4.4vw,34px);letter-spacing:-.02em;margin-top:10px;display:block;font-variant-numeric:tabular-nums;line-height:1.1}
.epo .answers .s{font-size:12.5px;color:var(--faint);margin-top:8px;display:block}
.epo .answers .lead .v,.epo .answers .grow .v{color:var(--green)}

.epo .ledger{margin-top:30px;border-top:1px solid var(--line)}
.epo .ledger > div{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:14px 0;border-bottom:1px solid var(--line);font-size:15px}
.epo .ledger > div span:first-child{color:var(--soft)}
.epo .ledger > div span:last-child{font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--ink)}
.epo .ledger .total span:first-child{color:var(--ink)}
.epo .ledger .total span:last-child{font-weight:700;font-size:18px}
.epo .ledger .out span:last-child{color:var(--gold)}
.epo .ledger .in span:last-child{color:var(--green)}
.epo .sub{font-size:12px;color:var(--faint);display:block;font-weight:400}

.epo .year{display:flex;gap:3px;height:26px;margin-top:10px}
.epo .year .blk{display:flex;height:100%;border-radius:2px;overflow:hidden;min-width:2px}
.epo .year i{display:block;height:100%}
.epo .work{background:var(--green);opacity:.85}
.epo .wait{background:repeating-linear-gradient(135deg,rgba(201,162,39,.22) 0 4px,rgba(201,162,39,.06) 4px 9px)}
.epo .yearrow{margin-bottom:24px}
.epo .yearrow .cap{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);gap:12px}
.epo .yearrow .cap b{color:var(--ink);font-weight:700;letter-spacing:0}
.epo .key{display:flex;gap:22px;font-size:12px;color:var(--faint);letter-spacing:.08em;text-transform:uppercase;margin-top:4px}
.epo .key span{display:flex;align-items:center;gap:8px}
.epo .key i{width:12px;height:12px;border-radius:2px;display:block}

.epo details{border-top:1px solid var(--line);margin-top:26px}
.epo details summary{cursor:pointer;list-style:none;padding:16px 0;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);display:flex;justify-content:space-between;align-items:center;gap:12px}
.epo details summary:hover{color:var(--green)}
.epo details summary::-webkit-details-marker{display:none}
.epo details summary::after{content:"+";color:var(--faint);font-size:17px}
.epo details[open] summary::after{content:"–"}
.epo details .body{padding-bottom:24px}
.epo .mini{display:grid;gap:30px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:8px}
.epo .mini .rangehead{margin-bottom:12px}
.epo .mini .rangeval{font-size:16px}

.epo .tablewrap{overflow-x:auto;margin-top:18px}
.epo table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:420px}
.epo th,.epo td{text-align:right;padding:10px 8px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.epo th:first-child,.epo td:first-child{text-align:left}
.epo th{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);font-weight:400}
.epo td{color:var(--soft)}
.epo td.neg{color:var(--gold)}
.epo td.pos{color:var(--green)}

.epo .msgfields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0 18px}
.epo input[type=text]{font-family:var(--mono);font-size:14px;padding:12px 14px;border:1px solid var(--line2);border-radius:6px;width:100%;background:var(--card2);color:var(--ink)}
.epo input[type=text]::placeholder{color:var(--faint)}
.epo input[type=text]:focus{outline:0;border-color:var(--green)}
.epo pre.msg{font-family:var(--mono);font-size:14px;line-height:1.85;white-space:pre-wrap;color:var(--soft);background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:24px;margin:0}
.epo .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.epo .btn{font-family:var(--mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;cursor:pointer;background:var(--green);color:#000;border:1px solid var(--green);border-radius:6px;padding:13px 22px;display:inline-block}
.epo .btn:hover{background:#6BE99A;border-color:#6BE99A}
.epo .btn.ghost{background:transparent;color:var(--green);border-color:var(--line2)}
.epo .btn.ghost:hover{border-color:var(--green);background:var(--green-bg);color:var(--green)}
.epo a.btn{border-bottom:1px solid var(--line2)}
.epo a.btn:hover{border-bottom-color:var(--green)}

.epo .warn{background:var(--gold-bg);border:1px solid rgba(201,162,39,.35);border-radius:8px;padding:16px 18px;font-size:14px;color:var(--soft);margin-top:26px}
.epo footer{margin-top:64px;padding-top:28px;border-top:1px solid var(--line);font-size:12px;color:var(--faint);line-height:1.85}
.epo footer a{color:var(--faint);border-bottom-color:var(--line2)}
.epo footer a:hover{color:var(--green)}
.epo :focus-visible{outline:2px solid var(--green);outline-offset:3px;border-radius:2px}

@media (max-width:700px){
  .epo{font-size:15px}
  .epo .answers,.epo .seg,.epo .mini,.epo .msgfields{grid-template-columns:1fr}
  .epo .answers{gap:24px}
  .epo .amountrow{align-items:flex-start}
}
@media (prefers-reduced-motion:no-preference){
  .epo .year .blk,.epo .year i{transition:width .35s ease}
}
      `}</style>

      <div className="epo">
        <div className="wrap">
          <header className="top">
            <a className="brand" href="/">
              Stabledrop <span>· Conduit UCPI</span>
            </a>
            <span className="eyebrow">Early payment</span>
          </header>

          <div className="hero">
            <h1>
              Get paid on day one
              <span className="alt">
                not day <span className="num">{terms}</span>.
              </span>
            </h1>
            <p className="lede">
              Your customer pays into escrow when they place the order. You sell most of that
              escrow for cash the same day and keep the tail.{" "}
              <b>Nothing borrowed. No personal guarantee. Nobody chasing.</b>
            </p>
          </div>

          {/* ============ INPUTS ============ */}
          <section>
            <div className="card">
              <div className="controls">
                <div className="field">
                  <div className="amountrow">
                    <label htmlFor="amount">What&apos;s the invoice?</label>
                    <div className="amountbox">
                      <span>£</span>
                      <input
                        type="number"
                        id="amount"
                        value={amount}
                        min={1000}
                        step={1000}
                        inputMode="numeric"
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="chips">
                    {AMOUNT_CHIPS.map((c) => (
                      <button
                        key={c.amt}
                        type="button"
                        className="chip"
                        onClick={() => setAmount(String(c.amt))}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {v.F < 250000 && (
                    <p className="hint">
                      Under £250k no manual funding desk will quote — underwriting one deal costs
                      more than the spread on it. That&apos;s why this has to be programmatic.
                    </p>
                  )}
                </div>

                <div className="field">
                  <div className="rangehead">
                    <label htmlFor="terms">How long do they take to pay?</label>
                    <span className="rangeval">{terms} days</span>
                  </div>
                  <input
                    type="range"
                    id="terms"
                    min={7}
                    max={120}
                    step={1}
                    value={terms}
                    onChange={(e) => setTerms(Number(e.target.value))}
                  />
                  <p className="hint">
                    Due <b>{when}</b>.
                  </p>
                </div>

                <div className="field">
                  <span className="legend">What a funder charges you</span>
                  <div className="seg">
                    {PROFILES.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={cap === p.cap && rate === p.rate}
                        onClick={() => applyProfile(p)}
                      >
                        <strong>{p.label}</strong>
                        <em>{p.note}</em>
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    Standing behind the funder for the first slice of any dispute is what buys you
                    the tighter rate. It&apos;s how the first deal gets done.
                  </p>
                </div>
              </div>

              <details>
                <summary>Change the assumptions</summary>
                <div className="body">
                  <div className="mini">
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="borrow">What borrowing costs you now</label>
                        <span className="rangeval">{pct(borrow, 0)}</span>
                      </div>
                      <input type="range" id="borrow" min={6} max={50} step={0.5} value={borrow}
                        onChange={(e) => setBorrow(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="bad">What bad payers cost you</label>
                        <span className="rangeval">{pct(bad)}</span>
                      </div>
                      <input type="range" id="bad" min={0} max={6} step={0.1} value={bad}
                        onChange={(e) => setBad(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="rf">What your customer&apos;s cash earns</label>
                        <span className="rangeval">{pct(rf, 2)}</span>
                      </div>
                      <input type="range" id="rf" min={0} max={8} step={0.05} value={rf}
                        onChange={(e) => setRf(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="share">Your customer&apos;s cut of the saving</label>
                        <span className="rangeval">{pct(share, 0)}</span>
                      </div>
                      <input type="range" id="share" min={0} max={80} step={5} value={share}
                        onChange={(e) => setShare(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="job">How long a job takes</label>
                        <span className="rangeval">{job} days</span>
                      </div>
                      <input type="range" id="job" min={1} max={120} step={1} value={job}
                        onChange={(e) => setJob(Number(e.target.value))} />
                    </div>
                    <div className="field">
                      <div className="rangehead">
                        <label htmlFor="cap">Funder repaid up to</label>
                        <span className="rangeval">{pct(cap, 0)}</span>
                      </div>
                      <input type="range" id="cap" min={80} max={97} step={0.5} value={cap}
                        onChange={(e) => setCap(Number(e.target.value))} />
                      <div className="rangehead" style={{ marginTop: 14 }}>
                        <label htmlFor="rate">Funder&apos;s rate</label>
                        <span className="rangeval">{pct(rate, 2)}</span>
                      </div>
                      <input type="range" id="rate" min={3.65} max={35} step={0.25} value={rate}
                        onChange={(e) => setRate(Number(e.target.value))} />
                    </div>
                  </div>
                  <p className="hint">
                    Stabledrop&apos;s fee is fixed at 1% of the escrow. Everything else here is
                    yours to argue about.
                  </p>
                </div>
              </details>
            </div>

            <div className="answers">
              <div className="lead">
                <span className="k">In your account today</span>
                <span className="v num">{money(m.cash)}</span>
                <span className="s">{pct((m.cash / v.F) * 100)} of face, day one</span>
              </div>
              <div>
                <span className="k">
                  The rest, on <b>{when}</b>
                </span>
                <span className="v num">{money(m.res)}</span>
                <span className="s">if undisputed</span>
              </div>
              <div className="grow">
                <span className="k">Extra revenue a year</span>
                <span className="v num">
                  {(m.extra >= 0 ? "+" : "−") + money(Math.abs(m.extra))}
                </span>
                <span className="s">same money, nothing borrowed</span>
              </div>
            </div>

            {!m.workable && (
              <div className="warn">
                At these numbers there&apos;s nothing to share. The funder&apos;s charge is more
                than what waiting costs your customer, so no discount makes both of you better
                off. Lower the funder&apos;s rate or check what borrowing really costs you.
              </div>
            )}
          </section>

          {/* ============ STEP 1 ============ */}
          <section className="card">
            <span className="stepno">Step one — the money is locked before you start</span>
            <h2>
              Your customer pays <span className="num">{money(m.escrow)}</span> into escrow up front
            </h2>
            <p>
              It leaves their account and sits locked. On <b>{when}</b> — the day they&apos;d have
              paid you anyway — it releases automatically. No invoice, no chasing, no ageing
              debtor. If you don&apos;t deliver, they get it back.
            </p>
            <div className="ledger">
              <div>
                <span>Locked in escrow today</span>
                <span>{money(m.escrow)}</span>
              </div>
              <div className="out">
                <span>
                  Stabledrop&apos;s fee <span className="sub">flat 1%, taken once</span>
                </span>
                <span>− {money(m.fee)}</span>
              </div>
              <div className="total">
                <span>Yours on release, guaranteed</span>
                <span>{money(m.net)}</span>
              </div>
              <div>
                <span>Bad debt you stop carrying</span>
                <span>≈ {money(v.bad * v.F)} an invoice</span>
              </div>
            </div>
          </section>

          {/* ============ STEP 2 ============ */}
          <section className="card">
            <span className="stepno">Step two — you don&apos;t wait for it</span>
            <h2>
              Sell the escrow for <span className="num">{money(m.cash)}</span> today
            </h2>
            <p>
              A funder buys the right to be repaid first out of your escrow, up to a cap.
              What&apos;s left over is yours when the escrow releases. Because the money is already
              locked in, the funder isn&apos;t betting on whether your customer pays — and prices
              accordingly: <b><span className="num">{pct(rate, 2)}</span></b> against the{" "}
              <b><span className="num">{pct(borrow, 0)}</span></b> you&apos;d pay to borrow.
            </p>
            <p>
              There&apos;s no loan here, so there&apos;s nothing to secure against your house, and
              nothing to claw back if the deal later sours.
            </p>
            <div className="ledger">
              <div>
                <span>Your escrow, after the fee</span>
                <span>{money(m.net)}</span>
              </div>
              <div>
                <span>
                  Funder repaid first, up to <span className="num">{pct(cap, 0)}</span>
                </span>
                <span>{money(m.senior)}</span>
              </div>
              <div className="out">
                <span>
                  Funder&apos;s charge <span className="sub">over <span className="num">{terms}</span> days</span>
                </span>
                <span>− {money(m.cut)}</span>
              </div>
              <div className="total in">
                <span>In your account today</span>
                <span>{money(m.cash)}</span>
              </div>
              <div className="total">
                <span>
                  The rest, on <b>{when}</b>
                </span>
                <span>{money(m.res)}</span>
              </div>
            </div>

            <details>
              <summary>What happens if there&apos;s a dispute?</summary>
              <div className="body">
                <p>
                  Your tail absorbs the first{" "}
                  <b><span className="num">{pct(m.firstLoss * 100)}</span></b> of any refund. The
                  funder&apos;s charge covers another{" "}
                  <b><span className="num">{pct(m.second * 100)}</span></b>, because it advanced
                  less than its cap. Past{" "}
                  <b><span className="num">{pct((m.firstLoss + m.second) * 100)}</span></b> the
                  funder is out of pocket — which is why a refund percentage is set by a registered
                  arbitrator, not by either side.
                </p>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Refund</th>
                        <th>Funder</th>
                        <th>Your tail</th>
                        <th>You keep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputeRows.map((row) => (
                        <tr key={row.step}>
                          <td>{row.step}%</td>
                          <td className={row.funder < 0 ? "neg" : "pos"}>
                            {(row.funder < 0 ? "− " : "+ ") + money(Math.abs(row.funder))}
                          </td>
                          <td>{money(row.tail)}</td>
                          <td>{money(row.keep)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint">Money already advanced to you isn&apos;t clawed back.</p>
              </div>
            </details>
          </section>

          {/* ============ STEP 3 ============ */}
          <section className="card">
            <span className="stepno">Step three — why they say yes</span>
            <h2>
              Take <span className="num">{money(m.discount)}</span> off their bill
            </h2>
            <p>
              Sitting on your money for <span className="num">{terms}</span> days earns them{" "}
              <span className="num">{money(m.buyerEarns)}</span>. That&apos;s the whole reason
              invoices get paid late. Beat it, and paying today is simply the better trade — and
              they get buyer protection thrown in for nothing.
            </p>
            <div className="ledger">
              <div className="in">
                <span>Discount off their bill</span>
                <span>− {money(m.discount)}</span>
              </div>
              <div>
                <span>What they&apos;d have earned by waiting</span>
                <span>{money(m.buyerEarns)}</span>
              </div>
              <div className="total">
                <span>
                  They&apos;re better off by{" "}
                  <span className="sub">
                    worth <span className="num">{pct(m.buyerApr * 100)}</span> a year on the cash
                  </span>
                </span>
                <span>+ {money(m.buyerGain)}</span>
              </div>
            </div>
          </section>

          {/* ============ WATERFALL ============ */}
          <section className="card">
            <span className="stepno">All of it together</span>
            <h2>
              You end up with <span className="num">{money(m.total)}</span>
            </h2>
            <div className="ledger">
              <div>
                <span>Your invoice</span>
                <span>{money(v.F)}</span>
              </div>
              <div className="out">
                <span>Customer&apos;s discount</span>
                <span>− {money(m.discount)}</span>
              </div>
              <div className="out">
                <span>Stabledrop&apos;s fee</span>
                <span>− {money(m.fee)}</span>
              </div>
              <div className="out">
                <span>Funder&apos;s charge</span>
                <span>− {money(m.cut)}</span>
              </div>
              <div className="in">
                <span>In your account today</span>
                <span>{money(m.cash)}</span>
              </div>
              <div>
                <span>
                  The rest, on <b>{when}</b>
                </span>
                <span>+ {money(m.res)}</span>
              </div>
              <div className="total">
                <span>You end up with</span>
                <span>{money(m.total)}</span>
              </div>
              <div>
                <span>
                  The old way: borrow at <span className="num">{pct(borrow, 0)}</span>{" "}
                  <span className="sub">plus a personal guarantee</span>
                </span>
                <span>{money(m.borrowAlt)}</span>
              </div>
              <div className="total">
                <span>{m.ahead >= 0 ? "You're ahead by" : "You're behind by"}</span>
                <span>{(m.ahead >= 0 ? "+ " : "− ") + money(Math.abs(m.ahead))}</span>
              </div>
            </div>
            <p>
              You&apos;re up, your customer&apos;s up, and the bad debt has gone. Nobody paid for
              that — it&apos;s what taking the credit risk <b>out</b> of the deal is worth.
            </p>
          </section>

          {/* ============ THE YEAR ============ */}
          <section className="card">
            <span className="stepno">The real prize</span>
            <h2>
              <span className="num">{m.mult.toFixed(1)}×</span> the revenue off the same pot of
              money
            </h2>
            <p>
              Every job ties up your cash for <span className="num">{m.cycleOld}</span> days:{" "}
              <span className="num">{job}</span> doing the work, then{" "}
              <span className="num">{terms}</span> just waiting to be paid. Get paid on day one and
              the waiting disappears. The same money starts the next job immediately.
            </p>

            <div style={{ marginTop: 26 }}>
              <div className="yearrow">
                <div className="cap">
                  <span>
                    As you are now — <b>{m.cycleOld}</b> day cycle
                  </span>
                  <span>
                    <b>{m.jobsOld.toFixed(1)}</b> jobs
                  </span>
                </div>
                <YearRow cycle={m.cycleOld} work={job} />
              </div>
              <div className="yearrow">
                <div className="cap">
                  <span>
                    Paid on day one — <b>{m.cycleNew}</b> day cycle
                  </span>
                  <span>
                    <b>{m.jobsNew.toFixed(1)}</b> jobs
                  </span>
                </div>
                <YearRow cycle={m.cycleNew} work={job} />
              </div>
              <div className="key">
                <span>
                  <i className="work" />
                  working
                </span>
                <span>
                  <i className="wait" />
                  waiting to be paid
                </span>
              </div>
            </div>

            <div className="ledger">
              <div>
                <span>Revenue as you are now</span>
                <span>{money(m.revOld)}</span>
              </div>
              <div>
                <span>Revenue paid on day one</span>
                <span>{money(m.revNew)}</span>
              </div>
              <div className="total in">
                <span>
                  Extra capacity a year{" "}
                  <span className="sub">same money, nothing borrowed</span>
                </span>
                <span>{(m.extra >= 0 ? "+ " : "− ") + money(Math.abs(m.extra))}</span>
              </div>
            </div>
            <p>You still have to win the work. But money is no longer the thing stopping you.</p>
          </section>

          {/* ============ MESSAGE ============ */}
          <section className="card">
            <span className="stepno">Send it to them</span>
            <h2>The message that makes the ask</h2>
            <p>
              Built from your numbers. It updates as you change them — copy it into an email or
              WhatsApp and edit freely.
            </p>
            <div className="msgfields">
              <div>
                <input
                  type="text"
                  placeholder="Your customer's name"
                  value={cust}
                  onChange={(e) => setCust(e.target.value)}
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Sign off as"
                  value={sign}
                  onChange={(e) => setSign(e.target.value)}
                />
              </div>
            </div>
            <pre className="msg">{message}</pre>
            <div className="actions">
              <button type="button" className="btn" onClick={copyMessage}>
                {copied === "done"
                  ? "Copied"
                  : copied === "manual"
                    ? "Select and copy manually"
                    : "Copy message"}
              </button>
              <a className="btn ghost" href="/merchant">
                Find out more
              </a>
            </div>
          </section>

          <footer>
            <p>
              The discount is a trade discount, not interest. Nothing is invested — the escrow can
              always pay out in full. Stabledrop&apos;s fee is a flat 1% of the escrowed amount.
              The funder, not Stabledrop, sets the repayment cap and the rate; your tail is
              whatever the cap leaves and is paid after the funder. Rate bands are indicative of
              comparable short-dated collateralised trade paper, not quotes. Nothing prices below
              the risk-free floor of 3.65% (SOFR, 28 Jul 2026; use SONIA for sterling). Borrowing
              comparison based on iwoca published rates — from 1.5% a month, representative 40%
              APR. Simple interest, actual/365. Estimates, not financial advice.
            </p>
            <p>
              © 2026 Conduit UCPI. Secure escrow contracts on blockchain. Company No. SC880319.
              <br />
              <a href="/terms-of-service">Terms of Service</a> ·{" "}
              <a href="/privacy-policy">Privacy Policy</a> ·{" "}
              <a href="mailto:info@conduit-ucpi.com">Contact</a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
