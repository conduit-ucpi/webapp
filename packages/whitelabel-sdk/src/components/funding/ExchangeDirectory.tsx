import { useEffect, useState } from 'react';
import { EXCHANGE_REGIONS, exchangesIn, type Exchange, type ExchangeRegionId } from '@/lib/exchangeDirectory';
import { visitorCountry } from '@/lib/visitorCountry';
import { useT, withNodes, type MessageKey } from '../../i18n';
import WalletAddressBox from './WalletAddressBox';

const REGION_LABEL: Record<ExchangeRegionId, MessageKey> = {
  worldwide: 'funding.region.worldwide',
  'card-services': 'funding.region.cardServices',
  'north-america': 'funding.region.northAmerica',
  oceania: 'funding.region.oceania',
  europe: 'funding.region.europe',
  'latin-america': 'funding.region.latinAmerica',
  'africa-middle-east': 'funding.region.africaMiddleEast',
  asia: 'funding.region.asia',
};

/** Said under a region's name, where it is not used the way the others are. */
const REGION_NOTE: Partial<Record<ExchangeRegionId, MessageKey>> = {
  'card-services': 'funding.region.cardServicesNote',
};

const groupHeading = 'text-sm font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400';
const small = 'text-xs text-secondary-500 dark:text-secondary-400';

function countryName(country: string): string {
  try {
    return new Intl.DisplayNames([navigator.language], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

function ExchangeLinks({ exchanges }: { exchanges: Exchange[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {exchanges.map((exchange) => (
        <li key={exchange.name}>
          <a
            href={exchange.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-secondary-200 dark:border-secondary-600 px-4 py-3 transition-colors hover:border-primary-500"
          >
            <span className="font-semibold text-secondary-900 dark:text-white">{exchange.name}</span>
            <span className={`block ${small}`}>{exchange.serves}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

interface ExchangeDirectoryProps {
  tokenSymbol: string;
  networkName: string;
  /** Where the withdrawal has to go. Left out for a visitor with no wallet yet, who can still read the list. */
  walletAddress?: string;
  /** A seller's preview: the steps as a customer reads them, with no address, since it would be the seller's. */
  preview?: boolean;
}

/**
 * How to buy on an exchange and withdraw to this wallet, then the exchanges themselves
 * (lib/exchangeDirectory), with the visitor's local ones lifted to the top.
 *
 * Written with `dark:` classes: on a page as it is, and in a modal only a `themed` one (ui/Modal).
 */
export default function ExchangeDirectory({ tokenSymbol, networkName, walletAddress, preview = false }: ExchangeDirectoryProps) {
  const t = useT();
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void visitorCountry().then((found) => {
      if (!cancelled) setCountry(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const local = exchangesIn(country);
  const localNames = new Set(local.map((exchange) => exchange.name));

  return (
    <div>
      <p className="text-sm text-secondary-600 dark:text-secondary-300">
        {t('funding.exchanges.blurb', { token: tokenSymbol })}
      </p>
      <ol className="mt-4 space-y-2 text-sm text-secondary-700 dark:text-secondary-200 list-decimal list-inside">
        <li>{t('funding.exchanges.stepBuy', { token: tokenSymbol })}</li>
        <li>{withNodes(t('funding.exchanges.stepWithdraw'), { network: <strong>{networkName}</strong> })}</li>
        <li>{t(walletAddress || preview ? 'funding.exchanges.stepPaste' : 'funding.exchanges.stepPasteSignedOut')}</li>
      </ol>
      {walletAddress && !preview && <WalletAddressBox walletAddress={walletAddress} />}
      <p className="mt-4 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
        {t('funding.exchanges.check', { token: tokenSymbol, network: networkName })}
      </p>

      {local.length > 0 && country && (
        <div className="mt-6">
          <h3 className={groupHeading}>{t('funding.exchanges.popularIn', { country: countryName(country) })}</h3>
          <ExchangeLinks exchanges={local} />
        </div>
      )}

      {EXCHANGE_REGIONS.map((region) => {
        const rest = region.exchanges.filter((exchange) => !localNames.has(exchange.name));
        if (rest.length === 0) return null;
        const note = REGION_NOTE[region.id];
        return (
          <div key={region.id} className="mt-6">
            <h3 className={groupHeading}>{t(REGION_LABEL[region.id])}</h3>
            {note && <p className={`mt-1 ${small}`}>{t(note)}</p>}
            <ExchangeLinks exchanges={rest} />
          </div>
        );
      })}
      <p className={`mt-6 ${small}`}>{t('funding.exchanges.independent')}</p>
    </div>
  );
}
