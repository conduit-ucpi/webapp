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

// Scan ALL pages and components — a hand-curated list previously let new
// violations (CreateContractWizard, EmailPromptManager) slip through. The rule
// is uniform: no unstable useAuth/useSimpleEthers callback in a useEffect
// dependency array, anywhere.
function collectSourceFiles(): string[] {
  const out: string[] = [];
  const scan = (dir: string) => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        scan(rel);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
        out.push(rel);
      }
    }
  };
  scan('pages');
  scan('components');
  return out;
}

const FILES = collectSourceFiles();

// Unstable-across-renders hook methods. These come from useSimpleEthers AND
// useAuth, both of which return a fresh value whose function members are
// recreated when auth/config state changes. Putting any of them in a useEffect
// dependency array re-fires the effect on every such change — and for the auth
// callbacks (authenticatedFetch / refreshUserData) that re-fire drives a
// re-render/re-auth storm (perpetual 401s). Depend on primitive inputs instead.
const UNSTABLE_METHODS = [
  // useSimpleEthers
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
  // useAuth
  'authenticatedFetch',
  'refreshUserData',
];

/**
 * Extract the dependency-array text of every useEffect(...) call.
 *
 * Precision matters: we must NOT pick up a useCallback's/useMemo's dependency
 * array. We walk from each `useEffect(` and brace-match to the call's own
 * closing `)`, then read the `[...]` immediately before that close as the dep
 * array. This guarantees the dep array belongs to THIS useEffect and not a
 * sibling/nested hook that happens to appear later in the file.
 */
function extractUseEffectDepArrays(source: string): string[] {
  const deps: string[] = [];
  const re = /useEffect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // Start just after the opening "(" of useEffect(.
    let i = m.index + m[0].length;
    let depth = 1; // we're inside useEffect's parens
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    // i now points just past useEffect's closing ")". The dependency array, if
    // present, is the last [...] before that close.
    const callText = source.slice(m.index, i);
    const depMatch = callText.match(/,\s*\[([\s\S]*?)\]\s*\)\s*$/);
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
