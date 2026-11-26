import { apiFetch } from '@/lib/apiFetch';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';

/**
 * Admin bulk emailer. The admin pastes a list of addresses and picks the standard message or writes
 * a custom subject and plain-text body; this page sends one email per address through
 * /api/admin/bulk-email, one every five seconds, while the tab stays open.
 *
 * ⚠️ THE CHECK THAT MATTERS IS ON THE SERVER. Hiding the form from non-admins here is only
 *    manners: /api/admin/bulk-email asks userservice, and emailservice asks again.
 */

const GAP_MS = 5000;
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/**
 * The standard message: an offer of help to anyone who signed in and may have got stuck. Worded
 * to be true for every user, buyer or seller, and to read as the opposite of a phishing email:
 * it asks for a reply, carries no link, and says what we will never ask for.
 */
export const STANDARD_SUBJECT = 'Can we help with your Stabledrop payment?';
export const STANDARD_BODY = `Hi,

You signed in to Stabledrop (stabledrop.me) recently. If you were trying to send or receive a payment and got stuck, for example buying the stablecoin, funding the payment, or confirming delivery, just reply to this email and tell us where it stopped. We'll help you finish it.

We'll never ask for your password, seed phrase or private keys, and we won't send you a link to pay. Any payment is made only on stabledrop.me.

Charlie
Stabledrop`;

type Mode = 'standard' | 'custom';
type Status = 'waiting' | 'sending' | 'sent' | 'failed' | 'skipped';
type Row = { to: string; status: Status; detail?: string };

/** Commas, semicolons, spaces or new lines between addresses; quotes, stray punctuation and duplicates dropped. */
export function parseAddresses(raw: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    const addr = piece.replace(/^["'<]+|["'>]+$/g, '').trim();
    if (!/[a-z0-9]/i.test(addr)) continue; // stray punctuation, such as the ':' of a pasted JSON list
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    (EMAIL.test(addr) ? valid : invalid).push(addr);
  }
  return { valid, invalid };
}

const sleep = (ms: number, stopped: () => boolean) =>
  new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = (): void => {
      if (stopped() || Date.now() - started >= ms) resolve();
      else setTimeout(tick, 200);
    };
    tick();
  });

async function sendOne(to: string, subject: string, body: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const response = await apiFetch('/api/admin/bulk-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, detail: response.ok ? undefined : payload.error || `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, detail: error instanceof Error ? error.message : 'Network error' };
  }
}

const card = 'bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 mb-6';
const field = 'w-full rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-900 dark:text-white';
const label = 'block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-1';

