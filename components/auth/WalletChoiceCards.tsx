import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';

const CARD_BUTTON =
  'w-full rounded-lg border border-secondary-300 dark:border-secondary-600 px-6 py-3 text-sm font-semibold ' +
  'text-secondary-900 dark:text-white hover:bg-secondary-50 dark:hover:bg-secondary-800 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

interface WalletChoiceCardsProps {
  /** Forwarded to the "connect existing wallet" path only. */
  autoConnect?: boolean;
  /** Called when any of the three connect paths reports success. */
  onSuccess?: () => void;
  className?: string;
}

/**
 * The signed-out wallet gate: "I have a crypto wallet" beside "No crypto
 * wallet?", with the three ways in (connect a wallet, skip connecting it, or
 * social/email only).
 *
 * Shared by /create (seller getting started) and /contract-pay (buyer about to
 * pay) so the two sides of a request present an identical way in. Everything
 * around it — headings, progress steps, payment summary — belongs to the page.
 */
export default function WalletChoiceCards({
  autoConnect = false,
  onSuccess,
  className = 'mt-10 grid gap-5 sm:grid-cols-2',
}: WalletChoiceCardsProps) {
  return (
    <div className={className}>
      <div className="rounded-2xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
          I have a crypto wallet
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed flex-1">
          Connect an existing wallet like MetaMask or Coinbase Wallet.
        </p>
        <ConnectWalletEmbedded
          compact
          connectionMode="wallet-only"
          useSmartRouting={false}
          autoConnect={autoConnect}
          buttonText="Connect existing wallet"
          className="mt-6"
          buttonClassName={CARD_BUTTON}
          onSuccess={onSuccess}
        />
        {/* Escape hatch for people who have a wallet but would rather not
            connect it - same social/email path as "Continue without wallet". */}
        <ConnectWalletEmbedded
          compact
          connectionMode="social-only"
          useSmartRouting={false}
          buttonText="Don't connect my wallet"
          className="mt-3"
          buttonClassName={CARD_BUTTON}
          onSuccess={onSuccess}
        />
      </div>

      <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
          No crypto wallet?
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed flex-1">
          Continue with email or social login &ndash; we&apos;ll create a secure wallet for you
          automatically
        </p>
        <ConnectWalletEmbedded
          compact
          connectionMode="social-only"
          useSmartRouting={false}
          buttonText="Continue without wallet"
          className="mt-6"
          buttonClassName={CARD_BUTTON}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
}
