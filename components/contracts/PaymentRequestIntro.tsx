import Button from '@/components/ui/Button';

interface PaymentRequestIntroProps {
  /** Advances to the payment-method choice. */
  onContinue: () => void;
}

/**
 * The first thing a buyer sees after following a payment link from an email or
 * QR code.
 *
 * It deliberately shows no amount, sender or description: the contract is only
 * readable once the buyer is authenticated (GET /api/contracts/[id] requires
 * auth, and usePayableContract holds off until a wallet is connected), so at
 * this point the page genuinely knows nothing about the request beyond its id.
 * The job here is to explain what has arrived and what happens next, so the
 * hand-off to sign-in doesn't feel like a demand from a stranger.
 */
export default function PaymentRequestIntro({ onContinue }: PaymentRequestIntroProps) {
  const steps = [
    'Add stablecoin to your wallet, or connect one you already have',
    "Confirm the payment — it's held securely in escrow, not sent directly",
    'Funds release to the seller automatically — nothing else needed from you',
  ];

  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-secondary-100 dark:bg-secondary-800 grid place-items-center">
        <svg
          className="w-9 h-9 text-secondary-500 dark:text-secondary-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>

      <p className="mt-6 text-sm text-secondary-500 dark:text-secondary-400">You&apos;ve received a</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white">
        Payment request
      </h1>
      <p className="mt-3 text-sm text-secondary-500 dark:text-secondary-400">
        Continue to see who sent it, how much they&apos;ve asked for, and what it&apos;s for.
      </p>

      <div className="mt-8 rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 p-6 text-left">
        <h2 className="text-base font-semibold text-secondary-900 dark:text-white">How this works</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 grid place-items-center w-7 h-7 rounded-full bg-secondary-100 dark:bg-secondary-700 text-xs font-semibold text-secondary-700 dark:text-secondary-200">
                {i + 1}
              </span>
              <span className="text-sm text-secondary-600 dark:text-secondary-300 leading-6">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <Button type="button" onClick={onContinue} size="lg" className="mt-6 w-full rounded-lg">
        See details &amp; pay
      </Button>

      <p className="mt-4 text-xs text-secondary-400 dark:text-secondary-500">
        Don&apos;t have a crypto wallet? We&apos;ll create one for you — no download needed.
      </p>
    </div>
  );
}
