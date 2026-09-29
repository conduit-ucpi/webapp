import { useEffect, useState } from 'react';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { useAuth } from '@/components/auth';
import { useT } from '../../i18n';
import { isInIframe } from '@/utils/deviceDetection';

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
  const t = useT();
  const { canConnectLegacyWallet } = useAuth();
  /* The rescue route for people who signed up under the previous wallet provider: their
     email/social login there opened a different wallet, and only that provider can open it
     again. Ticked, the same button signs in the old way so /wallet can move the funds out. */
  const [legacyWallet, setLegacyWallet] = useState(false);
  const offerLegacy = canConnectLegacyWallet?.() === true;

  /* Inside a partner's iframe Google and Apple cannot sign in — both refuse to render in a
     frame, and Privy has no popup mode — so PrivyProvider drops them and this card says
     "email" and offers the same page in a new tab, where they work. `?b=` rides along in the
     URL, so the tab keeps the partner's branding. Set after mount: the static export renders
     unframed, and reading window during render would mismatch on hydration. */
  const [newTabHref, setNewTabHref] = useState<string | null>(null);
  useEffect(() => {
    if (isInIframe()) setNewTabHref(window.location.href);
  }, []);

  return (
    <div className={className}>
      <div className="rounded-2xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
          {t('wallet.signInTitle')}
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
          {t('wallet.signInBlurb')}
        </p>
        <ConnectWalletEmbedded
          compact
          connectionMode="social-only"
          useSmartRouting={false}
          buttonText={t(newTabHref ? 'wallet.continueEmail' : 'wallet.continueSocial')}
          className="mt-6"
          buttonClassName={CARD_BUTTON}
          onSuccess={onSuccess}
          legacyWallet={legacyWallet}
        />
        {newTabHref && (
          <a
            href={newTabHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-4 self-center ${ADVANCED_BUTTON}`}
          >
            {t('wallet.socialNewTab')}
          </a>
        )}
        {offerLegacy && (
          <label className="mt-4 flex items-start gap-2 text-sm text-secondary-600 dark:text-secondary-400 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={legacyWallet}
              onChange={(e) => setLegacyWallet(e.target.checked)}
              aria-describedby="legacy-wallet-hint"
            />
            <span>
              {t('wallet.legacyWallet')}
              <span id="legacy-wallet-hint" className="block text-xs text-secondary-500 dark:text-secondary-500 mt-0.5">
                {t('wallet.legacyWalletHint')}
              </span>
            </span>
          </label>
        )}
      </div>

      {/* Opens the connector modal in wallet-only mode - no social/email tiles. */}
      <ConnectWalletEmbedded
        compact
        connectionMode="wallet-only"
        useSmartRouting={false}
        autoConnect={autoConnect}
        buttonText={t('wallet.advanced')}
        className="mt-5"
        buttonClassName={ADVANCED_BUTTON}
        onSuccess={onSuccess}
      />
    </div>
  );
}
