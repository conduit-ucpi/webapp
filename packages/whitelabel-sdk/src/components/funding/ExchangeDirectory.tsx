import { useEffect, useState } from 'react';
import { EXCHANGE_REGIONS, exchangeLink, exchangesIn, regionOf, type Exchange, type ExchangePurchase, type ExchangeRegionId } from '@/lib/exchangeDirectory';
import { visitorCountry } from '@/lib/visitorCountry';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
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

function ExchangeLinks({
  exchanges,
  purchase,
  onOpen,
}: {
  exchanges: Exchange[];
  purchase?: ExchangePurchase;
  onOpen?: (exchange: Exchange) => void;
}) {
  return (
    <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {exchanges.map((exchange) => (
        <li key={exchange.name}>
          <a
            href={exchangeLink(exchange, purchase)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen ? () => onOpen(exchange) : undefined}
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
  /**
   * 'sell' turns it round, for cashing out: deposit at the exchange, sell there, withdraw to a
   * bank. The address that matters is then the exchange's, so this wallet's is not shown, and the
   * card services are left out: they are listed for buying, and nobody here has seen them buy back.
   */
  mode?: 'buy' | 'sell';
  /** With these, a link that can carry the purchase opens with it filled in (exchangeDirectory.exchangeLink). */
  chainId?: number;
  /** How much is being bought, in whole tokens. */
  amount?: number;
  /**
   * Which of the list this is. 'card-services': only the companies that sell by card and send to
   * an address, with what to give them, for a buyer with no exchange account. 'exchanges': only
   * the exchanges, for one who has. 'all' (the default) is both, card services first.
   */
  show?: 'all' | 'card-services' | 'exchanges';
  /**
   * Show Worldwide and the visitor's own region, and the other regions only on asking. For the
   * pay screen, where the list sits among other things. NOT on /buy-token, whose whole list is
   * there to be read, by people and by the bots sent its HTML.
   */
  ownRegionFirst?: boolean;
  /** Told the name of a company the buyer opens, so the page can put a rise in the balance down to it. */
  onOpened?: (name: string) => void;
}

/**
 * How to buy on an exchange and withdraw to this wallet (or, in 'sell' mode, how to send from this
 * wallet to an exchange and cash out there), then the exchanges themselves (lib/exchangeDirectory),
 * with the visitor's local ones lifted to the top.
 *
 * Written with `dark:` classes: on a page as it is, and in a modal only a `themed` one (ui/Modal).
 */
export default function ExchangeDirectory({
  tokenSymbol,
  networkName,
  walletAddress,
  preview = false,
  mode = 'buy',
  chainId,
  amount,
  show = 'all',
  ownRegionFirst = false,
  onOpened,
}: ExchangeDirectoryProps) {
  const t = useT();
  const [country, setCountry] = useState<string | null>(null);
  /** The other regions' exchanges, asked for. */
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void visitorCountry().then((found) => {
      if (!cancelled) setCountry(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selling = mode === 'sell';
  // Nothing is filled in for a seller looking, or for cashing out, where nothing is bought.
  const purchase: ExchangePurchase | undefined =
    selling || preview ? undefined : { tokenSymbol, chainId, walletAddress, amount };
  const cardServices = new Set(
    EXCHANGE_REGIONS.find((region) => region.id === 'card-services')?.exchanges.map((exchange) => exchange.name),
  );
  /**
   * A buyer opening a company to buy from: logged by name (pages/api/funding-event), card services
   * apart from exchanges. Nothing for a seller's preview or for cashing out, where nothing is bought.
   */
  const opened =
    selling || preview
      ? undefined
      : (exchange: Exchange) => {
          void reportFundingEvent(cardServices.has(exchange.name) ? 'card-service-opened' : 'exchange-opened', {
            wallet: walletAddress,
            amount: amount === undefined ? undefined : String(amount),
            provider: exchange.name,
            route: 'wallet',
          });
          onOpened?.(exchange.name);
        };
  const onlyCards = show === 'card-services' && !selling;
  const withCards = show !== 'exchanges' && !selling;
  const local = exchangesIn(country).filter((exchange) =>
    onlyCards ? cardServices.has(exchange.name) : withCards || !cardServices.has(exchange.name)
  );
  const localNames = new Set(local.map((exchange) => exchange.name));

  /*
   * ⚠️ WORLDWIDE AND THE VISITOR'S OWN REGION, THEN THE REST ON ASKING. The whole list is some
   *    eighty companies, most of them other countries' exchanges, and opened in one go it buried
   *    the few a visitor could use. A country in no region, or an unknown one, gets Worldwide.
   */
  const ownRegion = regionOf(country);
  const regions = EXCHANGE_REGIONS.filter((region) =>
    region.id === 'card-services' ? withCards : !onlyCards
  )
    .map((region) => ({ region, rest: region.exchanges.filter((exchange) => !localNames.has(exchange.name)) }))
    .filter(({ rest }) => rest.length > 0);
  const isFirst = (id: ExchangeRegionId) => !ownRegionFirst || ['card-services', 'worldwide', ownRegion].includes(id);
  const first = regions.filter(({ region }) => isFirst(region.id));
  const others = regions.filter(({ region }) => !isFirst(region.id));
  const group = ({ region, rest }: (typeof regions)[number]) => {
    const note = REGION_NOTE[region.id];
    return (
      <div key={region.id} className="mt-6">
        <h3 className={groupHeading}>{t(REGION_LABEL[region.id])}</h3>
        {note && !onlyCards && <p className={`mt-1 ${small}`}>{t(note)}</p>}
        <ExchangeLinks exchanges={rest} purchase={purchase} onOpen={opened} />
      </div>
    );
  };

  // Card services alone: no steps about withdrawing, because there is nothing to withdraw.
  if (onlyCards) {
    return (
      <div>
        <p className="text-sm text-secondary-600 dark:text-secondary-300">{t('funding.region.cardServicesNote')}</p>
        {walletAddress && !preview && <WalletAddressBox walletAddress={walletAddress} />}
        <p className="mt-4 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
          {t('addFunds.sendOnly', { token: tokenSymbol, network: networkName })}
        </p>
        <ExchangeLinks exchanges={[...local, ...regions.flatMap(({ rest }) => rest)]} purchase={purchase} onOpen={opened} />
        <p className={`mt-6 ${small}`}>{t('funding.exchanges.independent')}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-secondary-600 dark:text-secondary-300">
        {t(selling ? 'funding.sell.blurb' : 'funding.exchanges.blurb', { token: tokenSymbol })}
      </p>
      {selling ? (
        <ol className="mt-4 space-y-2 text-sm text-secondary-700 dark:text-secondary-200 list-decimal list-inside">
          <li>{withNodes(t('funding.sell.stepDeposit', { token: tokenSymbol }), { network: <strong>{networkName}</strong> })}</li>
          <li>{t('funding.sell.stepSend', { token: tokenSymbol })}</li>
          <li>{t('funding.sell.stepSell')}</li>
        </ol>
      ) : (
        <ol className="mt-4 space-y-2 text-sm text-secondary-700 dark:text-secondary-200 list-decimal list-inside">
          <li>{t('funding.exchanges.stepBuy', { token: tokenSymbol })}</li>
          <li>{withNodes(t('funding.exchanges.stepWithdraw'), { network: <strong>{networkName}</strong> })}</li>
          <li>{t(walletAddress || preview ? 'funding.exchanges.stepPaste' : 'funding.exchanges.stepPasteSignedOut')}</li>
        </ol>
      )}
      {walletAddress && !preview && !selling && <WalletAddressBox walletAddress={walletAddress} />}
      <p className="mt-4 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-300">
        {t(selling ? 'funding.sell.check' : 'funding.exchanges.check', { token: tokenSymbol, network: networkName })}
      </p>

      {local.length > 0 && country && (
        <div className="mt-6">
          <h3 className={groupHeading}>{t('funding.exchanges.popularIn', { country: countryName(country) })}</h3>
          <ExchangeLinks exchanges={local} purchase={purchase} onOpen={opened} />
        </div>
      )}

      {first.map(group)}
      {showAll && others.map(group)}
      {!showAll && others.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 py-2 text-sm underline text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-white"
        >
          {t('funding.exchanges.showAll')}
        </button>
      )}
      <p className={`mt-6 ${small}`}>{t('funding.exchanges.independent')}</p>
    </div>
  );
}
