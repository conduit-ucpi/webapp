import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, API_BASE } from '@/lib/apiFetch';
import { useAuth } from '@/components/auth';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { usePageT } from '@/config/locales';
import type { PagesMessageKey } from '@/config/locales';

/**
 * API keys: what a merchant's own backend sends to create payment links without a browser.
 *
 * The merchant makes a key here, signed in; their server then calls
 * `POST {api}/api/ap2/request` with `Authorization: Bearer sd_live_...` and sends the returned
 * `pay_link` to their customer (on WhatsApp, by email, wherever). userservice owns the keys; this
 * page goes through /api/user/api-keys, which carries the session across.
 *
 * ⚠️ THE FULL KEY IS SHOWN ONCE. userservice returns it only in the response that creates it and
 *    stores nothing it could show again, so the page holds it in state until the merchant
 *    dismisses it, then drops it. It is never written anywhere else.
 */

interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds; null until the key is first used. */
  lastUsedAt: number | null;
}

interface CreatedKey extends ApiKey {
  key: string;
}

const LABEL_MAX = 60;

/** The deployed API host where API_BASE is empty (the box build), as /integrate does. */
const API_ORIGIN = API_BASE || 'https://api.stabledrop.me';

type T = (key: PagesMessageKey, vars?: Record<string, string | number>) => string;

/** userservice's timestamps are Unix seconds; null means it has not happened (a key never used). */
function formatWhen(seconds: number | null | undefined, t: T): string {
  if (seconds === null || seconds === undefined) return t('apiKeys.list.never');
  return new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * A translated sentence with some of its placeholders shown as code. The words around them move
 * between languages, so the sentence is translated whole and the code spliced in afterwards —
 * never assembled from fragments.
 */
function withCode(template: string, code: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return name && name in code ? (
      <code key={i} className="font-mono">
        {code[name]}
      </code>
    ) : (
      part
    );
  });
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    return (
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message) ||
      ''
    );
  } catch {
    return '';
  }
}

/** Turn userservice's refusal into something the merchant can act on. */
async function describeKeyFailure(res: Response, action: 'create' | 'load' | 'revoke', t: T): Promise<string> {
  const detail = await errorDetail(res);
  if (res.status === 401) return t('apiKeys.error.session');
  if (action === 'create' && res.status === 409) return t('apiKeys.error.limit');
  if (action === 'create' && res.status === 400 && /wallet/i.test(detail)) {
    return t('apiKeys.error.noWallet');
  }
  if (action === 'revoke' && res.status === 404) return t('apiKeys.error.gone');
  const fallback = t(`apiKeys.error.${action}`);
  return detail ? `${detail} (${res.status})` : `${fallback} (${res.status})`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = usePageT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  };
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy}>
      {copied ? t('apiKeys.copied') : label ?? t('apiKeys.copy')}
    </Button>
  );
}

function CodeSample({ children }: { children: string }) {
  return (
    <div className="relative rounded-md border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800 p-4 pr-20 overflow-x-auto">
      <div className="absolute top-3 right-3">
        <CopyButton text={children} />
      </div>
      <pre className="m-0">
        <code className="text-sm font-mono text-secondary-900 dark:text-secondary-100 whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

function KeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (id: string) => Promise<void> }) {
  const t = usePageT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    setBusy(true);
    try {
      await onRevoke(apiKey.id);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid="api-key-row">
      <div className="min-w-0">
        <div className="text-sm font-medium text-secondary-900 dark:text-white truncate">{apiKey.label}</div>
        <div className="font-mono text-xs text-secondary-600 dark:text-secondary-300 mt-0.5">{apiKey.prefix}…</div>
        <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
          {t('apiKeys.list.meta', {
            created: formatWhen(apiKey.createdAt, t),
            lastUsed: formatWhen(apiKey.lastUsedAt, t),
          })}
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-secondary-600 dark:text-secondary-300">{t('apiKeys.revoke.confirm')}</span>
          <Button size="sm" variant="error" onClick={revoke} disabled={busy}>
            {busy ? t('apiKeys.revoke.busy') : t('apiKeys.revoke.yes')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            {t('apiKeys.revoke.cancel')}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          {t('apiKeys.revoke.button')}
        </Button>
      )}
    </li>
  );
}

