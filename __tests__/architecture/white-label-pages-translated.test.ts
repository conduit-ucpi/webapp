/**
 * Architecture test: the pages a white-label partner hosts carry no hard-coded English.
 *
 * The typed catalogues guarantee that every key has a Spanish value, but they cannot see a
 * string that never became a key. On 28 October 2026 the seven framed pages (the list on
 * /white-label) still showed 180 such strings in 29 files, every one invisible to the type
 * system. This test walks each page's import tree and fails on any JSX text, human-facing
 * attribute, or toast/setError message that is a literal rather than a t() call.
 *
 * It is a heuristic, deliberately biased towards catching copy: a false positive is fixed by
 * routing the string through t() or, for a glyph or a domain name, by adding it to ALLOWED.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '../../');
const SDK = path.join(ROOT, 'packages/whitelabel-sdk/src');
const SDK_INDEX = path.join(SDK, 'index.ts');

/** The pages from /white-label step 4, plus the header and footer wrapped around them. */
const PAGES: Record<string, string> = {
  '/contract-create': 'pages/contract-create.tsx',
  '/create': 'pages/create.tsx',
  '/integrate': 'pages/integrate.tsx',
  '/contract-pay': 'pages/contract-pay.tsx',
  '/pay': 'pages/pay.tsx',
  '/dashboard': 'pages/dashboard.tsx',
  '/disputes': 'pages/disputes.tsx',
  'layout (header and footer)': 'components/layout/Layout.tsx',
};

/** Literals that are not copy: glyphs, domains, code. Keyed by repo-relative file. */
const ALLOWED: Record<string, (string | RegExp)[]> = {
  'packages/whitelabel-sdk/src/components/auth/ConnectWalletEmbedded.tsx': ['magiclabs.com'],
  'packages/whitelabel-sdk/src/components/contracts/AmountGuidance.tsx': ['−', '&minus;'],
  // Code samples: the integration guide's snippets are code, never translated.
  'pages/integrate.tsx': [/.*/],
  // The amount label is "{amount} {symbol}", numbers and a token.
  'packages/whitelabel-sdk/src/pages/PayPage.tsx': [/^\$\{amount\}/],
};

const EXTS = ['.tsx', '.ts', '/index.tsx', '/index.ts', '.js', '.jsx'];
const isFile = (p: string) => fs.existsSync(p) && fs.statSync(p).isFile();
const withExt = (base: string): string | null => {
  if (isFile(base)) return base;
  for (const e of EXTS) if (isFile(base + e)) return base + e;
  return null;
};

function resolve(spec: string, from: string): string | null {
  if (spec.startsWith('@/')) {
    // Mirrors tsconfig paths: SDK first, app second.
    return withExt(path.join(SDK, spec.slice(2))) ?? withExt(path.join(ROOT, spec.slice(2)));
  }
  if (spec === '@conduit-ucpi/whitelabel-sdk') return SDK_INDEX;
  if (spec.startsWith('@conduit-ucpi/whitelabel-sdk/')) return withExt(path.join(SDK, spec.split('/').slice(2).join('/')));
  if (spec.startsWith('.')) return withExt(path.resolve(path.dirname(from), spec));
  return null; // node_modules
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

/**
 * Importing the SDK's root index would drag every product page into every walk, so a named
 * import from it follows only the files that export those names.
 */
const exportMapCache = new Map<string, Map<string, string>>();
function buildExportMap(file: string, stack = new Set<string>()): Map<string, string> {
  const cached = exportMapCache.get(file);
  if (cached) return cached;
  const map = new Map<string, string>();
  if (stack.has(file)) return map;
  stack.add(file);
  const sf = parse(file);
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && ts.isVariableStatement(st)) {
      st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && map.set(d.name.text, file));
    } else if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) {
      map.set(st.name.text, file);
    } else if (ts.isExportDeclaration(st)) {
      const target = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? resolve(st.moduleSpecifier.text, file) : file;
      if (!target) continue;
      if (!st.exportClause) {
        for (const [k, v] of buildExportMap(target, stack)) map.set(k, v);
      } else if (ts.isNamedExports(st.exportClause)) {
        const inner = target === file ? null : buildExportMap(target, stack);
        st.exportClause.elements.forEach((el) => {
          const local = (el.propertyName ?? el.name).text;
          map.set(el.name.text, inner?.get(local) ?? target);
        });
      }
    }
  }
  exportMapCache.set(file, map);
  return map;
}

const HUMAN_ATTR = /label|title|text|message|hint|placeholder|description|caption/i;
const SKIP_ATTRS = new Set(['className', 'id', 'key', 'htmlFor', 'data-testid', 'content', 'property', 'fontFamily']);

