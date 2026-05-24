/**
 * Architecture Test: single RPC chokepoint.
 *
 * Enforces the goal of the RPC-abstraction refactor: all blockchain RPC against
 * our own rpcUrl flows through lib/rpc/. No other source file may instantiate
 * `new ethers.JsonRpcProvider` or issue a raw `fetch`-based JSON-RPC call to the
 * node. This is what keeps the abstraction from eroding — a new scattered read
 * will fail this test.
 *
 * Allowed:
 *   - lib/rpc/**            — the library itself.
 *   - test files / mocks    — they simulate RPC.
 *
 * Documented exception (NOT a free pass):
 *   - lib/web3.ts           — Web3Service still owns its internal readProvider
 *                             for the gas-price / nonce / network / receipt
 *                             paths tied to signing. Migrating those is Phase 2.
 *                             It is listed explicitly so the test stays honest:
 *                             when Phase 2 lands, remove it from the exception
 *                             list and this test enforces a TOTAL chokepoint.
 *
 * NOTE: wallet-provider calls (walletProvider.request({...}) against the user's
 * wallet, e.g. eth_accounts / eth_chainId / eth_sendTransaction in
 * reownWalletConnect / farcaster signing) are NOT in scope — they target the
 * wallet, not our rpcUrl. This test only looks for OUR-endpoint patterns.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../');

// Directories that contain application source we want to police.
const SCAN_DIRS = ['components', 'pages', 'hooks', 'lib', 'utils'];

// Paths (relative to repo root, posix-style) allowed to hold direct RPC.
const ALLOWED_PREFIXES = ['lib/rpc/'];

// The one documented holdout (see header). Remove when Phase 2 migrates it.
const DOCUMENTED_EXCEPTIONS = ['lib/web3.ts'];

const findSourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  const scan = (current: string) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        scan(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        // Skip test files and test helpers — they mock RPC.
        if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
        out.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  };
  scan(path.join(ROOT, dir));
  return out;
};

const isAllowed = (relPath: string): boolean =>
  ALLOWED_PREFIXES.some((p) => relPath.startsWith(p)) ||
  DOCUMENTED_EXCEPTIONS.includes(relPath);

describe('Architecture: single RPC chokepoint (lib/rpc)', () => {
  const files = SCAN_DIRS.flatMap(findSourceFiles).filter((f) => !isAllowed(f));

  it('discovers source files to police', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s does not construct `new ethers.JsonRpcProvider`', (relPath) => {
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
    const pattern = /new\s+ethers\.JsonRpcProvider|new\s+JsonRpcProvider\b/;
    if (pattern.test(content)) {
      const lines = content.split('\n');
      const hits = lines
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => pattern.test(line));
      throw new Error(
        `${relPath} constructs a JsonRpcProvider directly:\n` +
          hits.map(({ line, n }) => `  Line ${n}: ${line}`).join('\n') +
          `\n\nRead RPC must go through lib/rpc/RpcClient instead.`
      );
    }
  });

  it.each(files)('%s does not issue a raw fetch-based JSON-RPC call', (relPath) => {
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
    // A raw JSON-RPC body to our node looks like: jsonrpc: '2.0' with an eth_ method.
    const hasJsonRpcBody = /jsonrpc:\s*['"]2\.0['"]/.test(content);
    const hasEthMethod = /method:\s*['"]eth_[a-zA-Z]+['"]/.test(content);
    if (hasJsonRpcBody && hasEthMethod) {
      const lines = content.split('\n');
      const hits = lines
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => /jsonrpc:\s*['"]2\.0['"]|method:\s*['"]eth_/.test(line));
      throw new Error(
        `${relPath} builds a raw JSON-RPC request:\n` +
          hits.map(({ line, n }) => `  Line ${n}: ${line}`).join('\n') +
          `\n\nDirect node RPC must go through lib/rpc/RpcClient instead.`
      );
    }
  });

  it('the documented exception list stays minimal (only web3.ts internals remain)', () => {
    // Guards against silently adding new exceptions. If you migrate web3.ts in
    // Phase 2, shrink this list (ideally to empty) rather than growing it.
    expect(DOCUMENTED_EXCEPTIONS).toEqual(['lib/web3.ts']);
  });
});
