/**
 * Masks personal data in anything the server writes to its log.
 *
 * ⚠️ ONE CHOKE POINT, NOT A RULE AT EVERY CALL SITE. The API routes log request bodies, upstream
 *    response bodies and identity lookups in dozens of places, and the log shipper only drops
 *    credentials — so emails and wallets went to Grafana verbatim (2026-09-24: every identity
 *    call logged the user's email, wallet and userType). Fixing each call site leaves the next
 *    new console.log leaking again; masking at the console does not. See instrumentation.ts.
 *
 * Masked, keeping enough to correlate lines while debugging:
 *   emails     charliepank@gmail.com                       → ch***@gmail.com
 *   addresses  0xd36698991ef328275c8f9598a33b2378d7ece183  → 0xd366***e183
 * Transaction hashes (64 hex digits) are not personal and are left alone.
 *
 * Credentials are masked outright — JWTs (session tokens), Bearer/Basic values, and the value of
 * any auth-token / privy-* / session / api-key / password field. Same rules as the services'
 * PiiMaskingLayout and the log shipper.
 */

const EMAIL = /([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
// Exactly 40 hex digits: \b on both sides stops it matching inside a 64-digit tx hash.
const ADDRESS = /\b0x[0-9a-fA-F]{40}\b/g;
const MAX_DEPTH = 8;

// A JWT, whole or truncated: AUTH-TOKEN, privy-token, Bearer values.
const JWT = /eyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+){0,2}/g;
const BEARER = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
// The value after a credential's name — cookie header, object dump, JSON or query string.
const CREDENTIAL = /\b(auth-token|privy-token|privy-id-token|privy-refresh-token|session-?token|session|x-api-key|api[_-]?key|password|secret)(["']?\s*[=:]\s*["']?)[^;,\s'"&}]{4,}/gi;

export function maskCredentials(text: string): string {
  return text
    .replace(BEARER, (_, scheme: string) => `${scheme} ***`)
    .replace(JWT, 'eyJ***')
    .replace(CREDENTIAL, (_, name: string, sep: string) => `${name}${sep}***`);
}

export function maskEmail(email: string): string {
  return email.replace(EMAIL, (_, local: string, domain: string) => `${local.slice(0, 2)}***@${domain}`);
}

export function maskAddress(address: string): string {
  return address.replace(ADDRESS, (a) => `${a.slice(0, 6)}***${a.slice(-4)}`);
}

export function redactString(text: string): string {
  return maskAddress(maskEmail(maskCredentials(text)));
}

const CREDENTIAL_KEY = /^(authorization|cookie|set-cookie|x-api-key|api[_-]?key|auth-?token|privy-[a-z-]*token|session-?token|password|secret)$/i;

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A copy of [value] with personal data masked. Strings, arrays, plain objects and Errors are
 * walked; anything else (Buffers, Dates, class instances, Responses) is passed through as it is,
 * because re-building it would change what gets printed. Never mutates its input.
 */
export function redact(value: unknown, depth = 0, seen: WeakMap<object, unknown> = new WeakMap()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Error) {
    const copy = new Error(redactString(value.message));
    seen.set(value, copy);
    copy.name = value.name;
    copy.stack = value.stack === undefined ? undefined : redactString(value.stack);
    for (const key of Object.keys(value)) {
      (copy as unknown as Record<string, unknown>)[key] = redact((value as unknown as Record<string, unknown>)[key], depth + 1, seen);
    }
    if ('cause' in value) (copy as Error & { cause?: unknown }).cause = redact((value as Error & { cause?: unknown }).cause, depth + 1, seen);
    return copy;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(redact(item, depth + 1, seen));
    return copy;
  }

  if (!isPlainObject(value)) return value;

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    // `{ Authorization: 'Bearer …' }` / `{ cookie: '…' }` / `{ apiKey: '…' }`: the key says what it is.
    copy[key] = CREDENTIAL_KEY.test(key) && typeof item === 'string' ? '***' : redact(item, depth + 1, seen);
  }
  return copy;
}

const INSTALLED = Symbol.for('conduit.logRedaction');
const METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/** Route every console method through [redact]. Safe to call more than once. */
export function installLogRedaction(target: Console = console): void {
  const flagged = target as Console & { [INSTALLED]?: boolean };
  if (flagged[INSTALLED]) return;
  for (const method of METHODS) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(...args.map((arg) => redact(arg)));
  }
  flagged[INSTALLED] = true;
}
