#!/usr/bin/env node
/*
 * scenario.js — supplier requests -> customer pays -> LP offers -> supplier accepts.
 *
 *   node scenario.js                    # whole scenario
 *   node scenario.js --minutes 60       # contract maturity offset (default 60)
 *   node scenario.js supplier customer  # selected phases: supplier|customer|lp|accept
 *
 * ⚠️ UI ONLY. Every step here is a click, a typed value, or a wait on rendered text. Nothing
 *    calls the app's HTTP API, reads its caches, or inspects the chain — because a harness that
 *    reaches past the UI stops testing the thing users actually use, and will happily report a
 *    flow as working while the screen a customer sees is broken. Where the UI needs a nudge to
 *    refresh, press its own "Check for updates" control rather than POSTing the reconcile.
 *
 * Sessions: one browser per role (9222 customer / 9223 supplier / 9224 lp), each permanently
 * logged in, so no phase logs in or out. Falls back to a single browser on 9222 if the other
 * two are not listening, switching MetaMask accounts between phases.
 */
const fs = require('fs');
const path = require('path');
const { Driver, livePorts, sleep, APP_URL } = require('./drive.js');

const LINK_FILE = path.join(__dirname, 'last-link.txt');
const STATE_FILE = path.join(__dirname, 'last-run.json');

/*
 * ⚠️ THE PHASES ARE A CHAIN, AND A PHASE RUN OUT OF TURN PROVES NOTHING. There is no point
 *    looking for a cashflow to buy before the customer has paid for it, and none in accepting
 *    before an offer has been funded — but both LOOK like ordinary failures when run early, and
 *    worse, the LP phase will happily offer on some OTHER escrow left over from an earlier run
 *    and report success about a contract nobody asked about. So each phase records what it
 *    achieved, and the later ones refuse to start until their predecessor did.
 */
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const writeState = (patch) => fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));
const requireState = (key, contractId, whatIsMissing, howToFix) => {
  const st = readState();
  if (st.contractId !== contractId || !st[key]) {
    throw new Error(whatIsMissing + ' — ' + howToFix +
      '  [run state: contractId=' + (st.contractId || 'none') + ', paid=' + !!st.paid + ', offerFunded=' + !!st.offerFunded + ']');
  }
};
const ADDR = {
  customer: '0xe91a3875e8049dcc25bbea793e41b44c0038398d',
  supplier: '0x32ecf447618107f3bf7ad58a374cdadaeface0e2',
  lp:       '0xa21ab94ae421ce2880376739b53fba938e5af8e5',
};
/**
 * One browser per role. Override with E2E_PORT_CUSTOMER / _SUPPLIER / _LP if the debug ports
 * differ; the defaults match the documented launch commands.
 */
const PORTS = {
  customer: Number(process.env.E2E_PORT_CUSTOMER || 9222),
  supplier: Number(process.env.E2E_PORT_SUPPLIER || 9223),
  lp: Number(process.env.E2E_PORT_LP || 9224),
};

const argv = process.argv.slice(2);
const mi = argv.indexOf('--minutes');
const minutes = mi >= 0 ? Number(argv[mi + 1]) : 60;
const phases = argv.filter((a, i) => !a.startsWith('--') && !(mi >= 0 && i === mi + 1));
const want = p => phases.length === 0 || phases.includes(p);

// Connect entry points differ by screen: dashboard/create show "Advanced wallet connection"
// directly, /liquidity shows "Get Started" first. Both are optional so either route works.
// Connect entry points differ by screen. /dashboard and /create show "Advanced wallet
// connection" as an intermediate choice; /liquidity's "Get Started" opens the AppKit wallet
// picker directly. Both intermediate steps are optional so either route reaches MetaMask.
const CONNECT = ['click?:Get Started', 'click?:Advanced wallet connection', 'click:MetaMask', 'mm?:Connect', 'mm?:Confirm,Sign'];
const LOGOUT = ['click:Open menu', 'click:Logout'];

let MULTI = false;
const drivers = {};
const t0 = Date.now();
const log = m => console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's  ' + m);

async function session(role) {
  if (drivers[role]) return drivers[role];
  const d = new Driver({ port: MULTI ? PORTS[role] : 9222, role });
  drivers[role] = d;
  if (!MULTI) await d.run(['nav:' + APP_URL + '/', 'reset', 'switch:test' + role[0].toUpperCase() + role.slice(1)]);
  return d;
}

