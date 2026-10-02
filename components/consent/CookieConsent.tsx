import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ConsentChoice,
  OPEN_CONSENT_EVENT,
  disableAnalytics,
  loadAnalytics,
  readConsent,
  writeConsent,
} from '@/lib/consent';

/**
 * Asks once, remembers the answer in a cookie, and only then loads analytics.
 * Accept and Reject sit side by side at equal weight — regulators treat a
 * harder-to-find reject as no real choice.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const choice = readConsent();
    if (choice === 'granted') loadAnalytics();
    if (choice === null) setOpen(true);

    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const choose = (choice: ConsentChoice) => {
    writeConsent(choice);
    if (choice === 'granted') loadAnalytics();
    else disableAnalytics();
    setOpen(false);
  };

  if (!open) return null;

  const button =
    'flex-1 sm:flex-none rounded-md px-4 py-2 text-sm font-semibold transition-colors border border-secondary-300 dark:border-secondary-600 text-secondary-900 dark:text-white bg-white dark:bg-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-700';

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[1000] p-4 sm:p-6"
    >
      <div className="max-w-3xl mx-auto rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-secondary-700 dark:text-secondary-200 flex-1">
          We use essential cookies to keep you signed in. With your permission we&rsquo;d also use Google
          Analytics cookies to understand how the site is used.{' '}
          <Link href="/privacy-policy#cookies" className="underline hover:text-secondary-900 dark:hover:text-white">
            Cookie details
          </Link>
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => choose('denied')} className={button}>
            Reject
          </button>
          <button type="button" onClick={() => choose('granted')} className={button}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
