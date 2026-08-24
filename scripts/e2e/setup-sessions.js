#!/usr/bin/env node
/*
 * One-time per-browser setup. The profiles were copied from a browser that already had a live
 * app session as testLP, so each copy carries that session's cookies AND MetaMask's site
 * permission for testLP. Changing MetaMask's active account does not change who the dapp is
 * connected as — the site permission has to be revoked and re-granted for the new account.
 *
 * Run once after launching/copying profiles. Afterwards the sessions persist and the scenario
 * never logs out again.
 */
const { Driver, APP_URL } = require('./drive.js');
const ROLES = [
  { port: Number(process.env.E2E_PORT_CUSTOMER || 9222), role: 'customer', name: 'testCustomer', addr: '0xe91a3875e8049dcc25bbea793e41b44c0038398d' },
  { port: Number(process.env.E2E_PORT_SUPPLIER || 9223), role: 'supplier', name: 'testSupplier', addr: '0x32ecf447618107f3bf7ad58a374cdadaeface0e2' },
  { port: Number(process.env.E2E_PORT_LP || 9224), role: 'lp',       name: 'testLP',       addr: '0xa21ab94ae421ce2880376739b53fba938e5af8e5' },
];

(async () => {
  for (const r of ROLES) {
    console.log('\n=== ' + r.port + ' -> ' + r.name + ' ===');
    const d = new Driver({ port: r.port });
    try {
      await d.run(['nav:' + APP_URL + '/', 'reset', 'switch:' + r.name]);
      await d.run(['nav:' + APP_URL + '/dashboard',
        'click:Advanced wallet connection', 'click:MetaMask',
        'mm?:Connect', 'mm?:Confirm,Sign', 'sleep:4000']);
      const s = await d.app();
      const acct = await s.evaluate('window.ethereum.request({method:"eth_accounts"}).then(function(a){return a[0]||null})');
      const idOk = await s.evaluate('fetch("/api/auth/identity").then(function(r){return r.status})');
      const ok = acct && acct.toLowerCase() === r.addr;
      console.log('  connected: ' + acct + (ok ? '  ✓' : '  ✗ expected ' + r.addr) + '   identity: ' + idOk);
    } catch (e) {
      console.log('  ERR ' + e.message);
    } finally { if (d.s) d.s.close(); }
  }
})();
