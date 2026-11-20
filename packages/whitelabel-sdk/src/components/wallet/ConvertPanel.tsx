import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useSaleQuote } from '@/hooks/useSwapQuote';
import { SWAP_VENUES, minAmountOut, swapVenue, withinPremium } from '@/lib/stablecoinSwap';
import { canBuyToken } from '@/utils/buyableToken';
import { useT } from '../../i18n';

/**
 * Convert one stablecoin into the other, in the user's own wallet.
 *
 * The reason it is on the wallet page: USDT on Base is not one Tether supports, so Coinbase and
 * most exchanges will not take it there. Somebody paid in USDT converts it to USDC here and then
 * cashes out the ordinary way.
 *
 * It is the pay screen's conversion (lib/stablecoinSwap: Uniswap, the wallet swapping into
 * itself, gas covered) asked the other way round. There the wallet needs exactly so much to
 * arrive; here somebody wants rid of exactly so much, often all of it, so the amount that
 * LEAVES is the fixed one and nothing is left behind as dust.
 */

/** Typing settles for this long before the chain is asked what the amount would bring. */
const QUOTE_AFTER_MS = 500;

const ZERO = BigInt(0);

export interface ConvertPanelProps {
  /** What the wallet holds, by token symbol, as the wallet page reads it. */
  balances: Record<string, string>;
  /** "Base": said where the reason for converting is given. */
  networkName?: string;
  /** Called once a conversion has been sent, so the page can read the balances again. */
  onConverted?: () => void;
}

const unitsOf = (value: string | undefined, decimals: number): bigint => {
  try {
    return ethers.parseUnits(value || '0', decimals);
  } catch {
    return ZERO;
  }
};

