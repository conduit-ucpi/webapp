#!/usr/bin/env node
/*
 * drive.js — fast single-session CDP driver for the Conduit/Stabledrop webapp.
 *
 * One persistent WebSocket per run (vs. re-attaching per command), and every wait is
 * condition-based rather than a fixed sleep. Steps come from a mini-DSL so scenarios
 * are data, not code.
 *
 * Prereqs: Chrome started with
 *   --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-cdp-profile"
 * with MetaMask unlocked (testCustomer / testSupplier / testLP).
 *
 * Steps (see scenario.js for real usage):
 *   nav:<url>              full navigation, waits for hydration
 *   wait:<text>            wait until text appears anywhere (incl. shadow DOM)
 *   click:<text>           shadow-piercing click by label/aria-label
 *   set:<aria-label>=<v>   set an input via React-aware value setter
 *   setSel:<css>=<v>       same, addressed by CSS selector
 *   maturity:<minutes>     set the datetime-local input to now + N minutes
 *   mm:<a,b,c>             approve in MetaMask: click first matching button label
 *   switch:<account>       switch MetaMask's active account
 *   capture:<name>=<regex> capture a match from page text into vars, printed at the end
 *   state                  print url / chainId / accounts / page text
 *   sleep:<ms>             last resort
 */
const WebSocket = require('ws');
const MM = 'nkbihfbeogaeaoehlefnkodbefgpgknn';
/** The app under test. Override with E2E_APP_URL when it is not on the default dev port. */
const APP = (process.env.E2E_APP_URL || 'http://localhost:3000').replace(/^https?:\/\//, '').replace(/\/$/, '');
const APP_URL = process.env.E2E_APP_URL || 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hostFor = port => 'http://127.0.0.1:' + (port || 9222);
const pages = async (port) =>
  (await (await fetch(hostFor(port) + '/json/list')).json()).filter(t => t.type === 'page');

/** Which debug ports are actually listening, so scenarios can pick multi- vs single-session. */
async function livePorts(ports = [9222, 9223, 9224]) {
  const out = [];
  for (const p of ports) {
    try {
      const r = await fetch(hostFor(p) + '/json/version', { signal: AbortSignal.timeout(1500) });
      if (r.ok) out.push(p);
    } catch {}
  }
  return out;
}

async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 1 << 27 });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  let id = 0; const pending = new Map();
  ws.on('message', d => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  return { send, evaluate, close: () => ws.close(), url: target.url };
}