export default function AdminEmailPage() {
  const { user, isLoading } = useAuth();
  const [addresses, setAddresses] = useState('');
  const [mode, setMode] = useState<Mode>('standard');
  // The custom text is kept while the standard one is chosen, so switching back loses nothing.
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const stopRef = useRef(false);

  // Closing the tab mid-run stops the sending; say so before it happens.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white mb-4">Authentication Required</h1>
        <p className="text-secondary-600 dark:text-secondary-300 mb-6">You need to connect your wallet to access this page.</p>
        <ConnectWalletEmbedded useSmartRouting={true} />
      </div>
    );
  }

  if (user.userType !== 'admin') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-secondary-600 dark:text-secondary-300">You are not authorized to access this page.</p>
      </div>
    );
  }

  const { valid, invalid } = parseAddresses(addresses);
  const subject = mode === 'standard' ? STANDARD_SUBJECT : customSubject;
  const body = mode === 'standard' ? STANDARD_BODY : customBody;
  const ready = valid.length > 0 && subject.trim() !== '' && body.trim() !== '' && !running;
  const setRow = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const sendTest = async () => {
    if (!user.email) return;
    setTestResult('Sending…');
    const result = await sendOne(user.email, subject, body);
    setTestResult(result.ok ? `Test sent to ${user.email}.` : `Test failed: ${result.detail}`);
  };

  const run = async () => {
    const minutes = Math.ceil(((valid.length - 1) * GAP_MS) / 60000);
    if (!window.confirm(`Send "${subject.trim()}" to ${valid.length} address${valid.length === 1 ? '' : 'es'}? It takes about ${minutes} minute${minutes === 1 ? '' : 's'}; keep this tab open.`)) return;

    stopRef.current = false;
    setRunning(true);
    setRows(valid.map((to) => ({ to, status: 'waiting' })));

    for (let i = 0; i < valid.length; i++) {
      if (stopRef.current) {
        setRows((prev) => prev.map((r, j) => (j >= i ? { ...r, status: 'skipped', detail: 'Stopped' } : r)));
        break;
      }
      setRow(i, { status: 'sending' });
      const result = await sendOne(valid[i], subject, body);
      setRow(i, { status: result.ok ? 'sent' : 'failed', detail: result.detail });

      // A lost session or lost admin rights fails every address that follows; stop instead.
      if (result.status === 401 || result.status === 403) {
        setRows((prev) => prev.map((r, j) => (j > i ? { ...r, status: 'skipped', detail: 'Stopped: not signed in as an admin' } : r)));
        break;
      }
      if (i < valid.length - 1) await sleep(GAP_MS, () => stopRef.current);
    }
    setRunning(false);
  };

  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const notSent = rows.filter((r) => r.status === 'failed' || r.status === 'skipped').map((r) => r.to);
  const statusColour: Record<Status, string> = {
    waiting: 'text-secondary-500',
    sending: 'text-primary-600',
    sent: 'text-green-600',
    failed: 'text-red-600',
    skipped: 'text-amber-600',
  };

  return (
    <div className="py-10 bg-white dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-secondary-600 dark:text-secondary-300 hover:underline">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-secondary-900 dark:text-white">Email users</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-300">
            One email per address, one every {GAP_MS / 1000} seconds, through emailservice. Each person sees only their own address. Keep this tab open until it finishes.
          </p>
        </div>

        <div className={card}>
          <div className="mb-4">
            <label htmlFor="addresses" className={label}>Addresses (comma-separated)</label>
            <textarea id="addresses" rows={5} className={field} value={addresses} onChange={(e) => setAddresses(e.target.value)} disabled={running} placeholder="one@example.com, two@example.com" />
            <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
              {valid.length} address{valid.length === 1 ? '' : 'es'} to send to{invalid.length > 0 && <span className="text-red-600">; not valid, will be left out: {invalid.join(', ')}</span>}
            </p>
          </div>
          <fieldset className="mb-4">
            <legend className={label}>Message</legend>
            <div className="flex flex-wrap gap-6 text-sm">
              {([
                ['standard', 'Standard: offer of help with a payment'],
                ['custom', 'Custom: write your own'],
              ] as const).map(([value, text]) => (
                <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} disabled={running} />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'standard' ? (
            <div className="mb-4 rounded-md border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800 p-4 text-sm">
              <p className="font-semibold mb-2">Subject: {STANDARD_SUBJECT}</p>
              <p className="whitespace-pre-wrap text-secondary-700 dark:text-secondary-200">{STANDARD_BODY}</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="subject" className={label}>Subject</label>
                <input id="subject" type="text" maxLength={200} className={field} value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} disabled={running} />
              </div>
              <div className="mb-4">
                <label htmlFor="body" className={label}>Body (plain text; a blank line starts a new paragraph)</label>
                <textarea id="body" rows={10} className={field} value={customBody} onChange={(e) => setCustomBody(e.target.value)} disabled={running} />
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={run} disabled={!ready}>
              Send to {valid.length}
            </Button>
            <Button variant="outline" onClick={sendTest} disabled={!subject.trim() || !body.trim() || running || !user.email}>
              Send a test to me
            </Button>
            {running && (
              <Button variant="error" onClick={() => (stopRef.current = true)}>
                Stop
              </Button>
            )}
            {testResult && <span className="text-sm text-secondary-600 dark:text-secondary-300">{testResult}</span>}
          </div>
        </div>

        {rows.length > 0 && (
          <div className={card}>
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
              {running ? 'Sending' : 'Finished'}: {count('sent')} sent, {count('failed')} failed, {count('skipped')} not sent, {count('waiting')} waiting
            </h2>
            {!running && notSent.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-1">Not sent; paste back into the list to retry:</p>
                <textarea readOnly rows={3} className={field} value={notSent.join(', ')} />
              </div>
            )}
            <ul className="divide-y divide-secondary-200 dark:divide-secondary-700 text-sm">
              {rows.map((r) => (
                <li key={r.to} className="py-1 flex justify-between gap-4">
                  <span className="font-mono truncate">{r.to}</span>
                  <span className={statusColour[r.status]}>
                    {r.status}
                    {r.detail ? `: ${r.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