export default function ApiKeysPage() {
  const t = usePageT();
  // The locale resolves after first render, which gives `t` a new identity. Read through a ref so
  // that switching language re-renders the page without fetching the keys a second time.
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoading, isConnected, user } = useAuth();
  const wallet = user?.walletAddress || null;

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedKey | null>(null);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    setListError(null);
    try {
      const res = await apiFetch('/api/user/api-keys');
      if (!res.ok) throw new Error(await describeKeyFailure(res, 'load', tRef.current));
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : tRef.current('apiKeys.error.load'));
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) loadKeys();
  }, [isConnected, loadKeys]);

  const trimmed = label.trim();

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiFetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await describeKeyFailure(res, 'create', t));
      const data = (await res.json()) as CreatedKey;
      setCreated(data);
      setLabel('');
      // The list never carries the secret: only the public fields go there.
      const listed: ApiKey = { id: data.id, label: data.label, prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null };
      setKeys((current) => [listed, ...current.filter((k) => k.id !== data.id)]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('apiKeys.error.create'));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setRevokeError(null);
    try {
      const res = await apiFetch(`/api/user/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(await describeKeyFailure(res, 'revoke', t));
      // A 404 means it is already gone: either way it no longer belongs in the list.
      setKeys((current) => current.filter((k) => k.id !== id));
      if (created?.id === id) setCreated(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : t('apiKeys.error.revoke'));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-[80vh] flex items-center">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 w-full text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
            {t('apiKeys.signIn.eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4">
            {t('apiKeys.signIn.title')}
          </h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">
            {t('apiKeys.signIn.body')}
          </p>
          <ConnectWalletEmbedded useSmartRouting={true} />
        </div>
      </div>
    );
  }

  const curl = `curl -X POST ${API_ORIGIN}/api/ap2/request \\
  -H "Authorization: Bearer sd_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 20000000, "expiry_timestamp": 0, "description": "Order #123"}'`;

  return (
    <>
      <Head>
        <title>{t('apiKeys.title')}</title>
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-screen">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-1">{t('apiKeys.title')}</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8">
            {t('apiKeys.intro')}
          </p>

          {/* Every key pays into the wallet the account had when the key was made, so the merchant
              needs to know which one, and where to go to take the money out. */}
          <section
            className="mb-8 rounded-lg border border-secondary-200 dark:border-secondary-700 p-4"
            data-testid="payout-wallet"
          >
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">{t('apiKeys.wallet.title')}</h2>
            {wallet ? (
              <>
                <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-3">
                  {t('apiKeys.wallet.body')}
                </p>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <code className="flex-1 min-w-0 break-all rounded-md border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800 px-3 py-2 font-mono text-sm text-secondary-900 dark:text-white">
                    {wallet}
                  </code>
                  <CopyButton text={wallet} label={t('apiKeys.wallet.copy')} />
                </div>
                <Link href="/wallet" className="text-sm font-medium text-primary-600 dark:text-primary-400 underline">
                  {t('apiKeys.wallet.link')}
                </Link>
              </>
            ) : (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                {t('apiKeys.wallet.none')}
              </p>
            )}
          </section>

          {created && (
            <div
              role="alert"
              className="mb-8 rounded-lg border-2 border-primary-500 bg-primary-50 dark:bg-secondary-800 p-4"
              data-testid="new-api-key"
            >
              <p className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">
                {t('apiKeys.new.title', { label: created.label })}
              </p>
              <p className="text-sm text-secondary-700 dark:text-secondary-200 mb-3">
                {t('apiKeys.new.warning')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-md border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 font-mono text-sm text-secondary-900 dark:text-white">
                  {created.key}
                </code>
                <CopyButton text={created.key} label={t('apiKeys.new.copy')} />
              </div>
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                  {t('apiKeys.new.dismiss')}
                </Button>
              </div>
            </div>
          )}

          <section className="mb-10">
            <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('apiKeys.create.title')}</h2>
            <form onSubmit={create} className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1">
                <Input
                  aria-label={t('apiKeys.create.labelAria')}
                  placeholder={t('apiKeys.create.placeholder')}
                  value={label}
                  maxLength={LABEL_MAX}
                  onChange={(e) => setLabel(e.target.value)}
                  helpText={t('apiKeys.create.help')}
                  error={createError || undefined}
                />
              </div>
              <Button type="submit" disabled={creating || !trimmed}>
                {creating ? t('apiKeys.create.submitting') : t('apiKeys.create.submit')}
              </Button>
            </form>
          </section>

          <section className="mb-10">
            <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('apiKeys.list.title')}</h2>
            {revokeError && (
              <div className="mb-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
                {revokeError}
              </div>
            )}
            {listError ? (
              <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
                {listError}{' '}
                <button type="button" className="underline" onClick={loadKeys}>
                  {t('apiKeys.list.retry')}
                </button>
              </div>
            ) : loadingKeys && keys.length === 0 ? (
              <SkeletonCard />
            ) : keys.length === 0 ? (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">{t('apiKeys.list.empty')}</p>
            ) : (
              <ul className="rounded-lg border border-secondary-200 dark:border-secondary-700 divide-y divide-secondary-200 dark:divide-secondary-700">
                {keys.map((k) => (
                  <KeyRow key={k.id} apiKey={k} onRevoke={revoke} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('apiKeys.using.title')}</h2>
            <CodeSample>{curl}</CodeSample>
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-3">
              {withCode(t('apiKeys.using.body'), {
                payLink: 'pay_link',
                amount: 'amount',
                expiry: 'expiry_timestamp',
              })}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