// --- injected page helpers (single source of truth for shadow-DOM traversal) ---
// NOTE: written as a normal string, NOT a template literal, so backslashes survive verbatim.
const HELPERS = [
  'window.__d = window.__d || {};',
  'window.__d.all = function () { var out = []; var walk = function (r) { var ns = r.querySelectorAll("*"); for (var i = 0; i < ns.length; i++) { out.push(ns[i]); if (ns[i].shadowRoot) walk(ns[i].shadowRoot); } }; walk(document); return out; };',
  'window.__d.label = function (e) { return (e.innerText || e.textContent || e.value || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " "); };',
  'window.__d.text = function () { return window.__d.all().map(function (e) { return e.getAttribute && e.getAttribute("aria-label") || ""; }).concat([document.body.innerText]).join("\\n"); };',
  // A click must land where a real cursor would. el.click() fires on the node regardless of
  // what covers it, so a modal backdrop is no obstacle and the driver can hit controls no user
  // could reach — which is how a stray click landed on a tab behind an open dialog.
  'window.__d.topmost = function (e) {',
  '  var r = e.getBoundingClientRect();',
  '  var cx = r.x + r.width / 2, cy = r.y + r.height / 2;',
  // Off-screen is not the same as covered: a control below the fold is perfectly clickable
  // once scrolled to. Scroll it into view and re-measure before deciding.
  '  if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) {',
  '    e.scrollIntoView({ block: "center" });',
  '    r = e.getBoundingClientRect();',
  '    cx = r.x + r.width / 2; cy = r.y + r.height / 2;',
  '    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;',
  '  }',
  '  var hit = document.elementFromPoint(cx, cy);',
  '  var guard = 0;',
  '  while (hit && guard++ < 12) {',
  '    if (hit === e || e.contains(hit) || hit.contains(e)) return true;',
  '    if (!hit.shadowRoot) return false;',
  '    var inner = hit.shadowRoot.elementFromPoint(cx, cy);',
  '    if (!inner || inner === hit) return false;',
  '    hit = inner;',
  '  }',
  '  return false;',
  '};',
  'window.__d.find = function (needle) {',
  '  var w = String(needle).toLowerCase(); var all = window.__d.all(); var cands = [];',
  '  for (var i = 0; i < all.length; i++) { var e = all[i]; var t = e.tagName.toLowerCase();',
  '    var role = e.getAttribute("role") || "";',
  '    var clickable = /^(button|a|input|select)$/.test(t) || /button|tab|link|option|menuitem/.test(role) || /^(wui-|w3m-|appkit-)/.test(t);',
  '    if (!clickable || e.disabled) continue;',
  '    var lab = window.__d.label(e); if (!lab.toLowerCase().includes(w)) continue;',
  '    var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;',
  '    if (!window.__d.topmost(e)) continue;',
  '    cands.push({ el: e, len: lab.length, lab: lab });',
  '  }',
  '  cands.sort(function (a, b) { return a.len - b.len; });',
  '  return cands.length ? cands[0] : null;',
  '};',
  'window.__d.click = function (needle) { var hit = window.__d.find(needle); if (!hit) return null; hit.el.scrollIntoView({ block: "center" }); hit.el.click(); return hit.lab.slice(0, 60); };',
  'window.__d.set = function (el, v) { if (!el) return false; var d = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value"); (d && d.set ? d.set : function (x) { el.value = x; }).call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return true; };',
  'window.__d.byLabel = function (l) { var all = window.__d.all(); for (var i = 0; i < all.length; i++) { if (all[i].getAttribute && all[i].getAttribute("aria-label") === l) return all[i]; } return null; };',
  '"ok";',
].join('\n');

class Driver {
  /**
   * One Driver == one browser instance == one role. With a session per role there is no logging
   * out, so no account switching, no reconnect, and no `reset` — `reset` exists only to dodge the
   * re-auth deadlock that logging out triggers.
   */
  constructor(opts = {}) {
    this.vars = {};
    this.s = null;
    this.port = opts.port || 9222;
    this.role = opts.role || null;
  }

  // Pin one app tab for the whole run. Re-resolving "the localhost tab" per call is a trap:
  // with more than one such tab open, list order shifts as tabs activate, so navigation and
  // polling can land on different tabs and every wait times out on a page that looks correct.
  async app() {
    const all = await pages(this.port);
    let t = this.sTargetId ? all.find(p => p.id === this.sTargetId) : null;
    if (!t) {
      t = all.find(p => p.url.includes(APP));
      if (!t) throw new Error('no ' + APP + ' tab open');
      if (this.s) { this.s.close(); this.s = null; }
      this.sTargetId = t.id;
    }
    if (!this.s) this.s = await attach(t);
    await this.s.evaluate(HELPERS);
    return this.s;
  }

  // Poll a predicate against the app page, re-injecting helpers after navigations.
  async until(fn, timeoutMs, what) {
    const deadline = Date.now() + timeoutMs;
    let lastErr = null;
    while (Date.now() < deadline) {
      try { const s = await this.app(); const v = await fn(s); if (v) return v; }
      catch (e) { lastErr = e; }
      await sleep(400);
    }
    throw new Error('timed out waiting for ' + what + (lastErr ? ' (' + lastErr.message + ')' : ''));
  }

  async waitText(needle, timeoutMs = 30000) {
    return this.until(async s => {
      const hit = await s.evaluate('window.__d.text().toLowerCase().includes(' + JSON.stringify(needle.toLowerCase()) + ')');
      return hit ? true : false;
    }, timeoutMs, 'text "' + needle + '"');
  }

