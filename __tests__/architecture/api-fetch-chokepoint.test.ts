/**
 * Architecture Test: single API chokepoint (lib/apiFetch).
 *
 * Every call to our own Node API must resolve through `apiFetch()` / `apiUrl()`.
 * A bare `fetch('/api/...')` resolves against whichever origin served the page,
 * which is correct only while the app and the API share a host. The static
 * GitHub Pages build does not (see STATIC_FRONTEND_MIGRATION_PLAN.md): the page
 * is served from pages.stabledrop.me and the API lives on api.stabledrop.me, so
 * a relative path there resolves to a host with no API at all.
 *
 * This test exists because that failed twice, in two different shapes:
 *
 *   1. Literal paths — `fetch('/api/auth/identity')`. Easy to spot.
 *   2. Variable paths — a helper takes `url` from its caller and issues
 *      `fetch(url, opts)`. The literal lives at the call site, the fetch lives
 *      somewhere else, and a grep for one never finds the other. This is what
 *      broke SIWE on Pages: BackendClient issued the request against the wrong
 *      origin, so /api/auth/identity returned 404 rather than 401, and the
 *      "JWT expired, request a fresh signature" branch was never reached. The
 *      wallet connected and authentication silently never happened.
 *
 * Hence two rules. The first catches shape 1 anywhere. The second is the one
 * that matters: it requires EVERY fetch in application code to name apiUrl,
 * so a helper cannot quietly accept a relative path from a caller.
 *
 * Out of scope (these do not target our API):
 *   - pages/api/**   — that IS the Node API; it calls backend services.
 *   - lib/server/**  — server-only, never shipped to a browser.
 *   - *Server.ts     — same, by naming convention.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../');

// Directories that contain application source we want to police.
const SCAN_DIRS = ['components', 'pages', 'hooks', 'lib', 'utils', 'types'];

// Server-side code: not shipped to a browser, so a relative path is meaningless
// rather than wrong. pages/api/** is the API itself.
const SERVER_PREFIXES = ['pages/api/', 'lib/server/'];

/**
 * Files whose every fetch targets a third-party or internal-service URL that is
 * already absolute. Listed explicitly so the list stays honest and small — a new
 * entry should be a deliberate decision, not a silent one.
 *
 * NOTE: rule 1 still applies to these files. An exception here only means
 * "fetch need not name apiUrl", never "this file may use relative /api paths".
 */
const EXTERNAL_FETCH_EXCEPTIONS = [
  'lib/web3.ts',                    // this.config.rpcUrl — blockchain node
  'lib/rpc/RpcClient.ts',           // this.rpcUrl — blockchain node
  'lib/auth/magicReachability.ts',  // MAGIC_PROBE_URL — third-party probe
  'hooks/useExchangeRate.ts',       // exchangeRateApiUrl — third-party rates
  'utils/projectsServer.ts',        // fanout chain service, server-side
];

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
        if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(ROOT, full).split(path.sep).join('/');
        if (SERVER_PREFIXES.some((p) => rel.startsWith(p))) continue;
        if (/Server\.tsx?$/.test(rel)) continue;
        out.push(rel);
      }
    }
  };
  scan(path.join(ROOT, dir));
  return out;
};

/**
 * Blank out comment bodies, preserving offsets and newlines so line numbers stay
 * correct. Tracks string state so a `//` inside a URL literal is not mistaken for
 * a comment. Without this, prose like `// authenticated fetch (triggers SIWX...)`
 * reads as a call.
 */
const stripComments = (src: string): string => {
  const out = src.split('');
  let i = 0;
  let state: 'code' | "'" | '"' | '`' = 'code';
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') {
        while (i < src.length && src[i] !== '\n') out[i++] = ' ';
        continue;
      }
      if (c === '/' && next === '*') {
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] !== '\n') out[i] = ' ';
          i++;
        }
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') state = c;
    } else {
      if (c === '\\') { i += 2; continue; }
      if (c === state) state = 'code';
    }
    i++;
  }
  return out.join('');
};

/** Line number of a character offset, 1-based. */
const lineOf = (content: string, index: number): number =>
  content.slice(0, index).split('\n').length;

/**
 * First argument of every `fetch(` call in the file, as source text.
 * Reads forward balancing parens so multi-line calls are caught too — the
 * CreateProjectWizard miss was a `fetch(` with its path on the next line.
 */
const fetchFirstArgs = (raw: string): { arg: string; line: number }[] => {
  const content = stripComments(raw);
  const out: { arg: string; line: number }[] = [];
  // Not `apiFetch(`, not `.fetch(`, not a string containing "fetch(".
  const call = /(?<![a-zA-Z0-9_.'"`])fetch\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(content)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < content.length && depth > 0) {
      const c = content[i];
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        // Stop ON the closing paren, not past it, so `fetch()` yields '' rather
        // than ')' and a single-argument call does not keep a trailing paren.
        if (depth === 0) break;
      } else if (c === ',' && depth === 1) break;
      i++;
    }
    const arg = content.slice(start, i).trim();
    // `fetch()` with no argument is prose or docs, never a real call.
    if (arg) out.push({ arg, line: lineOf(content, m.index) });
  }
  return out;
};

describe('Architecture: single API chokepoint (lib/apiFetch)', () => {
  const files = SCAN_DIRS.flatMap(findSourceFiles);

  it('discovers source files to police', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Rule 1 — applies to every file, exceptions included.
  it.each(files)('%s does not pass a relative /api path to a bare fetch', (relPath) => {
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
    const offenders = fetchFirstArgs(content).filter(({ arg }) => /^['"`]\/api\//.test(arg));
    if (offenders.length) {
      throw new Error(
        `${relPath} calls fetch() with a relative /api path:\n` +
          offenders.map(({ arg, line }) => `  Line ${line}: fetch(${arg}`).join('\n') +
          `\n\nUse apiFetch('/api/...') so the call resolves against ` +
          `NEXT_PUBLIC_API_BASE_URL. A relative path 404s on the static build.`
      );
    }
  });

  // Rule 2 — the one that catches a helper taking a caller-supplied path.
  it.each(files.filter((f) => !EXTERNAL_FETCH_EXCEPTIONS.includes(f)))(
    '%s routes every fetch through apiUrl()',
    (relPath) => {
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
      const offenders = fetchFirstArgs(content).filter(({ arg }) => !arg.startsWith('apiUrl('));
      if (offenders.length) {
        throw new Error(
          `${relPath} calls fetch() without apiUrl():\n` +
            offenders.map(({ arg, line }) => `  Line ${line}: fetch(${arg.slice(0, 80)}`).join('\n') +
            `\n\nEither call apiFetch(path), or wrap as fetch(apiUrl(url), ...) if ` +
            `this helper takes a caller-supplied path. If the URL is genuinely ` +
            `third-party, add this file to EXTERNAL_FETCH_EXCEPTIONS with a reason.`
        );
      }
    }
  );

  it('the external-fetch exception list stays small and deliberate', () => {
    expect(EXTERNAL_FETCH_EXCEPTIONS).toEqual([
      'lib/web3.ts',
      'lib/rpc/RpcClient.ts',
      'lib/auth/magicReachability.ts',
      'hooks/useExchangeRate.ts',
      'utils/projectsServer.ts',
    ]);
  });
});