/** Connect only if this session is not already authenticated; verify it is the right account. */
async function ensureConnected(d, role, page) {
  /*
   * A cold load sometimes stalls before rendering anything but skeletons: AppKit restores the
   * session, the app believes a wallet is connected, but the provider never materialises, so
   * `useAuth().isLoading` stays true and the page never resolves. There are fixes in the app for
   * this, but it still races. A stuck session is recoverable — drop the restored session and
   * connect afresh — so recover rather than failing the whole run on it.
   */
  /*
   * ⚠️ DO NOT "RECOVER" BY RESETTING THE SESSION. This used to revoke the wallet permission and
   *    wipe origin storage out from under a running app, then reload immediately — something no
   *    user ever does. Measured across today's runs: every run that called reset stalled with
   *    8-14 blank-shell retries and none finished, while every run that completed called it
   *    zero times. The "cold-load stall" I spent hours chasing in the app was very largely this.
   *
   *    A page that will not render is now reported, not papered over: the session needs a human
   *    to look at it, and pretending otherwise turns a harness fault into a fake app bug.
   */
  await d.run(['nav:' + page]);
  /*
   * Ask the SCREEN whether we are logged in, not the wallet. MetaMask happily reports the
   * account while the app itself has no session — its auth restore can time out and leave the
   * connect prompt up — and trusting eth_accounts there means walking into a page that is
   * showing "Advanced wallet connection" and waiting for controls that will never appear.
   */
  // The pay link opens on an intro screen; the connect prompt is one click behind it.
  await d.run(['click?:See details & pay']);
  let needsConnect = false;
  /*
   * ⚠️ MARKERS MUST NOT APPEAR IN LOGGED-IN COPY. "Get Started" is a button on the logged-out
   *    /liquidity screen AND a heading ("Get Started with Stabledrop.me") on a signed-in
   *    /create page — matching it sent a perfectly good session into a pointless reconnect
   *    that then failed waiting for a wallet picker nobody had opened.
   */
  for (const marker of ['Advanced wallet connection', 'Connect your wallet to']) {
    try { await d.waitText(marker, 4000); needsConnect = true; break; } catch { /* try next */ }
  }
  if (needsConnect) {
    log(role + ': app session not restored — connecting');
    await d.run(CONNECT);
  } else {
    log(role + ': already signed in');
  }
  await d.run(['click?:Skip']);
  let now = await (await d.app()).evaluate('window.ethereum.request({method:"eth_accounts"}).then(function(a){return a[0]||null})');
  if (!now) {
    // Site permission was revoked (a reset, or a previous run's recovery) — reconnect.
    log(role + ': wallet not connected to the site — connecting');
    await d.run(['click?:See details & pay', ...CONNECT]);
    now = await (await d.app()).evaluate('window.ethereum.request({method:"eth_accounts"}).then(function(a){return a[0]||null})');
  }
  if (!now || now.toLowerCase() !== ADDR[role]) {
    throw new Error(role + ' session is on ' + now + ', expected ' + ADDR[role] +
      (MULTI ? " — set this browser's active MetaMask account to test" + role : ''));
  }
}

/**
 * Wait for text to appear, pressing the screen's own "Check for updates" between looks.
 *
 * A just-funded offer does not reach the seller's list immediately, and the page says so
 * itself ("An offer can become withdrawable without anything telling you"). This is the
 * user's remedy, so it is the harness's remedy too.
 */
async function waitWithRefresh(d, needle, url, totalMs = 120000) {
  const deadline = Date.now() + totalMs;
  let round = 0;
  while (Date.now() < deadline) {
    try {
      await d.waitText(needle, 8000);
      if (round) log('  (appeared after ' + round + ' refresh' + (round === 1 ? '' : 'es') + ')');
      return true;
    } catch { /* not yet */ }
    round++;
    await d.run(['click?:Check for updates']);
    await sleep(4000);
    if (round % 3 === 0) await d.run(['nav:' + url, 'click?:Skip']);
  }
  throw new Error('"' + needle + '" never appeared in the UI after ' + Math.round(totalMs / 1000) + 's of refreshing');
}