  async click(needle, timeoutMs = 30000) {
    const lab = await this.until(async s => s.evaluate('window.__d.click(' + JSON.stringify(needle) + ')'), timeoutMs, 'clickable "' + needle + '"');
    console.log('  click  "' + lab + '"');
    return lab;
  }

  // NOTE: logged-out /dashboard renders a header+footer-only shell roughly 2 loads in 3
  // and never recovers on its own, so navigation retries until React mounts real content.
  async nav(url, attempts = 8) {
    for (let i = 1; i <= attempts; i++) {
      const s = await this.app();
      await s.send('Page.navigate', { url });
      try {
        /*
         * ⚠️ DO NOT JUDGE HYDRATION BY TEXT LENGTH. A legitimate logged-out screen can be very
         *    short — /liquidity's connect prompt is ~350 characters — and a character threshold
         *    rejects it as "never hydrated", which looks exactly like the app's real skeleton
         *    stall and wastes every retry on a page that was fine.
         *
         *    React having mounted real controls is the actual signal: any button beyond the
         *    header chrome ("Go back", "Open menu") means the page rendered something to act on.
         */
        await this.until(async s2 => {
          return await s2.evaluate(`(function(){
            var root = document.querySelector('#__next');
            if (!root) return false;
            var chrome = ['go back', 'open menu', 'skip', 'add email'];
            var btns = root.querySelectorAll('button, a[href]');
            for (var i = 0; i < btns.length; i++) {
              var t = (btns[i].innerText || btns[i].getAttribute('aria-label') || '').trim().toLowerCase();
              if (!t) continue;
              if (chrome.indexOf(t) !== -1) continue;
              if (/terms|privacy|contact|stabledrop|conduit ucpi|next\\.js/.test(t)) continue;
              return true;
            }
            return root.innerText.trim().length > 400;
          })()`);
        }, 6000, 'hydration of ' + url);
        console.log('  nav    ' + url + (i > 1 ? '  (attempt ' + i + ')' : ''));
        return;
      } catch (e) {
        if (i === attempts) throw new Error('never hydrated after ' + attempts + ' attempts: ' + url);
        /*
         * ⚠️ RE-NAVIGATING A WEDGED TAB NEVER RECOVERS IT — REPLACE THE TAB. A tab driven
         *    through many Page.navigate calls eventually stops rendering anything but the
         *    server shell, and reloading it again is what the old loop did eight times over.
         *    A brand-new tab renders the same URL immediately, every time, which is also what
         *    a person does when a page is wedged. Measured: three wedged tabs, all three fine
         *    on a fresh tab with zero skeletons.
         */
        if (i >= 2) {
          console.log('  nav    tab looks wedged, opening a fresh one');
          try {
            if (this.s) { this.s.close(); this.s = null; }
            if (this.sTargetId) await fetch(hostFor(this.port) + '/json/close/' + this.sTargetId).catch(() => {});
            this.sTargetId = null;
            await fetch(hostFor(this.port) + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
            await sleep(3000);
          } catch { /* fall through to another plain retry */ }
        } else {
          console.log('  nav    blank shell, retrying ' + url + ' (' + i + '/' + attempts + ')');
        }
      }
    }
  }

  /**
   * Approve a wallet prompt.
   *
   * ⚠️ POLL GENTLY, AND ONLY THE PROMPT SURFACES. Attaching a fresh CDP session to every
   *    MetaMask page several times a second stops the NEXT prompt ever rendering — the accept
   *    flow's second signature simply never appeared under a 500ms poll, while a passive
   *    watcher on one held-open session saw it every time (and by hand it always shows). So:
   *    2.5s between looks, and prefer pages that are actually a prompt rather than churning
   *    the wallet home page and its background tabs.
   */
  async approve(labels, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    const isPrompt = u => /confirm-transaction|signature-request|\/connect\/|notification\.html|permissions/.test(u);
    while (Date.now() < deadline) {
      const all = (await pages(this.port)).filter(p => p.url.includes(MM));
      const surfaces = all.filter(p => isPrompt(p.url));
      for (const t of (surfaces.length ? surfaces : all)) {
        let mm = null;
        try {
          mm = await attach(t);
          await mm.evaluate(HELPERS);
          for (const l of labels) {
            // Restrict to real <button>s with short labels: MetaMask's transaction-detail
            // page contains status text like "Transaction confirmed", which substring-matches
            // "Confirm" and would otherwise be "approved" as a phantom click.
            const lab = await mm.evaluate(
              `(function(){
                 var norm = function (e) { return (e.innerText || '').trim(); };
                 /*
                  * ⚠️ THE CONFIRM BUTTON IS NOT ALWAYS CALLED "CONFIRM". When MetaMask predicts a
                  *    transaction will fail it replaces the footer button with a DISABLED
                  *    "Review alert", and only re-enables it once the warning has been
                  *    acknowledged. Matching on the word alone finds nothing, the window times
                  *    out, and a human ends up clicking it — which is exactly what happened on
                  *    the accept flow's SECOND signature, repeatedly.
                  *
                  *    So: address the footer by its test id, and if it is blocked, deal with the
                  *    alert first — open it, tick whatever it asks, accept it — then press.
                  */
                 var footer = document.querySelector('[data-testid="confirm-footer-button"]');
                 if (footer && !footer.disabled) {
                   var t = norm(footer);
                   if (!t || t.toLowerCase().indexOf('review') === 0) { footer.click(); return t || 'confirm-footer-button'; }
                 }
                 if (footer && footer.disabled) {
                   // Open the inline alert, if there is one.
                   var banner = document.querySelector('[data-testid*="alert"], [class*="alert"] button, button[aria-label*="alert" i]');
                   if (banner) { banner.click(); }
                   // Tick any acknowledgement checkbox the modal puts up.
                   var boxes = document.querySelectorAll('input[type="checkbox"]');
                   for (var c = 0; c < boxes.length; c++) { if (!boxes[c].checked) boxes[c].click(); }
                   // Then take whatever confirms the alert modal itself.
                   var all2 = document.querySelectorAll('button');
                   for (var j = 0; j < all2.length; j++) {
                     var bt = norm(all2[j]).toLowerCase();
                     if (all2[j].disabled) continue;
                     if (/acknowledg|i understand|confirm anyway|proceed|got it/.test(bt)) { all2[j].click(); return norm(all2[j]); }
                   }
                   return null; // let the caller come back round once the alert has been dealt with
                 }
                 // Ordinary case: a short-labelled button matching what we were asked for.
                 var all = window.__d.all(); var best = null;
                 for (var i = 0; i < all.length; i++) {
                   var e = all[i];
                   if (e.tagName !== 'BUTTON' || e.disabled) continue;
                   var lb = window.__d.label(e); if (lb.length > 25) continue;
                   if (lb.toLowerCase().indexOf(${JSON.stringify(String(l).toLowerCase())}) < 0) continue;
                   var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
                   if (!best || lb.length < best.n) { best = { e: e, n: lb.length, lab: lb }; }
                 }
                 if (!best) return null;
                 best.e.scrollIntoView({ block: 'center' });
                 best.e.click();
                 return best.lab;
               })()`);
            if (lab) { console.log('  mm     approved "' + lab + '"'); mm.close(); await sleep(1200); return lab; }
          }
        } catch {} finally { if (mm) mm.close(); }
      }
      await sleep(2500);
    }
    throw new Error('no MetaMask prompt matching [' + labels.join(', ') + '] within ' + timeoutMs + 'ms');
  }

  async switchAccount(name) {
    const t = (await pages(this.port)).find(p => p.url.includes(MM) && p.url.includes('home.html'))
           || (await pages(this.port)).find(p => p.url.includes(MM));
    if (!t) throw new Error('no MetaMask page target');
    const mm = await attach(t);
    try {
      await mm.send('Page.navigate', { url: t.url.split('#')[0] + '#/account-list' });
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        await sleep(500);
        await mm.evaluate(HELPERS).catch(() => {});
        const hit = await mm.evaluate(
          '(function(){var all=window.__d.all();var best=null;' +
          'for(var i=0;i<all.length;i++){var e=all[i];var l=(e.innerText||e.textContent||"").trim();' +
          'if(l.toLowerCase().indexOf(' + JSON.stringify(name.toLowerCase()) + ')<0)continue;' +
          'var r=e.getBoundingClientRect(); if(r.width<4||r.height<4)continue;' +
          'var a=r.width*r.height; if(!best||a<best.a)best={a:a,e:e};}' +
          'if(!best)return null; best.e.click(); return true;})()'
        ).catch(() => null);
        if (hit) { console.log('  switch MetaMask -> ' + name); await sleep(1500); return; }
      }
      throw new Error('account not found in MetaMask list: ' + name);
    } finally { mm.close(); }
  }


