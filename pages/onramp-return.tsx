import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { ONRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOnramp';

/**
 * Where Coinbase sends the user when they finish, cancel, or back out.
 *
 * It has to serve two shapes, because the onramp is opened differently per
 * device. On desktop it runs inside the popup: it tells the opener and closes,
 * so the user is returned to the payment they were already looking at. On mobile
 * the whole tab went to Coinbase, so it forwards back to the page they left.
 *
 * Renders a bare holding line rather than app chrome — it exists for a fraction
 * of a second and, in the popup case, inside a 500x700 window.
 */
export default function OnrampReturnPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const raw = typeof router.query.return === 'string' ? router.query.return : '/';
    // Only ever return to a path on this origin - an absolute URL here would be
    // an open redirect, and this page's address travels through Coinbase.
    const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

    const opener = typeof window !== 'undefined' ? window.opener : null;

    if (opener && !opener.closed) {
      try {
        opener.postMessage({ type: ONRAMP_RETURN_MESSAGE }, window.location.origin);
      } catch {
        // The opener may have navigated away; closing is still the right move.
      }
      window.close();

      // window.close() is ignored for windows the script did not open, so if we
      // are still here a moment later, fall back to showing the page.
      const t = setTimeout(() => router.replace(target), 400);
      return () => clearTimeout(t);
    }

    router.replace(target);
  }, [router.isReady, router.query.return, router]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-secondary-600 dark:text-secondary-400">Returning you to StableDrop…</p>
    </div>
  );
}
