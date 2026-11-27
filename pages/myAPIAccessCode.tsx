import Head from 'next/head';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiOrigin } from '@/lib/useApiOrigin';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { CodeSample, SecretValue } from '@/components/developer/CopySnippets';
import SignInPrompt from '@/components/developer/SignInPrompt';
import { useLocale } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';
import type { PagesMessageKey } from '@/config/locales';

/**
 * /myAPIAccessCode — where a person gets the free access code their apps and AI assistants send to
 * the payment API and MCP server. Every "you need a code" answer those give (a 401, or an MCP tool's
 * `api_access_required`) leads here, through the API reference's "Get your free access code".
 *
 * Signed out, it signs them in first, exactly as /dashboard does. Signing in is accepting the terms
 * (the sign-in message names them and their version), and a code is only ever made for terms the
 * person's wallet has signed: when the terms have changed since they last signed in, getting a code
 * asks the wallet to sign in again (see /api/user/api-access-key) and then gives them one.
 *
 * ⚠️ THE FULL CODE IS SHOWN ONCE. userservice keeps only its hash, so the page holds the code in
 *    state until it is dismissed, then drops it. It is never written anywhere else.
 */

interface AccessCode {
  prefix: string;
  termsVersion: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  expiresAt: number;
}

interface CreatedCode extends AccessCode {
  key: string;
}

type T = (key: PagesMessageKey, vars?: Record<string, string | number>) => string;

/** A translated sentence with some placeholders shown as code; translated whole, code spliced in. */
function withCode(template: string, code: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return name && name in code ? (
      <code key={i} className="font-mono break-all">
        {code[name]}
      </code>
    ) : (
      part
    );
  });
}

async function failure(res: Response, fallback: PagesMessageKey, t: T): Promise<string> {
  if (res.status === 400) {
    try {
      const body = await res.json();
      if (typeof body?.error === 'string' && /wallet/i.test(body.error)) return t('accessCode.error.noWallet');
    } catch {
      // Not JSON: the general message below says enough.
    }
  }
  return t(fallback);
}

