import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';
import { emailVerificationPageGate } from '@/utils/featureFlags';

type State = 'checking' | 'verified' | 'invalid' | 'expired' | 'error';

/**
 * The emailed confirmation link.
 *
 * Public and session-free on purpose — email is opened on phones, in browsers
 * that have never seen this app. Nothing here needs a wallet: the wallet proved
 * itself before the email was sent, and opening this link proves the mailbox.
 *
 * Deliberately minimal and free of third-party resources, so the token in the
 * URL cannot leak through a referrer header to anyone else.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    const token = typeof router.query.t === 'string' ? router.query.t : '';
    if (!token) {
      setState('invalid');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/email-verification/confirm?t=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;

        if (res.ok) {
          setState('verified');
          setMessage(data.email || '');
          return;
        }

        // 410 covers both an expired link and one that is no longer pending.
        if (res.status === 410) {
          setState('expired');
          setMessage(data.error || '');
          return;
        }

        setState(res.status === 404 ? 'invalid' : 'error');
        setMessage(data.error || '');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.t]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      {state === 'checking' && (
        <>
          <Skeleton className="h-8 w-56 mx-auto mb-4" />
          <Skeleton className="h-4 w-72 mx-auto" />
        </>
      )}

      {state === 'verified' && (
        <>
          <h1 className="text-2xl font-semibold mb-3 text-secondary-900 dark:text-white">
            Email confirmed
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400 mb-8">
            {message ? `${message} is now linked to your wallet.` : 'This email is now linked to your wallet.'}
          </p>
          <Link href="/" className="text-primary-600 dark:text-primary-400 hover:underline">
            Go to StableDrop
          </Link>
        </>
      )}

      {state === 'expired' && (
        <>
          <h1 className="text-2xl font-semibold mb-3 text-secondary-900 dark:text-white">
            This link has expired
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400 mb-8">
            {message || 'Request a new one from the device where you are signed in.'}
          </p>
          <Link href="/email-verification" className="text-primary-600 dark:text-primary-400 hover:underline">
            Start again
          </Link>
        </>
      )}

      {state === 'invalid' && (
        <>
          <h1 className="text-2xl font-semibold mb-3 text-secondary-900 dark:text-white">
            This link is not valid
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Check you opened the most recent email — an older link stops working once a
            newer one is sent.
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="text-2xl font-semibold mb-3 text-secondary-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            {message || 'Try opening the link again in a moment.'}
          </p>
        </>
      )}
    </div>
  );
}

// Behind the EMAIL_VERIFICATION_LIVE release flag: 404s unless the flag is on.
export const getServerSideProps = emailVerificationPageGate;