  // Full sign-out reset. Revoking the wallet permission is the part that matters: with the
  // site permission still granted, MetaMask auto-connects and the app's SIWE->JWT exchange
  // deadlocks ("Authentication already in progress, waiting for it...") leaving every API
  // call 401. Clearing cookies/localStorage alone does NOT clear that state.
  async reset() {
    const s = await this.app();
    await s.evaluate('window.ethereum ? window.ethereum.request({method:"wallet_revokePermissions",params:[{eth_accounts:{}}]}).then(function(){return 1}).catch(function(){return 0}) : 0');
    await s.send('Storage.clearDataForOrigin', { origin: APP_URL, storageTypes: 'all' });
    await s.send('Network.clearBrowserCookies');
    console.log('  reset  revoked wallet permission + cleared storage/cookies');
  }

  async state(chars = 1200) {
    const s = await this.app();
    const out = await s.evaluate('(async function(){' +
      'var acc = window.ethereum ? await window.ethereum.request({method:"eth_accounts"}).catch(function(){return []}) : [];' +
      'var cid = window.ethereum ? await window.ethereum.request({method:"eth_chainId"}).catch(function(){return null}) : null;' +
      'return {url: location.href, accounts: acc, chainId: cid, text: document.body.innerText.replace(/\\n{3,}/g,"\\n\\n").slice(0,' + chars + ')};})()');
    console.log('  URL      ' + out.url + '\n  CHAIN    ' + out.chainId + '\n  ACCOUNTS ' + JSON.stringify(out.accounts));
    console.log('--- page ---\n' + out.text + '\n------------');
    return out;
  }

