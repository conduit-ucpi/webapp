import { useEffect, useRef, useState } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/SimpleAuthProvider';
import { ONRAMP_RETURN_MESSAGE, openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { reportFundingEvent, type FundingRoute } from '@/lib/reportFundingEvent';
import { reportOnrampStatus } from '@/lib/reportOnrampStatus';
import { krakenDelivers, krakenPurchaseAmount, krakenRampUrl } from '@/lib/krakenRamp';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { detectUserCurrency } from '@/utils/currencyDetection';
import { useT } from '../i18n';
import { useFundingTrouble, type LookForPurchase } from './useFundingTrouble';

/**
 * Coinbase enforces a minimum purchase, so presetting a smaller amount bounces. Expressed in
 * tokens because that is what is asked for, and USDC tracks the dollar closely enough for the floor.
 */
export const ONRAMP_MIN_CRYPTO = 5;

export interface WalletFundingRequest {
  /** The connected wallet: where every route here delivers. */
  walletAddress: string;
  tokenSymbol: string;
  /** For naming a token the wallet provider's on-ramp does not know. */
  tokenAddress?: string;
  chainId?: number;
  /** How much is to be bought, in whole tokens. */
  shortfall: number;
  /** The exchange's current minimum in tokens, when known. Otherwise ONRAMP_MIN_CRYPTO applies. */
  minimumPurchase?: number;
  /** Where Coinbase should return the user. Defaults to the page they left. */
  returnPath?: string;
  /** Which way into Coinbase this was, for the log. */
  purpose?: 'add-funds' | 'guide';
  /** A route reported the money as sent, or Coinbase's window came back. */
  onFunded?: () => void;
  /**
   * Whether what was being bought is now in the wallet, where the screen can tell. It ends any
   * help being shown for a purchase that did not go through (`trouble`), and without it nothing
   * is ever reported "stuck".
   */
  funded?: boolean;
  /** No help for a purchase gone wrong: a seller's preview, or a list nobody can buy from. */
  troubleOff?: boolean;
  /**
   * How much of the token the payment needs, where there is a payment. A buyer back from buying
   * is told the purchase arrived short when what is there is less than this. Without it (/wallet),
   * anything arriving is the purchase arriving.
   */
  needed?: number;
  /**
   * Reads, now, how much is where a purchase delivers: this wallet ('wallet') or a payment's own
   * address ('payment'). Null when it cannot be read. Leave it out and the wallet is read here,
   * for `tokenAddress`; a purchase straight into a payment can only be looked for by a screen
   * that passes this.
   */
  readHeld?: (route: FundingRoute) => Promise<number | null>;
}

/**
 * The routes that buy a token INTO THE CONNECTED WALLET, for whoever lists them: the "add funds"
 * list (FundingOptions) and the pay screen's "Card or bank" choices (PaymentActionPanel). One
 * place, so the two cannot drift on how much is asked for or what is copied where.
 *
 * Not the routes that pay a payment's contract address directly: those are the panel's own.
 */
export function useWalletFunding({
  walletAddress,
  tokenSymbol,
  tokenAddress,
  chainId: givenChainId,
  shortfall,
  minimumPurchase = ONRAMP_MIN_CRYPTO,
  returnPath,
  purpose = 'add-funds',
  onFunded,
  funded,
  troubleOff = false,
  needed,
  readHeld,
}: WalletFundingRequest) {
  const t = useT();
  const { config } = useConfig();
  const chainId = givenChainId ?? config?.chainId;
  // The wallet provider's own on-ramp (Privy's funding window). Absent for Reown, so the
  // guard is on capability, not on provider name.
  const { canFundWallet, fundWallet } = useAuth();
  const canUseCard = typeof canFundWallet === 'function' && canFundWallet();
  const [error, setError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  /** The last card purchase came back unconfirmed: it may still deliver, so say not to buy again. */
  const [cardProcessing, setCardProcessing] = useState(false);
  /*
   * What to do when a purchase does not go through, for every route here and for whatever else the
   * screen opens (hooks/useFundingTrouble). Each route below tells it that it was opened, with how
   * to open it again; the screen draws `trouble.current` with <FundingTrouble>.
   */
  /*
   * ⚠️ EVERY SCREEN LOOKS BEFORE IT SAYS ANYTHING ABOUT A PURCHASE. A buyer back from a company's
   *    page is told what was found where the purchase delivers, not asked whether it went through:
   *    it is there (nothing is said), it is there but short, or it is not there yet. So the wallet
   *    is read here, for any screen that lists these routes; only a purchase straight into a
   *    payment needs the screen's own reader. One read of the public RPC, from the buyer's browser.
   */
  const lookForPurchase: LookForPurchase = async ({ route }) => {
    let held: number | null = null;
    if (readHeld) held = await readHeld(route);
    else if (route === 'wallet' && config?.rpcUrl && walletAddress && tokenAddress) {
      const { Web3Service } = await import('@/lib/web3');
      held = parseFloat(await Web3Service.getInstance(config).getTokenBalance(walletAddress, tokenAddress));
    }
    return held === null || !Number.isFinite(held) ? null : { held, needed };
  };
  const trouble = useFundingTrouble({ walletAddress, off: troubleOff, funded, look: lookForPurchase });
  // The routes as they are now, for "open it again" pressed long after the render that opened it.
  const again = useRef<{ card: () => void; coinbase: () => void; kraken: () => void; link: () => void }>({
    card: () => undefined,
    coinbase: () => undefined,
    kraken: () => undefined,
    link: () => undefined,
  });
  const [coinbaseBusy, setCoinbaseBusy] = useState(false);

  // The desktop popup posts back here when Coinbase is done. The holder re-reads the balance -
  // otherwise the user comes back to a screen still telling them they are short.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== ONRAMP_RETURN_MESSAGE) return;
      setCoinbaseBusy(false);
      trouble.reportedBack();
      onFunded?.();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFunded, trouble.reportedBack]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard can be blocked; the value is on screen to copy by hand.
      return false;
    }
  };

  /** Tokens asked of the card and Coinbase routes: the shortfall to the cent, or the minimum. */
  const asked = Math.max(Math.ceil(shortfall * 100) / 100, minimumPurchase);

  const startCard = async () => {
    setError(null);
    setCardBusy(true);
    trouble.opened({ logged: 'Privy', route: 'wallet', inPage: true, reopen: () => again.current.card() });
    // Same rounding as the Coinbase route: ask for tokens, rounded up to the cent, so a
    // >= balance gate cannot fail on dust.
    const amount = asked.toFixed(2);
    const logged = { wallet: walletAddress, amount, provider: 'Privy', route: 'wallet' as const };
    void reportFundingEvent('privy-started', logged);
    try {
      const result = await fundWallet({
        amount,
        asset: tokenSymbol === 'USDC' || !tokenAddress ? 'USDC' : { erc20: tokenAddress, symbol: tokenSymbol },
        chainId: chainId ?? 0,
      });
      const status = result?.status;
      void reportFundingEvent(
        status === 'completed' ? 'privy-completed' : status === 'processing' ? 'privy-processing' : 'privy-cancelled',
        { ...logged, detail: result?.detail }
      );
      trouble.cardEnded(status === 'completed' || status === 'processing' ? status : 'cancelled');
      // Processing is not funded: the page keeps reading the balance until it arrives.
      if (status === 'processing') setCardProcessing(true);
      if (status === 'completed') {
        setCardProcessing(false);
        onFunded?.();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('addFunds.couldNotOpenFunding');
      void reportFundingEvent('privy-failed', { ...logged, detail: message });
      trouble.cardEnded('failed');
      setError(message);
    } finally {
      setCardBusy(false);
    }
  };

  const startCoinbase = async () => {
    setError(null);
    setCoinbaseBusy(true);
    try {
      void reportFundingEvent('coinbase-opened', { wallet: walletAddress, amount: asked.toFixed(2), provider: 'Coinbase', route: 'wallet' });
      trouble.opened({ logged: 'Coinbase', name: 'Coinbase', route: 'wallet', reopen: () => again.current.coinbase() });
      await openCoinbaseOnramp({
        destinationAddress: walletAddress,
        purpose,
        asset: tokenSymbol,
        // Ask for the tokens needed, not the dollars spent. Coinbase's fee comes
        // out of a fiat amount, so presetting fiat delivered a few percent less
        // USDC than the shortfall - and the payment's activation gate is a
        // >= check on the token balance, which then never passes.
        // Rounded up to the cent so the gate cannot fail on dust.
        presetCryptoAmount: asked,
        returnPath,
        onPopupClosed: () => {
          void reportFundingEvent('coinbase-closed', { wallet: walletAddress, amount: asked.toFixed(2), provider: 'Coinbase', route: 'wallet' });
          void reportOnrampStatus('closed');
        },
      });
    } catch (e) {
      trouble.notOpened();
      setError(e instanceof Error ? e.message : t('addFunds.couldNotOpenCoinbase'));
    } finally {
      setCoinbaseBusy(false);
    }
  };

  // Kraken's purchase page, for what it has been seen to deliver (lib/krakenRamp).
  const startKraken = () => {
    const amount = krakenPurchaseAmount(shortfall);
    const url = krakenRampUrl({ walletAddress, tokenSymbol, chainId, amount, fiatCurrency: detectUserCurrency() });
    if (!url) return;
    void reportFundingEvent('kraken-opened', { wallet: walletAddress, amount: String(amount), provider: 'Kraken', route: 'wallet' });
    trouble.opened({ logged: 'Kraken', name: 'Kraken', route: 'wallet', reopen: () => again.current.kraken() });
    // Kraken drops the address we send and asks for one after sign-in (lib/krakenRamp). Copied
    // before the tab opens: a page that is not in front cannot write to the clipboard.
    void copy(walletAddress);
    // A new tab: Kraken has no way back here that we know of, and the payment waits in this one.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Stripe's Link page (lib/stripeLinkOnramp). It takes no wallet address, so the address is
  // copied for the buyer to paste there, and shown to check against.
  const startLink = () => {
    const amount = Math.ceil(shortfall * 100) / 100;
    const url = linkOnrampUrl({ tokenSymbol, chainId, amount });
    if (!url) return;
    void reportFundingEvent('link-opened', { wallet: walletAddress, amount: String(amount), provider: 'Link', route: 'wallet' });
    trouble.opened({ logged: 'Link', name: 'Link by Stripe', route: 'wallet', reopen: () => again.current.link() });
    void copy(walletAddress);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  again.current = { card: () => void startCard(), coinbase: () => void startCoinbase(), kraken: startKraken, link: startLink };

  return {
    chainId,
    /** Help for a purchase that did not go through, by any route: see hooks/useFundingTrouble. */
    trouble,
    /** What the card and Coinbase routes ask for, in whole tokens. */
    asked,
    error,
    copy,
    card: { available: canUseCard, busy: cardBusy, processing: cardProcessing, start: startCard },
    coinbase: { busy: coinbaseBusy, start: startCoinbase },
    kraken: { delivers: krakenDelivers(tokenSymbol, chainId), start: startKraken },
    link: { delivers: linkDelivers(tokenSymbol, chainId), start: startLink },
  };
}