export default function ConvertPanel({ balances, networkName, onConverted }: ConvertPanelProps) {
  const t = useT();
  const { config } = useConfig();
  const { quoteSale, sellExactInput } = useSimpleEthers();

  // The two tokens this network's pool converts between, when this deployment lists both.
  const pair = useMemo(() => {
    const symbols = config?.chainId === undefined ? [] : SWAP_VENUES[Number(config.chainId)]?.tokens ?? [];
    return symbols.flatMap((symbol) => (config?.supportedTokens || []).filter((token) => token.symbol.toUpperCase() === symbol));
  }, [config?.chainId, config?.supportedTokens]);

  // Out of the token that is hard to cash out and into the one that is not, unless told otherwise.
  const defaultFrom = pair.find((token) => !canBuyToken(token.symbol))?.symbol ?? pair[0]?.symbol;
  const [fromSymbol, setFromSymbol] = useState<string | null>(null);
  const from = pair.find((token) => token.symbol === (fromSymbol ?? defaultFrom));
  const to = pair.find((token) => token !== from);
  const venue = from && to ? swapVenue(config?.chainId, from.symbol, to.symbol) : null;

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; amount: string; from: string; to: string } | null>(null);

  const held = unitsOf(from ? balances[from.symbol] : undefined, from?.decimals ?? 6);
  const amountUnits = unitsOf(amount, from?.decimals ?? 6);
  const amountIsValid = amountUnits > ZERO && amountUnits <= held;

  // The quote follows the typing at a distance: each one is a call to a rate-limited endpoint.
  const [settled, setSettled] = useState(ZERO);
  const wanted = amountIsValid ? amountUnits.toString() : '0';
  useEffect(() => {
    const timer = setTimeout(() => setSettled(BigInt(wanted)), QUOTE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [wanted]);

  const quote = useSaleQuote({
    venue: busy ? null : venue,
    tokenIn: from?.address,
    tokenOut: to?.address,
    amountIn: settled,
    quoteSale,
  });

  if (!venue || !from || !to) return null;

  const fair = (quoted: bigint, sold: bigint) => withinPremium(sold, quoted, from.decimals, to.decimals);
  const quoteIsCurrent = settled === amountUnits && quote.state === 'quoted' && quote.amountOut !== null;
  const tooDear = quoteIsCurrent && !fair(quote.amountOut!, amountUnits);
  const canConvert = amountIsValid && quoteIsCurrent && !tooDear && !busy;

  const convert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConvert) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      // A fresh quote: the one on screen was for showing, and may be minutes old.
      const quoted = await quoteSale(venue, from.address, to.address, amountUnits);
      if (!fair(quoted, amountUnits)) throw new Error(t('walletPage.convert.tooDear', { from: from.symbol, to: to.symbol }));
      const amountOutMinimum = minAmountOut(quoted);
      // Said inside the wallet's own prompt, which otherwise only names the router's address.
      const figures = {
        amount: ethers.formatUnits(amountUnits, from.decimals),
        from: from.symbol,
        minimum: ethers.formatUnits(amountOutMinimum, to.decimals),
        to: to.symbol,
      };
      const hash = await sellExactInput(
        venue,
        { tokenIn: from.address, tokenInDecimals: from.decimals, tokenOut: to.address, amountIn: amountUnits, amountOutMinimum },
        { approve: t('walletPage.convert.promptApprove', figures), convert: t('walletPage.convert.promptConvert', figures) }
      );
      setDone({ hash, amount: figures.amount, from: from.symbol, to: to.symbol });
      setAmount('');
      onConverted?.();
    } catch (failure: any) {
      setError(failure?.message || t('walletPage.convert.failed'));
    } finally {
      setBusy(false);
    }
  };

  const hardToCashOut = !canBuyToken(from.symbol) && canBuyToken(to.symbol);

  return (
    <section
      id="convert"
      aria-labelledby="convert-heading"
      className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 mb-8 scroll-mt-4"
    >
      <h2 id="convert-heading" className="text-lg font-semibold text-secondary-900 dark:text-white">
        {t('walletPage.convert.title', { from: from.symbol, to: to.symbol })}
      </h2>
      <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
        {hardToCashOut
          ? t('walletPage.convert.blurbCashOut', { from: from.symbol, to: to.symbol, network: networkName ?? '' })
          : t('walletPage.convert.blurb', { from: from.symbol, to: to.symbol })}
      </p>

      <form onSubmit={convert} className="mt-6 space-y-5">
        <div>
          <span className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
            {t('walletPage.convert.from')}
          </span>
          <div className="flex flex-wrap gap-4">
            {pair.map((token) => (
              <label key={token.symbol} className="flex items-center text-secondary-700 dark:text-secondary-200">
                <input
                  type="radio"
                  name="convertFrom"
                  value={token.symbol}
                  checked={from.symbol === token.symbol}
                  disabled={busy}
                  onChange={(e) => {
                    setFromSymbol(e.target.value);
                    setAmount('');
                    setError(null);
                  }}
                  className="mr-2"
                />
                {token.symbol}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="convertAmount" className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
            {t('walletPage.convert.amount', { from: from.symbol })}
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="convertAmount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0.00"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
                error={amount && !amountIsValid ? t('walletPage.convert.invalidAmount') : undefined}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || held === ZERO}
              onClick={() => setAmount(ethers.formatUnits(held, from.decimals))}
            >
              {t('walletPage.convert.max')}
            </Button>
          </div>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            {t('walletPage.convert.available', { balance: ethers.formatUnits(held, from.decimals), from: from.symbol })}
          </p>
        </div>

        {amountIsValid && (
          <p role="status" className="text-sm text-secondary-700 dark:text-secondary-200">
            {quote.state === 'failed' && settled === amountUnits ? (
              t('walletPage.convert.unavailable', { from: from.symbol, to: to.symbol })
            ) : tooDear ? (
              t('walletPage.convert.tooDear', { from: from.symbol, to: to.symbol })
            ) : quoteIsCurrent ? (
              <>
                <span className="font-semibold">
                  {t('walletPage.convert.receive', { amount: ethers.formatUnits(quote.amountOut!, to.decimals), to: to.symbol })}
                </span>{' '}
                {t('walletPage.convert.atLeast', {
                  minimum: ethers.formatUnits(minAmountOut(quote.amountOut!), to.decimals),
                  to: to.symbol,
                })}
              </>
            ) : (
              t('walletPage.convert.quoting')
            )}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {done && (
          <div role="status" className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-secondary-700 dark:text-secondary-200">
            <p className="font-semibold text-secondary-900 dark:text-white">
              {t('walletPage.convert.sent', { amount: done.amount, from: done.from, to: done.to })}
            </p>
            <p className="mt-1">{t('walletPage.convert.sentNote', { to: done.to })}</p>
            <div className="mt-2"><ExpandableHash hash={done.hash} /></div>
          </div>
        )}

        <Button type="submit" disabled={!canConvert}>
          {busy ? t('walletPage.convert.converting') : t('walletPage.convert.submit', { from: from.symbol, to: to.symbol })}
        </Button>
        <p className="text-sm text-secondary-500 dark:text-secondary-400">{t('walletPage.convert.footnote')}</p>
      </form>
    </section>
  );
}