  async run(steps) {
    for (const step of steps) {
      const i = step.indexOf(':');
      let cmd = i < 0 ? step : step.slice(0, i);
      let arg = i < 0 ? '' : step.slice(i + 1);
      for (const [k, v] of Object.entries(this.vars)) arg = arg.split('{{' + k + '}}').join(v);
      switch (cmd) {
        case 'nav': await this.nav(arg); break;
        case 'wait': await this.waitText(arg); console.log('  wait   "' + arg + '" ✓'); break;
        case 'click': await this.click(arg); break;
        // click? — click if present, else carry on. Screens differ by session state: an already
        // connected wallet skips intro/connect screens entirely.
        case 'click?': await this.click(arg, 4000).catch(() => console.log('  click  (skipped, absent: "' + arg + '")')); break;
        case 'sleep': await sleep(Number(arg)); break;
        case 'state': await this.state(Number(arg || 1200)); break;
        case 'reset': await this.reset(); break;
        // A newly funded escrow is not in the sellable index immediately, so the liquidity
        // screen shows "No payments are open to offers" until chainservice reconciles it.
        case 'refresh': {
          const s2 = await this.app();
          const r = await s2.evaluate('fetch("/api/marketplace/refresh",{method:"POST"}).then(function(x){return x.json()}).catch(function(){return null})');
          console.log('  refresh index: ' + JSON.stringify(r));
          break;
        }
        case 'switch': await this.switchAccount(arg); break;
        case 'mm': await this.approve(arg.split(',').map(x => x.trim())); break;
        // mm? — approve only if a prompt shows up quickly; MetaMask skips the Connect
        // prompt entirely when the site already holds permission for the active account.
        case 'mm?': await this.approve(arg.split(',').map(x => x.trim()), 8000).catch(e => console.log('  mm     (none: ' + e.message.split(' within')[0] + ')')); break;
        // mm! — REQUIRED approval with a long window, for prompts the app raises only after
        // server round-trips (e.g. the escrow transfer). Never follow this with a logout
        // before the tx settles: disconnecting while a prompt is open makes MetaMask fire
        // rejectAllApprovals and the tx comes back as code 4001 user-denied.
        case 'mm!': await this.approve(arg.split(',').map(x => x.trim()), 90000); break;
        /*
         * mmwatch:<count>:<labels> — approve up to <count> wallet prompts as they appear.
         *
         * Accepting an offer takes TWO signatures that are not simultaneous: the app sends
         * approveRecipientTransfer, AWAITS its receipt, and only then estimates and sends
         * accept(). Two fixed back-to-back approvals race that gap — the second look happens
         * while the first transaction is still confirming and there is no prompt to find yet.
         * This keeps watching until it has approved the expected number.
         */
        case 'mmwatch': {
          const ci = arg.indexOf(':');
          const count = Number(arg.slice(0, ci));
          const labels = arg.slice(ci + 1).split(',').map(x => x.trim());
          const deadline = Date.now() + 240000;
          let approved = 0;
          while (approved < count && Date.now() < deadline) {
            try {
              await this.approve(labels, 25000); approved++;
              console.log('  mm     signature ' + approved + '/' + count);
              await sleep(5000); // let the app submit the next transaction untouched
            }
            catch { /* no prompt in this slice; the app may still be confirming */ }
          }
          if (approved < count) throw new Error('only ' + approved + '/' + count + ' wallet prompts appeared within 240s');
          break;
        }
        case 'set': {
          const [l, ...rest] = arg.split('=');
          const s = await this.app();
          const ok = await s.evaluate('window.__d.set(window.__d.byLabel(' + JSON.stringify(l) + '), ' + JSON.stringify(rest.join('=')) + ')');
          if (!ok) throw new Error('input not found by aria-label: ' + l);
          console.log('  set    ' + l + ' = ' + rest.join('='));
          break;
        }
        case 'setSel': {
          const [sel, ...rest] = arg.split('=');
          const s = await this.app();
          const ok = await s.evaluate('window.__d.set(document.querySelector(' + JSON.stringify(sel) + '), ' + JSON.stringify(rest.join('=')) + ')');
          if (!ok) throw new Error('input not found: ' + sel);
          console.log('  set    ' + sel + ' = ' + rest.join('='));
          break;
        }
        case 'maturity': {
          const s = await this.app();
          const v = await s.evaluate('(function(){var t=new Date(Date.now()+' + Number(arg) + '*60000);var p=function(n){return String(n).padStart(2,"0")};' +
            'var v=t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate())+"T"+p(t.getHours())+":"+p(t.getMinutes());' +
            'window.__d.set(document.querySelector("input[type=datetime-local]"), v); return v;})()');
          console.log('  set    maturity = ' + v + ' (now +' + arg + 'm)');
          break;
        }
        case 'capture': {
          const [name, ...rest] = arg.split('=');
          const re = rest.join('=');
          const s = await this.app();
          const v = await s.evaluate('(function(){var m=document.body.innerText.match(new RegExp(' + JSON.stringify(re) + '));return m?m[0]:null})()');
          if (!v) throw new Error('capture failed: ' + name + ' /' + re + '/');
          this.vars[name] = v;
          console.log('  capture ' + name + ' = ' + v);
          break;
        }
        default: throw new Error('unknown step: ' + step);
      }
    }
    return this.vars;
  }
}

module.exports = { Driver, sleep, pages, attach, livePorts, hostFor, APP_URL };

if (require.main === module) {
  const args = process.argv.slice(2);
  const pi = args.indexOf('--port');
  const port = pi >= 0 ? Number(args[pi + 1]) : 9222;
  const steps = pi >= 0 ? args.filter((_, i) => i !== pi && i !== pi + 1) : args;
  const d = new Driver({ port });
  d.run(steps)
    .then(v => { if (Object.keys(v).length) console.log('vars:', v); d.s && d.s.close(); })
    .catch(e => { console.error('ERR ' + e.message); d.s && d.s.close(); process.exit(1); });
}
