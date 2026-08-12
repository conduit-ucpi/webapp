import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';

const CARD_BUTTON =
  'w-full rounded-lg border border-secondary-300 dark:border-secondary-600 px-6 py-3 text-sm font-semibold ' +
  'text-secondary-900 dark:text-white hover:bg-secondary-50 dark:hover:bg-secondary-800 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/* Deliberately quiet next to the card button - this is the escape hatch for
   people who know what a wallet connector is, not the path we steer anyone to. */
const ADVANCED_BUTTON =
  'text-sm font-medium text-secondary-600 dark:text-secondary-400 underline underline-offset-4 ' +
  'hover:text-secondary-900 dark:hover:text-white ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

interface WalletChoiceCardsProps {
  /** Forwarded to the "advanced wallet connection" path only. */
  autoConnect?: boolean;
  /** Called when either connect path reports success. */
  onSuccess?: () => void;
  className?: string;
}

/**
 * The signed-out wallet gate: email/social sign-in as the way in for everyone,
 * with "Advanced wallet connection" underneath for people who want to pick a
 * wallet connector themselves (MetaMask, Coinbase Wallet, WalletConnect QR).
 *
 * Shared by /create (seller getting started) and /contract-pay (buyer about to
 * pay) so the two sides of a request present an identical way in. Everything
 * around it — headings, progress steps, payment summary — belongs to the page.
 */
export default function WalletChoiceCards({
  autoConnect = false,
  onSuccess,
  className = 'mt-10 mx-auto w-full max-w-md',
}: WalletChoiceCardsProps) {
  return (
    <div className={className}>
      <div className="rounded-2xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
          Sign in to set up your wallet
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
          We&apos;ll create a secure wallet that only you control, or reconnect the one you
          already have. Nothing to install.
        </p>
        <ConnectWalletEmbedded
          compact
          connectionMode="social-only"
          useSmartRouting={false}
          buttonText="Continue with email or social login"
          className="mt-6"
          buttonClassName={CARD_BUTTON}
          onSuccess={onSuccess}
        />
      </div>

      {/* Opens the connector modal in wallet-only mode - no social/email tiles. */}
      <ConnectWalletEmbedded
        compact
        connectionMode="wallet-only"
        useSmartRouting={false}
        autoConnect={autoConnect}
        buttonText="Advanced wallet connection"
        className="mt-5"
        buttonClassName={ADVANCED_BUTTON}
        onSuccess={onSuccess}
      />
    </div>
  );
}