/** Does this literal look like words a visitor would read? */
function looksHuman(raw: string): boolean {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false; // needs a word
  if (/^(0x|https?:|\/|#|\$|\.|@|mailto:)/.test(t)) return false;
  if (/^[A-Z0-9_\-.]+$/.test(t) && !/\s/.test(t)) return false; // CONSTANT or token symbol
  if (/^[a-z][A-Za-z0-9]*$/.test(t) && t.length < 4) return false;
  if (/^(USDC|USDT|ETH|Base|OK|true|false|null|undefined|none|auto)$/i.test(t)) return false;
  if (/^(px-|py-|text-|bg-|flex|grid|rounded|border|font-|w-|h-|m[tblrxy]?-|gap-|items-|justify-|space-)/.test(t)) return false;
  return true;
}

interface Finding {
  file: string;
  line: number;
  text: string;
}

function isAllowed(rel: string, text: string): boolean {
  const rules = ALLOWED[rel];
  if (!rules) return false;
  return rules.some((r) => (typeof r === 'string' ? text.trim() === r : r.test(text.trim())));
}

function scanPage(entry: string): { findings: Finding[]; files: number } {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const queue = [path.join(ROOT, entry)];

  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file) || !/\.(tsx|ts|jsx|js)$/.test(file)) continue;
    seen.add(file);
    const sf = parse(file);
    const rel = path.relative(ROOT, file);
    // The catalogues are where English is supposed to live.
    const isCatalogue = /i18n\/messages\/|config\/locales\//.test(rel);

    const inTranslatorCall = (n: ts.Node): boolean => {
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isCallExpression(p) && /^(t|pageT)$/.test(p.expression.getText(sf))) return true;
      }
      return false;
    };
    const add = (n: ts.Node, text: string) => {
      if (!looksHuman(text) || isAllowed(rel, text)) return;
      findings.push({
        file: rel,
        line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 90),
      });
    };
    const literalText = (e: ts.Expression): string | null => {
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
      if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => s.literal.text).join(' ');
      return null;
    };

    const follow = (spec: string, clause: ts.ImportClause | ts.NamedExportBindings | undefined) => {
      const r = resolve(spec, file);
      if (!r) return;
      if (r !== SDK_INDEX) return void queue.push(r);
      const map = buildExportMap(SDK_INDEX);
      const names: string[] = [];
      if (clause && ts.isImportClause(clause) && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        clause.namedBindings.elements.forEach((e) => names.push((e.propertyName ?? e.name).text));
      } else if (clause && ts.isNamedExports(clause)) {
        clause.elements.forEach((e) => names.push((e.propertyName ?? e.name).text));
      } else {
        return void queue.push(r);
      }
      names.forEach((nm) => map.has(nm) && queue.push(map.get(nm)!));
    };

    const walk = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        follow(n.moduleSpecifier.text, n.importClause);
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        follow(n.moduleSpecifier.text, n.exportClause);
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
        follow(n.arguments[0].text, undefined); // dynamic import
      }

      if (!isCatalogue) {
        if (ts.isJsxText(n)) {
          add(n, n.text);
        } else if (ts.isJsxAttribute(n) && n.initializer) {
          const name = n.name.getText(sf);
          if (!SKIP_ATTRS.has(name) && HUMAN_ATTR.test(name)) {
            if (ts.isStringLiteral(n.initializer)) add(n, n.initializer.text);
            else if (ts.isJsxExpression(n.initializer) && n.initializer.expression && !inTranslatorCall(n.initializer.expression)) {
              const t = literalText(n.initializer.expression);
              if (t !== null) add(n, t);
            }
          }
        } else if (ts.isJsxExpression(n) && n.expression && ts.isJsxElement(n.parent)) {
          const e = n.expression;
          if (!inTranslatorCall(e)) {
            const t = literalText(e);
            if (t !== null) add(n, t);
            else if (ts.isConditionalExpression(e)) {
              for (const b of [e.whenTrue, e.whenFalse]) if (ts.isStringLiteral(b)) add(n, b.text);
            }
          }
        } else if (ts.isCallExpression(n)) {
          const callee = n.expression.getText(sf);
          if (/^(toast(\.(success|error|loading|custom))?|alert|confirm|setError|setMessage|setErrorMessage|showToast|notify)$/.test(callee)) {
            const a = n.arguments[0];
            const t = a ? literalText(a) : null;
            if (t !== null) add(n, t);
          }
        }
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return { findings, files: seen.size };
}

describe('white-label pages render through the translator', () => {
  for (const [page, entry] of Object.entries(PAGES)) {
    it(`${page} has no hard-coded copy in its component tree`, () => {
      const { findings, files } = scanPage(entry);
      expect(files).toBeGreaterThan(5); // the walk followed imports at all
      const report = findings.map((f) => `${f.file}:${f.line}  ${f.text}`).join('\n');
      expect(report).toBe('');
    });
  }
});