export default function MyApiAccessCodePage() {
  const t = usePageT();
  const tRef = useRef(t);
  tRef.current = t;
  const locale = useLocale();
  const origin = useApiOrigin();
  const { isLoading, isConnected, authenticatedFetch } = useAuth();
  // authenticatedFetch signs the wallet in again on a 401 and retries; held in a ref so a new
  // identity on re-render does not reload the code.
  const fetchRef = useRef(authenticatedFetch);
  fetchRef.current = authenticatedFetch;

  const [current, setCurrent] = useState<AccessCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [getting, setGetting] = useState(false);
  const [getError, setGetError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCode | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchRef.current('/api/user/api-access-key');
      if (!res.ok) throw new Error(await failure(res, 'accessCode.error.load', tRef.current));
      const body = await res.json();
      setCurrent(body?.current ?? null);
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : tRef.current('accessCode.error.load'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) load();
  }, [isConnected, load]);

  const getCode = async () => {
    setGetting(true);
    setGetError(null);
    try {
      const res = await fetchRef.current('/api/user/api-access-key', { method: 'POST', body: '{}' });
      if (!res.ok) throw new Error(await failure(res, 'accessCode.error.get', t));
      const body = (await res.json()) as CreatedCode;
      setCreated(body);
      setCurrent({ prefix: body.prefix, termsVersion: body.termsVersion, createdAt: body.createdAt, expiresAt: body.expiresAt });
    } catch (e) {
      // Still refused after signing in again: the sign-in did not accept the current terms (an old
      // page left open across a release, say). Signing out and in again fixes that.
      const signInFailed = e instanceof Error && /AuthenticationExpired|WalletSigning/.test(e.name);
      setGetError(signInFailed ? t('accessCode.error.terms') : e instanceof Error && e.message ? e.message : t('accessCode.error.get'));
    } finally {
      setGetting(false);
    }
  };

  const stop = async () => {
    setStopping(true);
    setStopError(null);
    try {
      const res = await fetchRef.current('/api/user/api-access-key', { method: 'DELETE' });
      // 404: there was nothing to stop, which is what was asked for.
      if (!res.ok && res.status !== 404) throw new Error(t('accessCode.error.stop'));
      setCurrent(null);
      setCreated(null);
    } catch (e) {
      setStopError(e instanceof Error && e.message ? e.message : t('accessCode.error.stop'));
    } finally {
      setStopping(false);
      setConfirmingStop(false);
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
      <>
        <Head>
          <title>{t('accessCode.signIn.title')}</title>
        </Head>
        <SignInPrompt
          eyebrow={t('accessCode.signIn.eyebrow')}
          title={t('accessCode.signIn.title')}
          body={t('accessCode.signIn.body')}
        />
      </>
    );
  }

  const code = created ? created.key : 'sd_access_…';
  const header = `Authorization: Bearer ${code}`;
  const mcpUrl = `${origin}/api/ap2/mcp`;
  const claudeCommand = `claude mcp add --transport http stabledrop ${mcpUrl} \\\n  --header "${header}"`;
  // The reference's section on access codes, in ReDoc, which links a section by its heading. The
  // Spanish heading differs, so the Spanish reference opens at its top.
  const guideHref =
    locale === 'es'
      ? `${origin}/api/ap2/settle/doc?redoc&lang=es`
      : `${origin}/api/ap2/settle/doc?redoc#section/Get-your-free-access-code`;
  const expires = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' });

  return (
    <>
      <Head>
        <title>{t('accessCode.title')}</title>
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors min-h-screen">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-24 lg:pt-32 pb-16">
          <h1 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-1">{t('accessCode.title')}</h1>
          <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8">{t('accessCode.intro')}</p>

          {created && (
            <div
              role="alert"
              className="mb-8 rounded-lg border-2 border-primary-500 bg-primary-50 dark:bg-secondary-800 p-4"
              data-testid="new-access-code"
            >
              <p className="text-sm font-semibold text-secondary-900 dark:text-white mb-1">{t('accessCode.new.title')}</p>
              <p className="text-sm text-secondary-700 dark:text-secondary-200 mb-3">{t('accessCode.new.warning')}</p>
              <SecretValue value={created.key} copyLabel={t('accessCode.new.copy')} />
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                  {t('accessCode.new.dismiss')}
                </Button>
              </div>
            </div>
          )}

          <section className="mb-10 rounded-lg border border-secondary-200 dark:border-secondary-700 p-4" data-testid="current-access-code">
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white mb-2">{t('accessCode.current.title')}</h2>
            {loadError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                {loadError}{' '}
                <button type="button" className="underline" onClick={load}>
                  {t('accessCode.retry')}
                </button>
              </p>
            ) : loading && !current ? (
              <SkeletonCard />
            ) : current ? (
              <p className="text-sm text-secondary-600 dark:text-secondary-300 font-mono">
                {t('accessCode.current.meta', { prefix: current.prefix, expires: expires(current.expiresAt) })}
              </p>
            ) : (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">{t('accessCode.current.none')}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={getCode} disabled={getting}>
                {getting ? t('accessCode.get.busy') : current ? t('accessCode.get.again') : t('accessCode.get.first')}
              </Button>
              {current &&
                (confirmingStop ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-secondary-600 dark:text-secondary-300">{t('accessCode.stop.confirm')}</span>
                    <Button size="sm" variant="error" onClick={stop} disabled={stopping}>
                      {stopping ? t('accessCode.stop.busy') : t('accessCode.stop.yes')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingStop(false)} disabled={stopping}>
                      {t('accessCode.stop.cancel')}
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmingStop(true)}>
                    {t('accessCode.stop.button')}
                  </Button>
                ))}
            </div>
            {current && !created && (
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-2">{t('accessCode.get.replaces')}</p>
            )}
            {getError && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300 mt-3" data-testid="access-code-error">
                {getError}
              </p>
            )}
            {stopError && <p className="text-sm text-red-700 dark:text-red-300 mt-3">{stopError}</p>}
          </section>

          <section>
            <h2 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">{t('accessCode.use.title')}</h2>

            <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-2">{t('accessCode.use.assistant')}</h3>
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-3">{t('accessCode.use.assistantBody')}</p>
            <CodeSample>{claudeCommand}</CodeSample>
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-3">
              {withCode(t('accessCode.use.assistantOther'), { url: mcpUrl, header })}
            </p>
            <p className="text-sm text-secondary-600 dark:text-secondary-400 mt-3 mb-6">
              {withCode(t('accessCode.use.connector'), { url: `${mcpUrl}?code=${code}` })}
            </p>

            <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-2">{t('accessCode.use.app')}</h3>
            <p className="text-sm text-secondary-600 dark:text-secondary-400">{withCode(t('accessCode.use.appBody'), { header })}</p>

            <a
              href={guideHref}
              target="_blank"
              rel="noopener"
              className="inline-block mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 underline"
            >
              {t('accessCode.use.guide')}
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