(async () => {
  const live = await livePorts([9222, 9223, 9224]);
  MULTI = [PORTS.customer, PORTS.supplier, PORTS.lp].every(p => live.includes(p));
  log('mode: ' + (MULTI ? 'multi-session (one browser per role)' : 'single-session fallback') +
      '  [live ports: ' + live.join(', ') + ']');

  let link = null;
  try {
    if (want('supplier')) {
      const d = await session('supplier');
      await ensureConnected(d, 'supplier', APP_URL + '/create');
      await d.run([
        // 0.0001 is below the $1.00 minimum; the free-test route is the only sub-$1 path and
        // pins the amount at 0.001 USDC with fees waived.
        'click:Send a free test instead',
        'maturity:' + minutes,
        'setSel:#payment-description=scenario T+' + minutes + 'm',
        'click:Continue',
        'wait:Confirm Request Details',
        'click:Create Payment Request',
        'mm?:Confirm,Sign,Sign in',
        'wait:Copy link only',
        'capture:link=' + APP_URL + '/contract-pay\\?contractId=[a-f0-9]+',
      ]);
      link = d.vars.link;
      fs.writeFileSync(LINK_FILE, link);
      fs.writeFileSync(STATE_FILE, JSON.stringify({ contractId: link.split('contractId=')[1] }, null, 2));
      log('supplier: created ' + link);
      if (!MULTI) await d.run(LOGOUT);
    }

    if (want('customer')) {
      link = link || fs.readFileSync(LINK_FILE, 'utf8').trim();
      const d = await session('customer');
      await ensureConnected(d, 'customer', link);
      await d.run([
        // An already-connected session lands straight on the payment screen, skipping the intro.
        'click?:See details & pay',
        'click?:Skip',
        'wait:from this wallet',
        'click:from this wallet',
        'mm!:Confirm,Sign,Approve',
        /*
         * The transfer alone does not complete it — a separate confirmation screen follows.
         *
         * ⚠️ WAIT FOR DETECTION, NOT FOR THE BUTTON. "I have paid" is on screen from the moment
         *    the pay-by-transfer panel appears, including while it still says "No payment found
         *    yet." Pressing it then tells the app the money has arrived before it has, and the
         *    flow stops dead there. "Payment detected" is the app confirming it can see the
         *    transfer on chain, which is the real cue.
         */
        'wait:Payment detected',
        'click:I have paid',
        'wait:DASHBOARD',
      ]);
      writeState({ contractId: link.split('contractId=')[1], paid: true });
      log('customer: paid');
      if (!MULTI) await d.run(LOGOUT);
    }

    if (want('lp')) {
      link = link || fs.readFileSync(LINK_FILE, 'utf8').trim();
      requireState('paid', link.split('contractId=')[1],
        'the customer has not paid this contract, so there is nothing on the market to bid for',
        'run: node scenario.js supplier customer');
      const d = await session('lp');
      await ensureConnected(d, 'lp', APP_URL + '/liquidity');
      // The freshly funded escrow reaches the marketplace list on the index's schedule.
      await waitWithRefresh(d, 'Make offer', APP_URL + '/liquidity');
      await d.run([
        'click:Make offer',
        'wait:Your discount rate',
        'setSel:#discount=5',
        'setSel:#holdback=10',
        'click:Make this offer',
        'wait:from this wallet',
        'click:from this wallet',
        'mm!:Confirm,Sign,Approve',
        'wait:funded and live',
        'click?:Done',
      ]);
      writeState({ offerFunded: true });
      log('lp: offer funded and live');
      if (!MULTI) await d.run(LOGOUT);
    }

    if (want('accept')) {
      link = link || fs.readFileSync(LINK_FILE, 'utf8').trim();
      requireState('offerFunded', link.split('contractId=')[1],
        'no offer has been funded on this contract, so there is nothing to accept',
        'run: node scenario.js supplier customer lp');
      const d = await session('supplier');
      await ensureConnected(d, 'supplier', APP_URL + '/offers');
      await waitWithRefresh(d, 'Accept', APP_URL + '/offers');
      await d.run([
        'click:Accept',
        'wait:Confirm — get paid now',
        'click:Confirm — get paid now',
        // TWO signatures, and they are not simultaneous: the app sends
        // approveRecipientTransfer, awaits its receipt, and only then estimates and sends
        // accept(). mmwatch keeps looking until both prompts have been approved.
        'mmwatch:2:Confirm,Sign,Approve',
      ]);
      log('supplier: accepted — both signatures made');

      /*
       * The sale is only really done when the seller can see the reserve they are owed.
       * Selling early holds part of the price back until the customer's escrow settles, and
       * that residual is the seller's evidence the swap happened at all — the offer simply
       * vanishing from the list looks identical to it lapsing.
       *
       * ReservesOwedList renders nothing at all when it has no rows, so this is a wait on the
       * heading appearing, refreshed through the screen's own control.
       */
      await d.run(['nav:' + APP_URL + '/dashboard', 'click?:Skip', 'click?:Skip Tour']);
      await waitWithRefresh(d, 'Reserves on payments you sold', APP_URL + '/dashboard', 180000);
      log('supplier: reserve listed on the dashboard');
      await d.run(['state:1200']);
    }
    log('done.');
  } catch (e) {
    console.error(((Date.now() - t0) / 1000).toFixed(0) + 's  FAILED: ' + e.message);
    process.exitCode = 1;
  } finally {
    for (const d of Object.values(drivers)) if (d.s) d.s.close();
  }
})();
