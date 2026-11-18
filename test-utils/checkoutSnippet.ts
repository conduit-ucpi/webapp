/**
 * Runs a published checkout snippet the way a merchant's browser would, against the real
 * public/conduit-checkout.js. A snippet passes only if what someone pastes actually works:
 * the script it loads is a file we serve, init() accepts its options, and each of its buttons
 * opens our checkout page for that payment.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const SDK_CODE = fs.readFileSync(path.join(ROOT, 'public/conduit-checkout.js'), 'utf8');

export interface SnippetRun {
  /** Every <script src> in the snippet, as written. */
  scriptSrcs: string[];
  /** The options init() was called with, or null if the snippet never called it. */
  initOptions: Record<string, unknown> | null;
  /** The checkout URL each button opened, in the order the buttons appear. */
  opened: URL[];
}

/** The files a snippet's <script src> may name: what public/ actually serves. */
function assertServed(src: string, allowedOrigins: string[]) {
  const url = new URL(src);
  if (!allowedOrigins.includes(url.origin)) {
    throw new Error(`${src} loads from ${url.origin}, expected one of ${allowedOrigins.join(', ')}`);
  }
  const file = path.join(ROOT, 'public', url.pathname);
  if (!fs.existsSync(file)) throw new Error(`${src} names ${url.pathname}, which public/ does not serve`);
}

/**
 * @param snippet HTML (or bare JS, for a fragment that goes inside a <script>) as the page shows it.
 * @param allowedOrigins where the SDK may be loaded from, and where init()'s baseUrl may point.
 * @param inputs values to type into the snippet's inputs before clicking, by element id.
 */
export function runCheckoutSnippet(
  snippet: string,
  { allowedOrigins, inputs = {} }: { allowedOrigins: string[]; inputs?: Record<string, string> }
): SnippetRun {
  const isHtml = /^\s*</.test(snippet);
  const doc = document.implementation.createHTMLDocument('merchant');
  doc.body.innerHTML = isHtml ? snippet : `<script>${snippet}</script>`;

  const opened: URL[] = [];
  const win: Record<string, unknown> = {
    location: { href: 'https://merchant.example/shop' },
    screen: { width: 1920, height: 1080 },
    open: (u: string) => {
      opened.push(new URL(u));
      return { closed: false, close() {}, focus() {} };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const quiet = { log() {}, warn() {}, error() {}, info() {} };
  new Function('window', 'console', SDK_CODE)(win, quiet);
  const sdk = win.ConduitCheckout as { init: (o: Record<string, unknown>) => void; config: Record<string, unknown> };

  let initOptions: Record<string, unknown> | null = null;
  const realInit = sdk.init.bind(sdk);
  sdk.init = (o) => {
    initOptions = o;
    realInit(o);
  };

  const run = (code: string) =>
    new Function('window', 'document', 'ConduitCheckout', 'console', code)(win, doc, sdk, quiet);

  const scriptSrcs: string[] = [];
  doc.querySelectorAll('script').forEach((s) => {
    const src = s.getAttribute('src');
    if (src) {
      scriptSrcs.push(src);
      assertServed(src, allowedOrigins);
    } else {
      run(s.textContent || '');
    }
  });

  for (const [id, value] of Object.entries(inputs)) {
    const el = doc.getElementById(id) as HTMLInputElement | null;
    if (!el) throw new Error(`the snippet has no #${id} to fill in`);
    el.value = value;
  }

  doc.querySelectorAll('[onclick]').forEach((el) => run(el.getAttribute('onclick') || ''));

  if (initOptions) {
    const base = new URL(String(sdk.config.baseUrl));
    if (!allowedOrigins.includes(base.origin)) {
      throw new Error(`init() points baseUrl at ${base.origin}, expected one of ${allowedOrigins.join(', ')}`);
    }
  }
  for (const u of opened) {
    // The page the popup opens must be one the site has.
    if (!fs.existsSync(path.join(ROOT, 'pages', `${u.pathname}.tsx`))) {
      throw new Error(`the checkout opened ${u.pathname}, which is not a page`);
    }
  }

  return { scriptSrcs, initOptions, opened };
}
