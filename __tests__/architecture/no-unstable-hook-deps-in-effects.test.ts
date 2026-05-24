/**
 * Architecture Test: no unstable useSimpleEthers method in a useEffect dep array.
 *
 * useSimpleEthers (hooks/useSimpleEthers.tsx) returns a FRESH object literal on
 * every render, so its methods (getTokenBalance, getNativeBalance,
 * getUSDCBalance, getWeb3Service, getContractInfo, ...) have a NEW identity each
 * render. Putting one in a useEffect dependency array re-fires that effect every
 * render — a render/fetch loop (observed as the balance "flashing" and the page
 * mounting endlessly after the RPC read migration).
 *
 * This test scans the files that consume useSimpleEthers and fails if any
 * useEffect dependency array references one of those methods. Effects must
 * depend on the primitive inputs instead (address / token address / rpcUrl).
 *
 * NOTE: useCallback is allowed to list these methods — a callback's identity
 * churning is harmless unless the callback itself is then placed in an effect's
 * deps (which this repo avoids; those callbacks are used as event handlers).
 * We therefore only police useEffect dependency arrays.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../');

// Files that read balances/contract data via useSimpleEthers in effects.
const FILES = [
  'pages/contract-pay.tsx',
  'pages/contract-create.tsx',
  'pages/wallet.tsx',
  'components/ui/WalletInfo.tsx',
];

// useSimpleEthers methods that are unstable across renders.
const UNSTABLE_METHODS = [
  'getTokenBalance',
  'getNativeBalance',
  'getUSDCBalance',
  'getWeb3Service',
  'getContractInfo',
  'getUserAddress',
  'fundAndSendTransaction',
  'transferToContract',
  'approveUSDC',
  'depositToContract',
];

/**
 * Extract the dependency-array text of every useEffect(...) call in a source
 * string. We find `useEffect(` then the matching `, [ ... ]);` that closes it.
 * A light scan is enough: we look for the `}, [ ... ])` that ends each effect.
 */
function extractUseEffectDepArrays(source: string): string[] {
  const deps: string[] = [];
  const re = /useEffect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // From the useEffect start, find the closing `}, [ ... ])` of the call.
    const rest = source.slice(m.index);
    // Match the LAST `}, [ ... ])` that belongs to this effect: the first
    // occurrence of `, [` that follows the effect body's closing brace.
    const depMatch = rest.match(/\}\s*,\s*\[([\s\S]*?)\]\s*\)/);
    if (depMatch) {
      deps.push(depMatch[1]);
    }
  }
  return deps;
}

describe('Architecture: no unstable useSimpleEthers method in useEffect deps', () => {
  it.each(FILES)('%s effect dependency arrays exclude unstable hook methods', (relPath) => {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) {
      throw new Error(`Expected file not found: ${relPath}`);
    }
    const source = fs.readFileSync(full, 'utf-8');
    const depArrays = extractUseEffectDepArrays(source);

    const violations: string[] = [];
    for (const deps of depArrays) {
      // Split on commas/whitespace into individual identifiers.
      const tokens = deps.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      for (const method of UNSTABLE_METHODS) {
        if (tokens.includes(method)) {
          violations.push(`${method} found in deps: [${deps.trim()}]`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `${relPath} has unstable useSimpleEthers method(s) in a useEffect dependency array:\n` +
          violations.map((v) => `  - ${v}`).join('\n') +
          `\n\nuseSimpleEthers returns a fresh object each render, so these references ` +
          `change every render and re-fire the effect (render loop). Depend on the ` +
          `primitive inputs (address / token address / rpcUrl) instead and add ` +
          `// eslint-disable-next-line react-hooks/exhaustive-deps.`
      );
    }
  });

  it('the dep-array extractor actually finds effects (guards against a vacuous pass)', () => {
    const source = fs.readFileSync(path.join(ROOT, 'pages/contract-pay.tsx'), 'utf-8');
    const arrays = extractUseEffectDepArrays(source);
    expect(arrays.length).toBeGreaterThan(3);
  });
});
